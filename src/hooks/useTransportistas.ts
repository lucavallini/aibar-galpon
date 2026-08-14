import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  crearEmpresaDeTransporte,
  crearTransportista,
  listarEmpresasDeTransporte,
  listarTransportistas,
  type DatosNuevoTransportista,
} from '@/lib/queries/transportistas'
import { claves } from '@/lib/queries/claves'
import type { EmpresaTransporte, Transportista } from '@/types'

/** Los choferes en actividad, para elegir en el alta y en las salidas. */
export function useTransportistas() {
  return useQuery({
    queryKey: claves.transportistas.lista(),
    queryFn: listarTransportistas,
  })
}

/** Las empresas de transporte, para el alta de un chofer. */
export function useEmpresasDeTransporte() {
  return useQuery({
    queryKey: claves.empresasDeTransporte.lista(),
    queryFn: listarEmpresasDeTransporte,
  })
}

/** Alta de un chofer nuevo. */
export function useCrearTransportista() {
  const clienteDeQueries = useQueryClient()

  return useMutation<Transportista, Error, DatosNuevoTransportista>({
    mutationFn: crearTransportista,
    onSuccess: () => {
      void clienteDeQueries.invalidateQueries({ queryKey: claves.transportistas.todos })
    },
  })
}

/** Alta de una empresa de transporte. */
export function useCrearEmpresaDeTransporte() {
  const clienteDeQueries = useQueryClient()

  return useMutation<EmpresaTransporte, Error, string>({
    mutationFn: crearEmpresaDeTransporte,
    onSuccess: () => {
      void clienteDeQueries.invalidateQueries({
        queryKey: claves.empresasDeTransporte.todos,
      })
    },
  })
}
