import { useQuery } from '@tanstack/react-query'
import { listarProductos } from '@/lib/queries/productos'
import { claves } from '@/lib/queries/claves'

/**
 * Catálogo de productos, ordenado por nombre.
 *
 * Es lo primero que necesita el alta de palet: la categoría del producto elegido
 * decide qué campos específicos se piden.
 */
export function useProductos() {
  return useQuery({
    queryKey: claves.productos.lista(),
    queryFn: listarProductos,
  })
}
