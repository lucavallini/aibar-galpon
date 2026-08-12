import { QueryClient } from '@tanstack/react-query'

/**
 * Cliente de React Query.
 *
 * Configurado pensando en la señal del depósito, que es mala: reintentar tres
 * veces —el valor por omisión— solo alarga la espera antes de mostrar el error,
 * y el operario prefiere enterarse rápido y volver a intentar él.
 *
 * Las mutaciones no reintentan nunca: dar de alta un palet no es idempotente y
 * un reintento automático podría duplicarlo.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // El catálogo y los listados no cambian de un segundo al otro.
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})
