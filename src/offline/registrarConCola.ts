import { registrarMovimiento } from '@/lib/queries/movimientos'
import { encolar } from '@/offline/cola'
import { esFalloDeRed } from '@/offline/esFalloDeRed'
import type { Movimiento, TipoMovimientoRegistrable } from '@/types'


/**
 * Registrar un movimiento sabiendo que la señal puede fallar.
 *
 * Acá vive la única decisión de «¿hay conexión?» de todo el flujo. Las pantallas
 * llaman a esto y reciben el resultado; no preguntan ni deciden nada.
 */

export interface DatosMovimientoConCola {
  paletId: number
  tipo: TipoMovimientoRegistrable
  cantidad: number
  /** Para poder identificar el movimiento en la cola sin consultar la base. */
  paletEtiqueta: string
  unidad: string
}

export type ResultadoRegistro =
  /** Entró en la base. El stock ya cambió. */
  | { destino: 'base'; movimiento: Movimiento }
  /** Quedó guardado localmente, esperando señal. El stock todavía no cambió. */
  | { destino: 'cola' }


/**
 * Intenta registrar el movimiento; si no hay señal, lo encola.
 *
 * @throws el error de la base cuando el rechazo es de negocio. Esos no se
 * encolan: se le muestran al operario en el momento.
 */
export async function registrarOEncolar(
  datos: DatosMovimientoConCola,
): Promise<ResultadoRegistro> {
  // Si el navegador ya sabe que no hay red, se ahorra el viaje y la espera.
  const sinRed = typeof navigator !== 'undefined' && !navigator.onLine

  if (sinRed) {
    await encolar(datos)
    return { destino: 'cola' }
  }

  try {
    const movimiento = await registrarMovimiento({
      paletId: datos.paletId,
      tipo: datos.tipo,
      cantidad: datos.cantidad,
    })

    return { destino: 'base', movimiento }
  } catch (error: unknown) {
    // `navigator.onLine` miente seguido: dice que hay red porque el wifi está
    // conectado, aunque no llegue a internet. Este es el caso real en el
    // depósito, y por eso el fallo se detecta acá y no solo antes de intentar.
    if (esFalloDeRed(error)) {
      await encolar(datos)
      return { destino: 'cola' }
    }

    throw error
  }
}
