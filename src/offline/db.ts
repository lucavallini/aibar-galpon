import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { TipoMovimientoRegistrable } from '@/types'

/**
 * Almacenamiento local del depósito.
 *
 * Todo va en IndexedDB vía `idb`, nunca en `localStorage` ni `sessionStorage`:
 * son síncronos, tienen un límite de unos pocos megas y guardan solo strings.
 * Acá hay que poder guardar una cola de operaciones y la caché de consultas sin
 * bloquear el hilo de la interfaz mientras el operario trabaja.
 */

/** Estado en el que puede estar un movimiento encolado. */
export type EstadoPendiente =
  /** Esperando que vuelva la conexión. */
  | 'pendiente'
  /** Se está mandando ahora mismo. */
  | 'sincronizando'
  /** La base lo rechazó. El motivo está en `error`. */
  | 'fallido'

export interface MovimientoPendiente {
  /** Identificador local. No tiene nada que ver con el id que dará la base. */
  id: string
  paletId: number
  tipo: TipoMovimientoRegistrable
  cantidad: number

  /**
   * Datos del palet copiados al encolar.
   *
   * Se guardan a propósito, aunque estén duplicados: cuando este movimiento
   * falle —quizás horas después y sin señal— hay que poder decirle al operario
   * de qué palet se trata sin depender de una consulta.
   */
  paletEtiqueta: string
  unidad: string

  creadoEn: number
  intentos: number
  estado: EstadoPendiente
  /** Mensaje de la base cuando fue rechazado. */
  error?: string
  ultimoIntentoEn?: number
}

interface EsquemaAibar extends DBSchema {
  /** Movimientos registrados sin conexión, esperando su turno. */
  'movimientos-pendientes': {
    key: string
    value: MovimientoPendiente
    indexes: { 'por-estado': EstadoPendiente; 'por-palet': number }
  }
  /**
   * Caché de las consultas de React Query.
   *
   * Permite que el operario vuelva a ver un palet que ya había abierto aunque
   * se le corte la señal. Va acá y no en `localStorage` por la misma razón que
   * todo lo demás.
   */
  'cache-consultas': {
    key: string
    value: unknown
  }
}

const NOMBRE_BASE = 'aibar-deposito'
const VERSION = 1

let promesaDeBase: Promise<IDBPDatabase<EsquemaAibar>> | null = null

/**
 * Conexión a la base local, abierta una sola vez.
 *
 * Se guarda la promesa y no la base ya resuelta: así dos llamadas simultáneas
 * durante el arranque comparten la misma apertura en lugar de abrir dos.
 */
export function obtenerBase(): Promise<IDBPDatabase<EsquemaAibar>> {
  promesaDeBase ??= openDB<EsquemaAibar>(NOMBRE_BASE, VERSION, {
    upgrade(base) {
      if (!base.objectStoreNames.contains('movimientos-pendientes')) {
        const almacen = base.createObjectStore('movimientos-pendientes', {
          keyPath: 'id',
        })
        almacen.createIndex('por-estado', 'estado')
        almacen.createIndex('por-palet', 'paletId')
      }

      if (!base.objectStoreNames.contains('cache-consultas')) {
        base.createObjectStore('cache-consultas')
      }
    },
  })

  return promesaDeBase
}

/** `true` si el navegador puede guardar cosas localmente. */
export function hayAlmacenamientoLocal(): boolean {
  return typeof indexedDB !== 'undefined'
}
