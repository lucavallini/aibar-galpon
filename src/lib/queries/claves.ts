import type { Categoria, EstadoPalet, Galpon } from '@/types'

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
  numero?: string
  lote?: string
  sector?: string
  producto?: string
  galpon?: Galpon
  categoria?: Categoria
  /** Empresa dueña de la mercadería; `'propia'` = AIBAR. */
  clienteId?: number | 'propia'
  soloConStock?: boolean
  soloSinUbicar?: boolean
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
    /** Los palets de un lote recién creado, por sus números. */
    porIds: (ids: number[]) => [...claves.palets.todos, 'porIds', ids] as const,
  },

  clientes: {
    todos: ['clientes'] as const,
    lista: () => [...claves.clientes.todos, 'lista'] as const,
  },

  transportistas: {
    todos: ['transportistas'] as const,
    lista: () => [...claves.transportistas.todos, 'lista'] as const,
  },

  empresasDeTransporte: {
    todos: ['empresasDeTransporte'] as const,
    lista: () => [...claves.empresasDeTransporte.todos, 'lista'] as const,
  },

  sectores: {
    todos: ['sectores'] as const,
    /**
     * La ocupación se invalida con cada alta, movimiento y baja: un palet que
     * se termina libera su lugar, y ofrecer un sector ocupado haría que el
     * operario cargue todo el formulario para que la base se lo rechace.
     */
    ocupacion: (galpon: Galpon) => [...claves.sectores.todos, 'ocupacion', galpon] as const,
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
