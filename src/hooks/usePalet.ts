import { useQuery } from '@tanstack/react-query'
import { obtenerPalet } from '@/lib/queries/palets'
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
