import { obtenerBase, type MovimientoPendiente } from '@/offline/db'
import type { TipoMovimientoRegistrable } from '@/types'

/**
 * Cola de movimientos esperando conexión.
 *
 * Nada de acá habla con Supabase: solo guarda y lee. Mandarlos es tarea del
 * sincronizador.
 */

/** A quién avisar cuando la cola cambia, para que la UI se actualice sola. */
const oyentes = new Set<() => void>()

export function alCambiarLaCola(callback: () => void): () => void {
  oyentes.add(callback)
  return () => {
    oyentes.delete(callback)
  }
}

function avisar(): void {
  for (const oyente of oyentes) oyente()
}

export interface DatosParaEncolar {
  paletId: number
  tipo: TipoMovimientoRegistrable
  cantidad: number
  paletEtiqueta: string
  unidad: string
}

/** Mete un movimiento en la cola y devuelve cómo quedó guardado. */
export async function encolar(datos: DatosParaEncolar): Promise<MovimientoPendiente> {
  const base = await obtenerBase()

  const pendiente: MovimientoPendiente = {
    // `randomUUID` necesita contexto seguro, que es donde corre la app igual.
    id: crypto.randomUUID(),
    paletId: datos.paletId,
    tipo: datos.tipo,
    cantidad: datos.cantidad,
    paletEtiqueta: datos.paletEtiqueta,
    unidad: datos.unidad,
    creadoEn: Date.now(),
    intentos: 0,
    estado: 'pendiente',
  }

  await base.put('movimientos-pendientes', pendiente)
  avisar()

  return pendiente
}

/** Todo lo que hay en la cola, del más viejo al más nuevo. */
export async function listarPendientes(): Promise<MovimientoPendiente[]> {
  const base = await obtenerBase()
  const todos = await base.getAll('movimientos-pendientes')

  // Se mandan en el orden en que se registraron: si un operario descontó dos
  // veces del mismo palet, el orden importa para que el stock dé bien.
  return todos.sort((a, b) => a.creadoEn - b.creadoEn)
}

/** Los que están listos para mandarse. Los fallidos quedan afuera. */
export async function listarParaSincronizar(): Promise<MovimientoPendiente[]> {
  const todos = await listarPendientes()

  return todos.filter((movimiento) => movimiento.estado === 'pendiente')
}

/** Cuántos hay esperando, sin contar los fallidos. */
export async function contarPendientes(): Promise<number> {
  const base = await obtenerBase()

  return await base.countFromIndex('movimientos-pendientes', 'por-estado', 'pendiente')
}

/** Cuántos fueron rechazados y esperan que el operario decida. */
export async function contarFallidos(): Promise<number> {
  const base = await obtenerBase()

  return await base.countFromIndex('movimientos-pendientes', 'por-estado', 'fallido')
}

/** Si un palet tiene movimientos sin sincronizar: su stock puede cambiar. */
export async function tienePendientes(paletId: number): Promise<boolean> {
  const base = await obtenerBase()
  const delPalet = await base.getAllFromIndex(
    'movimientos-pendientes',
    'por-palet',
    paletId,
  )

  return delPalet.length > 0
}

async function actualizar(
  id: string,
  cambios: Partial<MovimientoPendiente>,
): Promise<void> {
  const base = await obtenerBase()
  const actual = await base.get('movimientos-pendientes', id)

  if (actual === undefined) return

  await base.put('movimientos-pendientes', { ...actual, ...cambios })
  avisar()
}

/** Lo marca como en curso, para que no lo tome otra sincronización a la vez. */
export async function marcarSincronizando(id: string): Promise<void> {
  await actualizar(id, { estado: 'sincronizando', ultimoIntentoEn: Date.now() })
}

/**
 * Lo saca de la cola: la base ya lo aceptó.
 *
 * Recién acá deja de existir localmente. Antes de la confirmación no se borra
 * nada, ni siquiera mientras se está mandando.
 */
export async function quitar(id: string): Promise<void> {
  const base = await obtenerBase()
  await base.delete('movimientos-pendientes', id)
  avisar()
}

/**
 * Lo marca como rechazado, guardando el motivo.
 *
 * **No se borra.** El operario tiene que poder ver qué movimiento no entró y
 * por qué, y decidir si reintentarlo o descartarlo.
 */
export async function marcarFallido(id: string, error: string): Promise<void> {
  const base = await obtenerBase()
  const actual = await base.get('movimientos-pendientes', id)

  if (actual === undefined) return

  await base.put('movimientos-pendientes', {
    ...actual,
    estado: 'fallido',
    error,
    intentos: actual.intentos + 1,
    ultimoIntentoEn: Date.now(),
  })

  avisar()
}

/** Lo devuelve a la cola para que el próximo intento lo tome. */
export async function reintentar(id: string): Promise<void> {
  await actualizar(id, { estado: 'pendiente', error: undefined })
}

/**
 * Lo devuelve a «pendiente» sin contarlo como fallido.
 *
 * Es para cuando se corta la conexión a mitad de la sincronización: no fue la
 * base la que lo rechazó, así que no corresponde marcarlo como fallido ni
 * gastarle un intento.
 */
export async function devolverAPendiente(id: string): Promise<void> {
  await actualizar(id, { estado: 'pendiente' })
}
