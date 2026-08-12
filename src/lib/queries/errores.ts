import type { PostgrestError } from '@supabase/supabase-js'

/**
 * Manejo de errores de la capa de datos.
 *
 * Ninguna query devuelve el `{ data, error }` crudo hacia arriba: o devuelve el
 * dato listo para usar, o lanza. Así los hooks y los componentes no repiten el
 * chequeo de `error` en cada llamada.
 */

/**
 * Error de cualquier operación contra Supabase.
 *
 * El `message` es el que manda Postgres cuando existe, porque ahí viajan las
 * validaciones de negocio del schema ("Stock insuficiente. Disponible: 12,
 * solicitado: 20", "El movimiento ya no puede corregirse (fuera de plazo)") y
 * son exactamente las que hay que mostrarle al operario tal cual.
 */
export class ErrorSupabase extends Error {
  /** Código SQLSTATE o de PostgREST, p. ej. `PGRST116`, `42501`. */
  readonly codigo: string | null
  /** Detalle técnico que devuelve Postgres, para el log. */
  readonly detalle: string | null
  /** Qué se estaba haciendo, p. ej. `listar productos`. */
  readonly contexto: string

  constructor(contexto: string, error: PostgrestError | null) {
    super(mensajePresentable(contexto, error))

    this.name = 'ErrorSupabase'
    this.contexto = contexto
    // PostgREST manda `code: ''` cuando el fallo es de red y no de la base.
    // Normalizarlo a `null` evita que el resto del código lo confunda con un
    // rechazo real, que es lo que decide si un movimiento se reintenta o se
    // marca como fallido.
    this.codigo = error?.code === undefined || error.code === '' ? null : error.code
    this.detalle = error?.details ?? null
  }
}

/**
 * Mensajes de la capa de transporte, que nunca deben llegar a la pantalla.
 *
 * Cuando falla la red, supabase-js devuelve el error del `fetch` dentro de
 * `PostgrestError.message`: «TypeError: Failed to fetch». Es inglés y jerga, y
 * antes se mostraba tal cual al operario.
 */
const PATRONES_TECNICOS =
  /failed to fetch|networkerror|load failed|fetch failed|typeerror|err_internet|net::/i

/**
 * Decide qué texto ve el usuario.
 *
 * Los mensajes que escribe la base con `RAISE EXCEPTION` —«Stock insuficiente.
 * Disponible: 80, solicitado: 100»— están redactados para el operario y se
 * muestran **tal cual**: son el resultado de una regla de negocio y explican
 * exactamente qué pasó. Solo se reemplazan los de la capa de transporte, que no
 * le dicen nada a nadie.
 */
function mensajePresentable(contexto: string, error: PostgrestError | null): string {
  const original = error?.message

  if (original === undefined || original === '') {
    return `No se pudo ${contexto}.`
  }

  if (PATRONES_TECNICOS.test(original)) {
    return 'No se pudo conectar con el servidor. Revisá la señal y probá de nuevo.'
  }

  return original
}

interface RespuestaSupabase<T> {
  data: T | null
  error: PostgrestError | null
}

/**
 * Desempaqueta una respuesta que debe traer un dato sí o sí.
 *
 * @param contexto Qué se intentaba hacer, en infinitivo: `obtener el palet 42`.
 * @throws {ErrorSupabase} si Supabase devolvió error o si no vino ningún dato.
 */
export function desempaquetar<T>(respuesta: RespuestaSupabase<T>, contexto: string): T {
  if (respuesta.error !== null) {
    throw new ErrorSupabase(contexto, respuesta.error)
  }

  if (respuesta.data === null) {
    throw new ErrorSupabase(contexto, null)
  }

  return respuesta.data
}

/**
 * Desempaqueta un listado. A diferencia de `desempaquetar`, "no hay filas" no es
 * un error: es una lista vacía. Ojo con esto al depurar, porque RLS filtra sin
 * avisar — un usuario inactivo ve `[]`, no un 403.
 */
export function desempaquetarLista<T>(
  respuesta: RespuestaSupabase<T[]>,
  contexto: string,
): T[] {
  if (respuesta.error !== null) {
    throw new ErrorSupabase(contexto, respuesta.error)
  }

  return respuesta.data ?? []
}

/**
 * Desempaqueta una búsqueda que legítimamente puede no encontrar nada.
 *
 * PostgREST responde `PGRST116` cuando un `.single()` no encuentra fila; acá eso
 * se traduce a `null` en lugar de lanzar. Cualquier otro error sí lanza.
 */
export function desempaquetarOpcional<T>(
  respuesta: RespuestaSupabase<T>,
  contexto: string,
): T | null {
  if (respuesta.error !== null) {
    if (respuesta.error.code === 'PGRST116') {
      return null
    }

    throw new ErrorSupabase(contexto, respuesta.error)
  }

  return respuesta.data
}
