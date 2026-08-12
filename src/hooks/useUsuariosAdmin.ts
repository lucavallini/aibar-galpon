import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cambiarActivo,
  cambiarRol,
  crearUsuario,
  listarUsuarios,
  type DatosNuevoUsuario,
} from '@/lib/queries/usuariosAdmin'
import type { Rol, Usuario } from '@/types'

/** Administración de usuarios. Solo funciona para el gerente. */

const CLAVE_USUARIOS = ['usuarios-admin'] as const

export function useUsuarios() {
  return useQuery({
    queryKey: CLAVE_USUARIOS,
    queryFn: listarUsuarios,
  })
}

export function useCambiarRol() {
  const clienteDeQueries = useQueryClient()

  return useMutation<void, Error, { usuarioId: string; rol: Rol }>({
    mutationFn: ({ usuarioId, rol }) => cambiarRol(usuarioId, rol),
    onSuccess: () => {
      void clienteDeQueries.invalidateQueries({ queryKey: CLAVE_USUARIOS })
    },
  })
}

export function useCambiarActivo() {
  const clienteDeQueries = useQueryClient()

  return useMutation<void, Error, { usuarioId: string; activo: boolean }>({
    mutationFn: ({ usuarioId, activo }) => cambiarActivo(usuarioId, activo),
    onSuccess: () => {
      void clienteDeQueries.invalidateQueries({ queryKey: CLAVE_USUARIOS })
    },
  })
}

export function useCrearUsuario() {
  const clienteDeQueries = useQueryClient()

  return useMutation<void, Error, DatosNuevoUsuario>({
    mutationFn: crearUsuario,
    onSuccess: () => {
      void clienteDeQueries.invalidateQueries({ queryKey: CLAVE_USUARIOS })
    },
  })
}

export type { Usuario }
