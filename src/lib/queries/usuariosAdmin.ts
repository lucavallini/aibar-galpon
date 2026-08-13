import { supabase } from '@/lib/supabase'
import { desempaquetarLista, ErrorSupabase } from '@/lib/queries/errores'
import type { Rol, Usuario } from '@/types'

/**
 * Administración de usuarios, reservada al gerente.
 *
 * Es la única escritura que se le permite desde el panel administrativo, y es
 * deliberada: sin ella, dar de alta a alguien o cambiarle el rol requiere SQL
 * manual contra la base.
 */

/** Todo el padrón, con los inactivos al final. */
export async function listarUsuarios(): Promise<Usuario[]> {
  const respuesta = await supabase
    .from('usuario')
    .select('*')
    .order('activo', { ascending: false })
    .order('nombre')

  return desempaquetarLista(respuesta, 'listar los usuarios')
}

/**
 * Cambia el rol de alguien.
 *
 * La policy `usuario_update_jefe` impide que un jefe se lo cambie a sí mismo: si
 * se quitara el rol por error, quedaría el sistema sin nadie que pueda
 * devolvérselo.
 */
export async function cambiarRol(usuarioId: string, rol: Rol): Promise<void> {
  const { error } = await supabase.from('usuario').update({ rol }).eq('id', usuarioId)

  if (error !== null) {
    throw new ErrorSupabase('cambiar el rol', error)
  }
}

/**
 * Habilita o deshabilita a un usuario.
 *
 * Un usuario inactivo conserva su cuenta y su historial —los movimientos que
 * registró siguen figurando a su nombre— pero RLS deja de mostrarle nada. Es la
 * forma correcta de dar de baja a alguien que dejó de trabajar en el depósito:
 * borrarlo rompería las referencias de todo lo que hizo.
 */
export async function cambiarActivo(usuarioId: string, activo: boolean): Promise<void> {
  const { error } = await supabase.from('usuario').update({ activo }).eq('id', usuarioId)

  if (error !== null) {
    throw new ErrorSupabase(activo ? 'habilitar el usuario' : 'deshabilitar el usuario', error)
  }
}

export interface DatosNuevoUsuario {
  /** Con el que la persona va a entrar. Se acepta con puntos. */
  dni: string
  password: string
  nombre: string
  rol: Rol
}

/**
 * Da de alta un usuario, identificado por su DNI.
 *
 * Pasa por una Edge Function y no por supabase-js directo porque crear cuentas
 * necesita la clave `service_role`, que abre la base entera salteando RLS: en el
 * navegador cualquiera la leería. La función corre en el servidor de Supabase,
 * valida que quien llama sea jefe, y recién ahí crea.
 *
 * Es también la que arma el identificador interno con forma de email a partir
 * del DNI, así el operario nunca ve un correo en ningún lado.
 *
 * Tampoco se deja el registro abierto: sin control, cualquiera crearía cuentas
 * y llenaría la base.
 *
 * @throws {Error} con el mensaje que devuelve la función, ya en castellano.
 */
export async function crearUsuario(datos: DatosNuevoUsuario): Promise<void> {
  const { data, error } = await supabase.functions.invoke('crear-usuario', {
    body: {
      dni: datos.dni.trim(),
      password: datos.password,
      nombre: datos.nombre.trim(),
      rol: datos.rol,
    },
  })

  if (error !== null) {
    // La función responde con `{ error: '…' }` y un código HTTP; supabase-js lo
    // envuelve, así que hay que sacar el mensaje del cuerpo para no mostrar un
    // «FunctionsHttpError» al gerente.
    const detalle = await extraerMensaje(error)

    throw new Error(detalle ?? 'No se pudo crear el usuario. Probá de nuevo.')
  }

  const respuesta = data as { advertencia?: string } | null

  if (respuesta?.advertencia !== undefined) {
    throw new Error(respuesta.advertencia)
  }
}

/** Saca el mensaje que devolvió la Edge Function dentro del error. */
async function extraerMensaje(error: unknown): Promise<string | null> {
  const conContexto = error as { context?: { json?: () => Promise<unknown> } }

  try {
    const cuerpo = await conContexto.context?.json?.()
    const conError = cuerpo as { error?: string } | undefined

    return conError?.error ?? null
  } catch {
    // El cuerpo no era JSON: no hay nada mejor que ofrecer que el genérico.
    return null
  }
}
