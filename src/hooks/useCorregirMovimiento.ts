import { useMutation, useQueryClient } from '@tanstack/react-query'
import { corregirMovimiento, type DatosCorreccion } from '@/lib/queries/movimientos'
import { claves } from '@/lib/queries/claves'
import type { Movimiento } from '@/types'

/**
 * Deshace el último movimiento de un palet.
 *
 * Al terminar invalida el palet y su historial: el stock volvió atrás y hay un
 * movimiento nuevo, el de tipo `correccion`, que tiene que aparecer en la lista.
 */
export function useCorregirMovimiento() {
  const clienteDeQueries = useQueryClient()

  return useMutation<Movimiento, Error, DatosCorreccion>({
    mutationFn: corregirMovimiento,
    onSuccess: (_correccion, datos) => {
      void clienteDeQueries.invalidateQueries({
        queryKey: claves.palets.detalle(datos.paletId),
      })
      void clienteDeQueries.invalidateQueries({
        queryKey: claves.movimientos.dePalet(datos.paletId),
      })
      void clienteDeQueries.invalidateQueries({ queryKey: claves.palets.todos })
    },
  })
}
