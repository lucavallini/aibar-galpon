import { useInfiniteQuery } from '@tanstack/react-query'
import { buscarPalets, type PaginaDePalets } from '@/lib/queries/palets'
import { claves } from '@/lib/queries/claves'
import { useProductos } from '@/hooks/useProductos'
import type { Galpon } from '@/types'

export interface FiltrosDeBusqueda {
  texto: string
  galpon?: Galpon
  soloConStock: boolean
}

/**
 * Listado de palets con búsqueda y paginación incremental.
 *
 * El texto busca en tres lados: número de palet, lote y nombre de producto. Los
 * dos primeros son columnas de `palet` y los resuelve la base; el tercero se
 * resuelve acá, filtrando el catálogo que ya está en caché.
 *
 * Ese rodeo tiene una razón: PostgREST no admite un `or` que mezcle columnas
 * propias con columnas de una tabla embebida. Como el catálogo es chico y ya
 * está descargado, buscar en él es instantáneo y evita una segunda consulta.
 */
export function useBuscarPalets(filtros: FiltrosDeBusqueda) {
  const { data: productos } = useProductos()

  const texto = filtros.texto.trim().toLocaleLowerCase('es')

  const idsDeProducto =
    texto === ''
      ? []
      : (productos ?? [])
          .filter((producto) =>
            producto.nombre.toLocaleLowerCase('es').includes(texto),
          )
          .map((producto) => producto.id)

  return useInfiniteQuery<PaginaDePalets>({
    queryKey: claves.palets.busqueda({
      texto: filtros.texto.trim(),
      galpon: filtros.galpon,
      soloConStock: filtros.soloConStock,
    }),
    queryFn: ({ pageParam }) =>
      buscarPalets(
        {
          texto: filtros.texto,
          galpon: filtros.galpon,
          soloConStock: filtros.soloConStock,
          idsDeProducto,
        },
        pageParam as number,
      ),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) => (ultima.hayMas ? todas.length : undefined),
    // El catálogo tiene que estar cargado para poder buscar por producto; sin
    // él, esa parte de la búsqueda quedaría muda sin avisar.
    enabled: productos !== undefined,
  })
}
