import { ErrorSupabase } from '@/lib/queries/errores'

/**
 * Distingue un corte de red de un rechazo de la base.
 *
 * Es **la** decisión de toda la capa offline, y por eso vive en un solo lugar:
 * la usan por igual el registro de un movimiento nuevo y la sincronización de
 * la cola, y si las dos no coincidieran un mismo error terminaría encolado en un
 * caso y descartado en el otro.
 *
 * - **Corte de red**: el pedido nunca llegó al servidor. Se encola o se
 *   reintenta; nadie hizo nada mal.
 * - **Rechazo**: la base contestó que no —«Stock insuficiente»—. Reintentar no
 *   va a cambiar el resultado, así que hace falta que alguien decida.
 */
export function esFalloDeRed(error: unknown): boolean {
  if (error instanceof ErrorSupabase) {
    // Sin código, PostgREST no llegó a contestar. `ErrorSupabase` ya normaliza
    // el `code: ''` que manda supabase-js en esos casos.
    return error.codigo === null
  }

  if (error instanceof TypeError) {
    // `fetch` tira TypeError cuando no hay red.
    return true
  }

  const mensaje = error instanceof Error ? error.message.toLowerCase() : ''

  return (
    mensaje.includes('failed to fetch') ||
    mensaje.includes('network') ||
    mensaje.includes('load failed')
  )
}
