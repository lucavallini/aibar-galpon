import { useInfiniteQuery } from '@tanstack/react-query'
import { buscarPalets, type PaginaDePalets } from '@/lib/queries/palets'
import { claves } from '@/lib/queries/claves'
import { useProductos } from '@/hooks/useProductos'
import type { Categoria, Galpon } from '@/types'

export interface FiltrosDeBusqueda {
  /** Número de palet. Vacío = sin filtrar por número. */
  numero: string
  lote: string
  sector: string
  /** Parte del nombre del producto. */
  producto: string
  galpon?: Galpon
  categoria?: Categoria
  soloConStock: boolean
}

/**
 * Listado de palets con búsqueda y paginación incremental.
 *
 * Cada campo filtra por su cuenta y se combinan con **Y**: quien escribe el
 * lote en una casilla y el sector en otra espera los palets que cumplen las dos
 * cosas, no la suma de ambas búsquedas.
 *
 * El producto y la categoría viven en `producto`, no en `palet`, y PostgREST no
 * filtra por columnas de una tabla embebida. Se resuelven contra el catálogo que
 * ya está en caché —es chico y está descargado— y a la base se le mandan ids.
 */
export function useBuscarPalets(filtros: FiltrosDeBusqueda) {
  const { data: productos } = useProductos()

  const nombreBuscado = filtros.producto.trim().toLocaleLowerCase('es')

  /**
   * Ids que cumplen a la vez el nombre buscado y la categoría.
   *
   * Se cruzan acá y no en la base porque los dos criterios apuntan a la misma
   * columna de `palet` (`producto_id`): mandar dos `in` separados dejaría que el
   * segundo pise al primero.
   */
  const idsDeProducto =
    nombreBuscado === '' && filtros.categoria === undefined
      ? undefined
      : (productos ?? [])
          .filter((producto) => {
            const coincideNombre =
              nombreBuscado === '' ||
              producto.nombre.toLocaleLowerCase('es').includes(nombreBuscado)

            const coincideCategoria =
              filtros.categoria === undefined || producto.categoria === filtros.categoria

            return coincideNombre && coincideCategoria
          })
          .map((producto) => producto.id)

  const numero = /^\d+$/.test(filtros.numero.trim())
    ? Number(filtros.numero.trim())
    : undefined

  return useInfiniteQuery<PaginaDePalets>({
    queryKey: claves.palets.busqueda({
      numero: filtros.numero.trim(),
      lote: filtros.lote.trim(),
      sector: filtros.sector.trim(),
      producto: filtros.producto.trim(),
      galpon: filtros.galpon,
      categoria: filtros.categoria,
      soloConStock: filtros.soloConStock,
    }),
    queryFn: ({ pageParam }) =>
      buscarPalets(
        {
          numero,
          lote: filtros.lote,
          sector: filtros.sector,
          idsDeProducto,
          galpon: filtros.galpon,
          soloConStock: filtros.soloConStock,
        },
        pageParam as number,
      ),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) => (ultima.hayMas ? todas.length : undefined),
    // El catálogo tiene que estar cargado para poder filtrar por producto o
    // categoría; sin él, esa parte de la búsqueda quedaría muda sin avisar.
    enabled: productos !== undefined,
  })
}
