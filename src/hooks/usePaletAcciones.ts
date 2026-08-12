import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  darDeBajaPalet,
  editarPalet,
  type DatosEdicionPalet,
} from '@/lib/queries/palets'
import { claves } from '@/lib/queries/claves'
import type { Palet } from '@/types'

/**
 * Acciones que corrigen un palet sin tocar su stock.
 *
 * Las dos invalidan el detalle, el historial y los listados: cambian datos que
 * se muestran en todos lados.
 */

function invalidarTodoDelPalet(
  clienteDeQueries: ReturnType<typeof useQueryClient>,
  paletId: number,
) {
  void clienteDeQueries.invalidateQueries({ queryKey: claves.palets.detalle(paletId) })
  void clienteDeQueries.invalidateQueries({ queryKey: claves.palets.todos })
  void clienteDeQueries.invalidateQueries({
    queryKey: claves.observaciones.dePalet(paletId),
  })
  void clienteDeQueries.invalidateQueries({ queryKey: ['gerencia'] })
}

/** Corrige los datos de identificación de un palet. */
export function useEditarPalet() {
  const clienteDeQueries = useQueryClient()

  return useMutation<void, Error, { paletId: number; datos: DatosEdicionPalet }>({
    mutationFn: ({ paletId, datos }) => editarPalet(paletId, datos),
    onSuccess: (_resultado, { paletId }) => invalidarTodoDelPalet(clienteDeQueries, paletId),
  })
}

/** Saca un palet de circulación, dejando el motivo en la bitácora. */
export function useDarDeBajaPalet() {
  const clienteDeQueries = useQueryClient()

  return useMutation<Palet, Error, { paletId: number; motivo: string }>({
    mutationFn: ({ paletId, motivo }) => darDeBajaPalet(paletId, motivo),
    onSuccess: (_palet, { paletId }) => invalidarTodoDelPalet(clienteDeQueries, paletId),
  })
}
