import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Alta de usuarios, hecha por el gerente.
 *
 * ¿Por qué una función y no una pantalla que llame a Supabase directo? Porque
 * crear cuentas necesita la clave `service_role`, y esa clave abre la base
 * entera salteando RLS. Si estuviera en el frontend, cualquiera la leería del
 * navegador. Acá vive en el servidor de Supabase, que la inyecta sola y nunca
 * sale de ahí.
 *
 * Tampoco se deja el registro abierto: sin control, cualquiera crea cuentas y
 * llena la base. Solo un jefe autenticado puede dar de alta a alguien.
 *
 * DESPLIEGUE
 *   supabase functions deploy crear-usuario
 *
 * No hace falta configurar ningún secreto: `SUPABASE_URL` y
 * `SUPABASE_SERVICE_ROLE_KEY` ya están disponibles en el entorno.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Cuerpo {
  email?: string
  password?: string
  nombre?: string
  rol?: 'operario' | 'jefe'
}

function responder(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** Los mensajes van en castellano: se muestran tal cual en el panel. */
function error(mensaje: string, status: number): Response {
  return responder({ error: mensaje }, status)
}

Deno.serve(async (peticion: Request) => {
  if (peticion.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (peticion.method !== 'POST') {
    return error('Método no permitido.', 405)
  }

  const urlSupabase = Deno.env.get('SUPABASE_URL')
  const claveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const claveAnon = Deno.env.get('SUPABASE_ANON_KEY')

  if (
    urlSupabase === undefined ||
    claveServicio === undefined ||
    claveAnon === undefined
  ) {
    console.error('[crear-usuario] faltan variables de entorno')
    return error('La función no está bien configurada.', 500)
  }

  // -------------------------------------------------------
  // 1. Quién está pidiendo esto
  // -------------------------------------------------------

  const autorizacion = peticion.headers.get('Authorization')

  if (autorizacion === null) {
    return error('Falta la sesión.', 401)
  }

  // Cliente con la clave pública y el token de quien llama: sirve para saber
  // quién es, sin poderes especiales.
  const comoUsuario = createClient(urlSupabase, claveAnon, {
    global: { headers: { Authorization: autorizacion } },
  })

  const { data: sesion, error: errorSesion } = await comoUsuario.auth.getUser()

  if (errorSesion !== null || sesion.user === null) {
    return error('Sesión inválida o vencida. Volvé a entrar.', 401)
  }

  // -------------------------------------------------------
  // 2. ¿Es jefe?
  // -------------------------------------------------------
  //
  // Se consulta con el cliente del usuario, no con el de servicio: así RLS
  // sigue aplicando y la respuesta es la que ese usuario puede ver de verdad.

  const { data: perfil } = await comoUsuario
    .from('usuario')
    .select('rol, activo')
    .eq('id', sesion.user.id)
    .maybeSingle()

  if (perfil === null || perfil.rol !== 'jefe' || perfil.activo !== true) {
    // Mismo mensaje para «no sos jefe» y «estás inactivo»: no hay motivo para
    // detallarle a quien no corresponde qué le falta.
    return error('No tenés permiso para dar de alta usuarios.', 403)
  }

  // -------------------------------------------------------
  // 3. Validar lo que mandó
  // -------------------------------------------------------

  let cuerpo: Cuerpo

  try {
    cuerpo = (await peticion.json()) as Cuerpo
  } catch {
    return error('No se entendió el pedido.', 400)
  }

  const email = cuerpo.email?.trim().toLowerCase() ?? ''
  const password = cuerpo.password ?? ''
  const nombre = cuerpo.nombre?.trim() ?? ''
  const rol = cuerpo.rol ?? 'operario'

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return error('El email no es válido.', 400)
  }

  if (password.length < 8) {
    return error('La contraseña tiene que tener al menos 8 caracteres.', 400)
  }

  if (nombre === '' || nombre.length > 100) {
    return error('Poné el nombre de la persona (hasta 100 caracteres).', 400)
  }

  if (rol !== 'operario' && rol !== 'jefe') {
    return error('El rol tiene que ser operario o jefe.', 400)
  }

  // -------------------------------------------------------
  // 4. Crear la cuenta
  // -------------------------------------------------------

  const comoServicio = createClient(urlSupabase, claveServicio)

  const { data: creado, error: errorAlta } = await comoServicio.auth.admin.createUser({
    email,
    password,
    // Sin confirmación por correo: la cuenta la crea el gerente en persona y la
    // persona tiene que poder entrar enseguida.
    email_confirm: true,
    user_metadata: { nombre },
  })

  if (errorAlta !== null || creado.user === null) {
    console.error('[crear-usuario] fallo el alta', errorAlta)

    if (errorAlta?.message.includes('already been registered') === true) {
      return error('Ya existe un usuario con ese email.', 409)
    }

    return error('No se pudo crear el usuario. Probá de nuevo.', 500)
  }

  // -------------------------------------------------------
  // 5. Ajustar el perfil
  // -------------------------------------------------------
  //
  // El trigger `crear_usuario()` ya insertó la fila en `public.usuario` con rol
  // `operario`. Si el gerente pidió un jefe, se corrige acá.

  if (rol === 'jefe') {
    const { error: errorRol } = await comoServicio
      .from('usuario')
      .update({ rol: 'jefe' })
      .eq('id', creado.user.id)

    if (errorRol !== null) {
      // La cuenta quedó creada como operario: no es un fallo total, pero el
      // gerente tiene que saber que le falta un paso.
      console.error('[crear-usuario] no se pudo asignar el rol', errorRol)

      return responder(
        {
          id: creado.user.id,
          advertencia:
            'El usuario se creó como operario, pero no se pudo asignarle el rol de jefe. Cambialo desde la lista.',
        },
        201,
      )
    }
  }

  return responder({ id: creado.user.id, email, nombre, rol }, 201)
})
