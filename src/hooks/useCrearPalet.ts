import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  crearLoteDePalets,
  crearPalet,
  type DatosNuevoLote,
  type DatosNuevoPalet,
} from '@/lib/queries/palets'
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
      // Un palet que se vacía o se da de baja libera su sector: si la
      // ocupación no se refresca, el alta siguiente no ofrecería ese lugar.
      void clienteDeQueries.invalidateQueries({ queryKey: claves.sectores.todos })
    },
  })
}

/**
 * Alta de un lote entero: varios palets del mismo producto y el mismo lote.
 *
 * Devuelve los N creados, en orden, que es lo que la pantalla siguiente
 * necesita para mostrar los QR listos para imprimir.
 */
export function useCrearLoteDePalets() {
  const clienteDeQueries = useQueryClient()

  return useMutation<Palet[], Error, DatosNuevoLote>({
    mutationFn: crearLoteDePalets,
    onSuccess: () => {
      void clienteDeQueries.invalidateQueries({ queryKey: claves.palets.todos })
      // Estos nacen sin sector, así que la ocupación no cambia. Se invalida
      // igual: la pantalla del lote y el buscador comparten esa caché, y un
      // sector liberado en el medio dejaría el selector desactualizado.
      void clienteDeQueries.invalidateQueries({ queryKey: claves.sectores.todos })
    },
  })
}
