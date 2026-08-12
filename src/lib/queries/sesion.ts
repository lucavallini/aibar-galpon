import type { AuthError, Session, Subscription } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

/**
 * Operaciones de sesión contra Supabase Auth.
 *
 * Como el resto de `queries/`, es la única capa que habla con supabase-js, y
 * nada de acá devuelve un error crudo hacia arriba: los errores de Auth se
 * traducen a `ErrorAutenticacion` con un mensaje en español, listo para mostrar.
 */

/**
 * Error de autenticación con un mensaje presentable al usuario.
 *
 * El `message` ya está en español y sin jerga técnica: se puede renderizar
 * directamente en pantalla. El detalle original queda en `codigoOriginal` para
 * el log, que es donde tiene que vivir.
 */
export class ErrorAutenticacion extends Error {
  readonly codigoOriginal: string | null

  constructor(mensaje: string, codigoOriginal: string | null = null) {
    super(mensaje)
    this.name = 'ErrorAutenticacion'
    this.codigoOriginal = codigoOriginal
  }
}

/**
 * Traduce un error de Supabase Auth a algo que le sirva al operario.
 *
 * A propósito no distingue entre "el email no existe" y "la contraseña está
 * mal": Supabase ya los unifica en `invalid_credentials` para no filtrar qué
 * emails están registrados, y acá se mantiene esa decisión.
 */
function traducirErrorDeAuth(error: AuthError): ErrorAutenticacion {
  const codigo = error.code ?? null

  const mensaje = ((): string => {
    switch (codigo) {
      case 'invalid_credentials':
        return 'Email o contraseña incorrectos.'
      case 'email_not_confirmed':
        return 'La cuenta todavía no fue confirmada. Revisá tu correo.'
      case 'user_banned':
      case 'user_not_found':
        return 'Esta cuenta no está habilitada. Hablá con el encargado.'
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return 'Demasiados intentos seguidos. Esperá un momento y volvé a probar.'
      case 'validation_failed':
        return 'Revisá que el email y la contraseña estén completos.'
      case 'weak_password':
        return 'La contraseña es demasiado débil.'
      default:
        break
    }

    // Sin conexión el navegador aborta el fetch y Supabase no llega a mandar código.
    if (error.status === 0 || error.message.toLowerCase().includes('fetch')) {
      return 'No hay conexión con el servidor. Revisá tu conexión a internet.'
    }

    if (error.status !== undefined && error.status >= 500) {
      return 'El servidor no está respondiendo. Probá de nuevo en unos minutos.'
    }

    return 'No se pudo iniciar sesión. Probá de nuevo.'
  })()

  return new ErrorAutenticacion(mensaje, codigo)
}

/**
 * Inicia sesión con email y contraseña.
 *
 * @throws {ErrorAutenticacion} con un mensaje ya presentable en pantalla.
 */
export async function iniciarSesion(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error !== null) {
    // El detalle técnico va al log, no a la pantalla.
    console.error('[auth] fallo al iniciar sesión', error)
    throw traducirErrorDeAuth(error)
  }

  if (data.session === null) {
    throw new ErrorAutenticacion('No se pudo iniciar sesión. Probá de nuevo.')
  }

  return data.session
}

/** Cierra la sesión y limpia el token persistido. */
export async function cerrarSesion(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error !== null) {
    console.error('[auth] fallo al cerrar sesión', error)
    throw traducirErrorDeAuth(error)
  }
}

/**
 * Sesión persistida, o `null` si no hay ninguna.
 *
 * Hay que esperarla antes de decidir cualquier redirección: al recargar la
 * página, Supabase tarda un instante en rehidratar el token desde el storage, y
 * si no se espera, el usuario ve un parpadeo hacia el login.
 */
export async function obtenerSesion(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession()

  if (error !== null) {
    console.error('[auth] fallo al recuperar la sesión', error)
    throw traducirErrorDeAuth(error)
  }

  return data.session
}

/**
 * Se suscribe a los cambios de sesión (login, logout, refresh del token, y el
 * cierre de sesión hecho desde otra pestaña).
 *
 * El callback tiene que ser sincrónico y liviano: si adentro se hace `await` de
 * otra llamada a supabase-js, el cliente se traba esperando su propio lock. Para
 * cargar el perfil, reaccionar al cambio de sesión desde afuera.
 *
 * @returns función para desuscribirse.
 */
export function alCambiarSesion(callback: (sesion: Session | null) => void): () => void {
  const {
    data: { subscription },
  }: { data: { subscription: Subscription } } = supabase.auth.onAuthStateChange(
    (_evento, sesion) => {
      callback(sesion)
    },
  )

  return () => {
    subscription.unsubscribe()
  }
}
