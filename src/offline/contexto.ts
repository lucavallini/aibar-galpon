import { createContext } from 'react'
import type { MovimientoPendiente } from '@/offline/db'
import type { ResultadoSincronizacion } from '@/offline/sincronizador'

/**
 * Estado de la conexión y de la cola, para toda la app.
 *
 * Existe para que ninguna pantalla tenga que preguntar «¿hay internet?»: la
 * decisión de mandar o encolar la toma `src/offline/`, y acá solo se publica el
 * resultado para poder mostrarlo.
 */
export interface ContextoOffline {
  /** Lo que informa el navegador. Puede mentir: hay red pero no llega al servidor. */
  enLinea: boolean
  /** Movimientos esperando que vuelva la señal. */
  pendientes: number
  /** Movimientos que la base rechazó y esperan una decisión. */
  fallidos: number
  /** La cola completa, para la pantalla que los muestra. */
  cola: MovimientoPendiente[]
  sincronizando: boolean
  /** Fuerza un intento de vaciar la cola. */
  sincronizarAhora: () => Promise<ResultadoSincronizacion>
  /** Devuelve un fallido a la cola para intentarlo de nuevo. */
  reintentarUno: (id: string) => Promise<void>
  /** Saca de la cola un movimiento que ya no corresponde registrar. */
  descartarUno: (id: string) => Promise<void>
  /** Si un palet tiene movimientos sin sincronizar: su stock puede cambiar. */
  paletTienePendientes: (paletId: number) => boolean
}

export const contextoOffline = createContext<ContextoOffline | null>(null)
