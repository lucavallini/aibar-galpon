import type { EstadoPalet, Galpon } from '@/types'

/**
 * Claves de React Query, centralizadas.
 *
 * Escribir los arrays sueltos en cada hook es la forma más rápida de terminar
 * con una caché que no se puede invalidar, porque la clave que usó el `useQuery`
 * y la que usa el `invalidateQueries` dejaron de coincidir. Acá se definen una
 * sola vez y se derivan unas de otras: invalidar `claves.palets.todos` alcanza
 * los listados y los detalles de abajo.
 */

interface FiltrosPaletClave {
  galpon?: Galpon
  estado?: EstadoPalet
  productoId?: number
}

interface FiltrosBusquedaClave {
  texto?: string
  galpon?: Galpon
  soloConStock?: boolean
}

export const claves = {
  productos: {
    todos: ['productos'] as const,
    lista: () => [...claves.productos.todos, 'lista'] as const,
  },

  palets: {
    todos: ['palets'] as const,
    lista: (filtros: FiltrosPaletClave = {}) =>
      [...claves.palets.todos, 'lista', filtros] as const,
    busqueda: (filtros: FiltrosBusquedaClave = {}) =>
      [...claves.palets.todos, 'busqueda', filtros] as const,
    detalle: (id: number) => [...claves.palets.todos, 'detalle', id] as const,
  },

  clientes: {
    todos: ['clientes'] as const,
    lista: () => [...claves.clientes.todos, 'lista'] as const,
  },

  movimientos: {
    todos: ['movimientos'] as const,
    dePalet: (paletId: number) =>
      [...claves.movimientos.todos, 'de-palet', paletId] as const,
  },

  observaciones: {
    todas: ['observaciones'] as const,
    dePalet: (paletId: number) =>
      [...claves.observaciones.todas, 'de-palet', paletId] as const,
  },
} as const
