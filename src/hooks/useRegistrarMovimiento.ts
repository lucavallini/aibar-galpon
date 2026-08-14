import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  registrarOEncolar,
  type DatosMovimientoConCola,
  type ResultadoRegistro,
} from '@/offline/registrarConCola'
import { claves } from '@/lib/queries/claves'

/**
 * Registra un movimiento de stock, tolerando que no haya señal.
 *
 * Devuelve dónde terminó: en la base o en la cola local. La pantalla usa ese
 * dato para decirle la verdad al operario — nunca se le muestra un movimiento
 * encolado como si ya se hubiera guardado.
 *
 * La decisión de mandar o encolar la toma `src/offline/`; acá no hay ningún
 * condicional de conexión.
 */
export function useRegistrarMovimiento() {
  const clienteDeQueries = useQueryClient()

  return useMutation<ResultadoRegistro, Error, DatosMovimientoConCola>({
    mutationFn: registrarOEncolar,
    onSuccess: (resultado, datos) => {
      // Solo si entró en la base cambió el stock real. Si quedó encolado, los
      // datos del servidor siguen siendo válidos: todavía no pasó nada allá.
      if (resultado.destino !== 'base') return

      void clienteDeQueries.invalidateQueries({
        queryKey: claves.palets.detalle(datos.paletId),
      })
      void clienteDeQueries.invalidateQueries({
        queryKey: claves.movimientos.dePalet(datos.paletId),
      })
      void clienteDeQueries.invalidateQueries({ queryKey: claves.palets.todos })
      void clienteDeQueries.invalidateQueries({ queryKey: ['gerencia'] })
      // Un palet que se vacía o se da de baja libera su sector: si la
      // ocupación no se refresca, el alta siguiente no ofrecería ese lugar.
      void clienteDeQueries.invalidateQueries({ queryKey: claves.sectores.todos })
    },
  })
}
