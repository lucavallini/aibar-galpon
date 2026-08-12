import { useMutation, useQueryClient } from '@tanstack/react-query'
import { crearProducto, type DatosNuevoProducto } from '@/lib/queries/productos'
import { claves } from '@/lib/queries/claves'
import type { Producto } from '@/types'

/**
 * Alta de un producto en el catálogo.
 *
 * Al terminar invalida la lista, así el alta de palet ofrece el producto recién
 * creado sin necesidad de recargar la app: es el caso normal, porque se suele
 * cargar el producto justo cuando llega mercadería que todavía no estaba.
 */
export function useCrearProducto() {
  const clienteDeQueries = useQueryClient()

  return useMutation<Producto, Error, DatosNuevoProducto>({
    mutationFn: crearProducto,
    onSuccess: () => {
      void clienteDeQueries.invalidateQueries({ queryKey: claves.productos.todos })
    },
  })
}
