import { registrarMovimiento } from '@/lib/queries/movimientos'
import { esFalloDeRed } from '@/offline/esFalloDeRed'
import {
  devolverAPendiente,
  listarParaSincronizar,
  marcarFallido,
  marcarSincronizando,
  quitar,
} from '@/offline/cola'

/**
 * Manda a la base los movimientos que quedaron encolados.
 *
 * La distinción que gobierna todo este archivo es entre **fallar por red** y
 * **ser rechazado**:
 *
 * - Si no hubo señal, el movimiento vuelve a la cola tal como estaba. No es
 *   culpa de nadie y se reintenta más tarde.
 * - Si la base lo rechazó —«Stock insuficiente», «El palet se encuentra dado de
 *   baja»— reintentar no va a cambiar nada. Queda marcado como fallido, con el
 *   motivo, para que el operario decida.
 *
 * Confundir los dos casos es lo que hace que un movimiento se pierda en
 * silencio, que es justamente lo que no puede pasar.
 */

export interface ResultadoSincronizacion {
  sincronizados: number
  fallidos: number
  /** Quedaron para después porque se cortó la conexión. */
  pospuestos: number
}


/** Evita que dos disparos —el automático y el botón— corran a la vez. */
let sincronizando = false

/** Si hay una sincronización en curso. */
export function estaSincronizando(): boolean {
  return sincronizando
}

/**
 * Vacía la cola contra la base.
 *
 * Los movimientos se mandan **de a uno y en orden de creación**: si el operario
 * descontó dos veces del mismo palet, mandarlos en paralelo o desordenados
 * puede hacer que el segundo sea rechazado por un stock que el primero todavía
 * no descontó.
 *
 * Ante un corte de red se detiene en seco en lugar de seguir intentando con el
 * resto: si falló uno, los que siguen van a fallar igual, y frenar mantiene el
 * orden intacto para el próximo intento.
 */
export async function sincronizar(): Promise<ResultadoSincronizacion> {
  const resultado: ResultadoSincronizacion = {
    sincronizados: 0,
    fallidos: 0,
    pospuestos: 0,
  }

  if (sincronizando) return resultado

  sincronizando = true

  try {
    const pendientes = await listarParaSincronizar()

    for (const movimiento of pendientes) {
      // Sin señal no tiene sentido ni intentar el primero.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        resultado.pospuestos = pendientes.length - resultado.sincronizados
        break
      }

      await marcarSincronizando(movimiento.id)

      try {
        await registrarMovimiento({
          paletId: movimiento.paletId,
          tipo: movimiento.tipo,
          cantidad: movimiento.cantidad,
        })

        // Recién con la confirmación de la base sale de la cola.
        await quitar(movimiento.id)
        resultado.sincronizados += 1
      } catch (error: unknown) {
        if (esFalloDeRed(error)) {
          // Volvió a cortarse: se deja como estaba y se corta el recorrido para
          // no romper el orden de los que faltan.
          await devolverAPendiente(movimiento.id)
          resultado.pospuestos =
            pendientes.length - resultado.sincronizados - resultado.fallidos
          break
        }

        // La base lo rechazó. El mensaje ya viene redactado para el operario.
        const motivo =
          error instanceof Error
            ? error.message
            : 'La base rechazó el movimiento y no informó el motivo.'

        await marcarFallido(movimiento.id, motivo)
        resultado.fallidos += 1
      }
    }
  } finally {
    sincronizando = false
  }

  return resultado
}
