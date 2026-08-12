import { useMutation, useQueryClient } from '@tanstack/react-query'
import { crearPalet, type DatosNuevoPalet } from '@/lib/queries/palets'
import { claves } from '@/lib/queries/claves'
import type { Palet } from '@/types'

/**
 * Alta de un palet con su detalle.
 *
 * Devuelve el palet creado, con el `id` que necesita la pantalla siguiente para
 * mostrarlo y —más adelante— generar su QR.
 */
export function useCrearPalet() {
  const clienteDeQueries = useQueryClient()

  return useMutation<Palet, Error, DatosNuevoPalet>({
    mutationFn: crearPalet,
    onSuccess: () => {
      // Los listados quedaron viejos: hay un palet más.
      //
      // No se siembra la caché del detalle con lo que devuelve la RPC: la
      // función devuelve la fila de `palet` pelada, y la pantalla de detalle
      // espera el palet con su producto y su detalle resueltos. Sembrarla con
      // la forma incompleta rompería esa pantalla.
      void clienteDeQueries.invalidateQueries({ queryKey: claves.palets.todos })
    },
  })
}
