import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  crearObservacion,
  listarObservaciones,
  type DatosObservacion,
} from '@/lib/queries/observaciones'
import { claves } from '@/lib/queries/claves'
import type { ObservacionPalet } from '@/types'

/** Bitácora de un palet. */
export function useObservaciones(paletId: number | null) {
  return useQuery({
    queryKey: claves.observaciones.dePalet(paletId ?? 0),
    queryFn: () => listarObservaciones(paletId as number),
    enabled: paletId !== null,
  })
}

/** Agrega una nota a la bitácora. */
export function useCrearObservacion() {
  const clienteDeQueries = useQueryClient()

  return useMutation<ObservacionPalet, Error, DatosObservacion>({
    mutationFn: crearObservacion,
    onSuccess: (_observacion, datos) => {
      void clienteDeQueries.invalidateQueries({
        queryKey: claves.observaciones.dePalet(datos.paletId),
      })
      // El panel administrativo muestra las notas de cada palet.
      void clienteDeQueries.invalidateQueries({ queryKey: ['gerencia'] })
    },
  })
}
