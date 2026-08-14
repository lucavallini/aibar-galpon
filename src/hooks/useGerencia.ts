import { useQueries, useQuery } from '@tanstack/react-query'
import {
  contarPorPregunta,
  listarPaletsGerencia,
  listarStockPorProducto,
  obtenerPaletGerencia,
  type FiltrosGerencia,
  type PreguntaDeNegocio,
} from '@/lib/queries/gerencia'

/**
 * Datos del panel administrativo.
 *
 * Todo lectura: el jefe no escribe nada, así que acá no hay ninguna mutación.
 */

const CLAVE_GERENCIA = ['gerencia'] as const

/** Palets según la pregunta de negocio elegida y los filtros. */
export function usePaletsGerencia(filtros: FiltrosGerencia) {
  return useQuery({
    queryKey: [...CLAVE_GERENCIA, 'palets', filtros],
    queryFn: () => listarPaletsGerencia(filtros),
  })
}

/** Stock consolidado por producto. */
export function useStockPorProducto() {
  return useQuery({
    queryKey: [...CLAVE_GERENCIA, 'stock-por-producto'],
    queryFn: listarStockPorProducto,
  })
}

/** Un palet del panel. */
export function usePaletGerencia(id: number | null) {
  return useQuery({
    queryKey: [...CLAVE_GERENCIA, 'palet', id],
    queryFn: () => obtenerPaletGerencia(id as number),
    enabled: id !== null,
  })
}

/** Preguntas que se muestran como tarjeta de alerta arriba del listado. */
const PREGUNTAS_CON_ALERTA: PreguntaDeNegocio[] = [
  'vencidos',
  'vence-6-meses',
  'con-novedades',
  'sin-movimiento',
  'parciales',
]

/**
 * Cuántos palets caen en cada situación.
 *
 * Van como consultas separadas y con `head: true`: cada una devuelve solo un
 * número, sin traer una sola fila. Es más barato que bajar el depósito entero
 * para contarlo en el navegador, y cada tarjeta aparece apenas está lista.
 */
export function useAlertas() {
  const resultados = useQueries({
    queries: PREGUNTAS_CON_ALERTA.map((pregunta) => ({
      queryKey: [...CLAVE_GERENCIA, 'conteo', pregunta],
      queryFn: () => contarPorPregunta(pregunta),
    })),
  })

  return PREGUNTAS_CON_ALERTA.map((pregunta, indice) => ({
    pregunta,
    cantidad: resultados[indice]?.data ?? 0,
    cargando: resultados[indice]?.isPending ?? true,
  }))
}

/** Clave raíz, para invalidar todo el panel de una. */
export { CLAVE_GERENCIA }
