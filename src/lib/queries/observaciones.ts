import { supabase } from '@/lib/supabase'
import { desempaquetar, desempaquetarLista } from '@/lib/queries/errores'
import type { ObservacionConAutor, ObservacionPalet } from '@/types'

/**
 * Bitácora de un palet: qué le fue pasando.
 *
 * Bidones pinchados, envases rotos, humedad. Las notas son **inmutables**, como
 * los movimientos: si una estaba equivocada se agrega otra aclarándolo, y así la
 * bitácora refleja lo que se supo en cada momento en vez de dejar reescribir la
 * historia.
 */

/** Notas de un palet, de la más reciente a la más vieja. */
export async function listarObservaciones(
  paletId: number,
): Promise<ObservacionConAutor[]> {
  const respuesta = await supabase
    .from('observacion_palet')
    .select('*, usuario:usuario_id(id, nombre)')
    .eq('palet_id', paletId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .returns<ObservacionConAutor[]>()

  return desempaquetarLista(respuesta, `listar las observaciones del palet ${paletId}`)
}

export interface DatosObservacion {
  paletId: number
  texto: string
  /**
   * Quien la escribe. La policy exige que coincida con `auth.uid()`: nadie
   * puede dejar una nota firmada por otro.
   */
  usuarioId: string
}

/**
 * Agrega una nota a la bitácora.
 *
 * Se puede en cualquier momento, incluso sobre un palet vacío o dado de baja:
 * anotar qué pasó no cambia el stock.
 *
 * @throws {ErrorSupabase} con el mensaje de la base.
 */
export async function crearObservacion(
  datos: DatosObservacion,
): Promise<ObservacionPalet> {
  const respuesta = await supabase
    .from('observacion_palet')
    .insert({
      palet_id: datos.paletId,
      usuario_id: datos.usuarioId,
      texto: datos.texto.trim(),
    })
    .select()
    .single()

  return desempaquetar(respuesta, 'guardar la observación')
}
