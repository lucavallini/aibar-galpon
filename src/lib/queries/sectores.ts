import { supabase } from '@/lib/supabase'
import { desempaquetar, desempaquetarLista, ErrorSupabase } from '@/lib/queries/errores'
import type { Galpon, Sector, SectorDisponible, SectorInsert } from '@/types'

/**
 * Los sectores del depósito.
 *
 * Un sector es un **lugar físico**: ahí entra un palet y no dos. Antes era
 * texto libre escrito en cada alta, y eso permitía las dos cosas que esta capa
 * viene a cerrar: que dos palets quedaran en el mismo lugar, y que 'A7', 'a7' y
 * 'A-7' fueran tres lugares distintos para la base y el mismo estante en el
 * galpón.
 *
 * La exclusión no se decide acá: la garantiza el índice único
 * `palet_sector_ocupado_unico`. Lo de este archivo es solo poder ofrecer la
 * lista correcta.
 */

/** Todos los sectores en uso de un galpón, ordenados como se leen en el estante. */
export async function listarSectores(galpon: Galpon): Promise<Sector[]> {
  const respuesta = await supabase
    .from('sector')
    .select('*')
    .eq('galpon', galpon)
    .eq('activo', true)
    .order('nombre')

  return desempaquetarLista(respuesta, `listar los sectores del galpón ${galpon}`)
}

/**
 * Los sectores de un galpón con quién los está ocupando.
 *
 * El cruce lo resuelve `vista_sector_disponible` en Postgres. Hacerlo en el
 * navegador obligaría a bajarse todos los palets del depósito en cada alta.
 */
export async function listarSectoresConOcupacion(
  galpon: Galpon,
): Promise<SectorDisponible[]> {
  const respuesta = await supabase
    .from('vista_sector_disponible')
    .select('*')
    .eq('galpon', galpon)
    .eq('activo', true)
    .order('nombre')

  return desempaquetarLista(respuesta, `ver la ocupación del galpón ${galpon}`)
}

/**
 * Da de alta un sector.
 *
 * Lo hace el operario, igual que con productos y clientes: si llega mercadería
 * y el lugar donde la ponen no está cargado, tiene que poder cargarlo en el
 * momento. Esperar a que se lo habiliten lo deja con el palet en la mano.
 *
 * El nombre es único por galpón sin distinguir mayúsculas ni espacios, y eso lo
 * impone un índice de la base: dos operarios cargando 'A7' y 'a7' a la vez no
 * pueden crear dos.
 *
 * @throws {ErrorSupabase} con el mensaje de la base.
 */
export async function crearSector(galpon: Galpon, nombre: string): Promise<Sector> {
  const nuevo: SectorInsert = { galpon, nombre: nombre.trim() }

  const respuesta = await supabase.from('sector').insert(nuevo).select().single()

  return desempaquetar(respuesta, 'crear el sector')
}

/**
 * Saca un sector de circulación sin borrarlo.
 *
 * Borrarlo rompería el historial: los palets que pasaron por ahí lo referencian,
 * y la base lo impide con `ON DELETE RESTRICT`. Desactivado deja de ofrecerse en
 * las altas pero se sigue leyendo en los palets viejos.
 */
export async function desactivarSector(id: number): Promise<void> {
  const { error } = await supabase.from('sector').update({ activo: false }).eq('id', id)

  if (error !== null) {
    throw new ErrorSupabase('desactivar el sector', error)
  }
}

/** Renombra un sector. El cambio se refleja solo en todos sus palets. */
export async function renombrarSector(id: number, nombre: string): Promise<void> {
  const { error } = await supabase
    .from('sector')
    .update({ nombre: nombre.trim() })
    .eq('id', id)

  if (error !== null) {
    throw new ErrorSupabase('renombrar el sector', error)
  }
}
