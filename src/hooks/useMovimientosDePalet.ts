import { useQuery } from '@tanstack/react-query'
import { listarMovimientosDePalet } from '@/lib/queries/movimientos'
import { claves } from '@/lib/queries/claves'

/**
 * Historial de movimientos de un palet, del más reciente al más viejo.
 *
 * @param id `null` si la URL no trae un id válido; la consulta queda en pausa.
 */
export function useMovimientosDePalet(id: number | null) {
  return useQuery({
    queryKey: claves.movimientos.dePalet(id ?? 0),
    queryFn: () => listarMovimientosDePalet(id as number),
    enabled: id !== null,
  })
}
