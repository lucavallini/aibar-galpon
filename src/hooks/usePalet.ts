import { useQuery } from '@tanstack/react-query'
import { listarPaletsPorIds, obtenerPalet } from '@/lib/queries/palets'
import { claves } from '@/lib/queries/claves'

/**
 * Un palet con su producto y su detalle.
 *
 * @param id `null` mientras no haya un id válido — por ejemplo, si el parámetro
 * de la URL no es un número. La consulta queda en pausa en vez de dispararse
 * con un id inventado.
 */
export function usePalet(id: number | null) {
  return useQuery({
    queryKey: claves.palets.detalle(id ?? 0),
    queryFn: () => obtenerPalet(id as number),
    enabled: id !== null,
  })
}

/**
 * Varios palets a la vez, para la pantalla de un lote recién creado.
 *
 * Una sola consulta y no una por palet: son hasta cincuenta, y cincuenta viajes
 * para dibujar una lista dejarían la pantalla cargando a pedazos.
 */
export function usePaletsPorIds(ids: number[]) {
  return useQuery({
    queryKey: claves.palets.porIds(ids),
    queryFn: () => listarPaletsPorIds(ids),
    enabled: ids.length > 0,
  })
}
