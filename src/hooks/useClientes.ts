import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crearCliente, listarClientes } from '@/lib/queries/clientes'
import { claves } from '@/lib/queries/claves'
import type { Cliente } from '@/types'

/** Clientes cuya mercadería se guarda en el depósito. */
export function useClientes() {
  return useQuery({
    queryKey: claves.clientes.lista(),
    queryFn: listarClientes,
  })
}

/**
 * Alta de un cliente.
 *
 * Invalida la lista al terminar, así el alta de palet lo ofrece enseguida: el
 * caso normal es cargar el cliente justo cuando llega su mercadería.
 */
export function useCrearCliente() {
  const clienteDeQueries = useQueryClient()

  return useMutation<Cliente, Error, string>({
    mutationFn: crearCliente,
    onSuccess: () => {
      void clienteDeQueries.invalidateQueries({ queryKey: claves.clientes.todos })
    },
  })
}
