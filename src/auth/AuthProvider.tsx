import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  alCambiarSesion,
  cerrarSesion as cerrarSesionEnSupabase,
  iniciarSesion as iniciarSesionEnSupabase,
  obtenerSesion,
} from '@/lib/queries/sesion'
import { obtenerPerfil } from '@/lib/queries/usuarios'
import { contextoAuth, type ContextoAuth, type EstadoSesion } from '@/auth/contexto'
import type { Usuario } from '@/types'

/**
 * Provider de autenticación: envuelve toda la app y centraliza el estado de sesión.
 *
 * La sesión y el perfil se resuelven en dos pasos separados a propósito. El
 * callback de `onAuthStateChange` no puede hacer `await` de otra llamada a
 * supabase-js sin trabar el cliente, así que ese callback solo guarda la sesión,
 * y un efecto aparte reacciona al cambio de usuario para traer el perfil.
 */

interface Props {
  children: ReactNode
}

/**
 * Perfil junto al usuario al que pertenece.
 *
 * Va emparejado con su `usuarioId` para poder descartarlo al cambiar de usuario
 * derivándolo del render, sin tener que resetearlo con un `setState` dentro del
 * efecto (que provocaría un render en cascada).
 */
interface PerfilCargado {
  usuarioId: string
  /** `null` = se buscó y no hay fila en `usuario`. */
  perfil: Usuario | null
}

export function AuthProvider({ children }: Props) {
  const [sesion, setSesion] = useState<Session | null>(null)
  const [sesionResuelta, setSesionResuelta] = useState(false)
  const [perfilCargado, setPerfilCargado] = useState<PerfilCargado | null>(null)

  // Paso 1: resolver la sesión persistida y quedar escuchando los cambios.
  useEffect(() => {
    let vigente = true

    obtenerSesion()
      .then((sesionInicial) => {
        if (!vigente) return
        setSesion(sesionInicial)
      })
      .catch((error: unknown) => {
        // Un token corrupto en el storage no puede dejar la app colgada en
        // "cargando": se trata como si no hubiera sesión y se sigue al login.
        console.error('[auth] no se pudo recuperar la sesión persistida', error)
        if (!vigente) return
        setSesion(null)
      })
      .finally(() => {
        if (!vigente) return
        setSesionResuelta(true)
      })

    const desuscribir = alCambiarSesion((nuevaSesion) => {
      setSesion(nuevaSesion)
      setSesionResuelta(true)
    })

    return () => {
      vigente = false
      desuscribir()
    }
  }, [])

  const usuarioId = sesion?.user.id ?? null

  // Paso 2: traer el perfil del usuario logueado, fuera del callback de sesión.
  useEffect(() => {
    if (usuarioId === null) return

    let vigente = true

    obtenerPerfil(usuarioId)
      .then((perfil) => {
        if (!vigente) return
        setPerfilCargado({ usuarioId, perfil })
      })
      .catch((error: unknown) => {
        // Sin perfil no se puede decidir el rol. Se cae al estado 'sin-perfil',
        // que muestra un mensaje claro en vez de dejar pasar a ciegas.
        console.error('[auth] no se pudo cargar el perfil del usuario', error)
        if (!vigente) return
        setPerfilCargado({ usuarioId, perfil: null })
      })

    return () => {
      vigente = false
    }
  }, [usuarioId])

  /**
   * Perfil del usuario actual: `undefined` mientras no esté resuelto.
   *
   * Se deriva comparando contra `usuarioId` en lugar de limpiarse en un efecto,
   * así al cambiar de usuario nunca se muestra el perfil del anterior.
   */
  const perfil: Usuario | null | undefined =
    perfilCargado !== null && perfilCargado.usuarioId === usuarioId
      ? perfilCargado.perfil
      : undefined

  const estado = useMemo<EstadoSesion>(() => {
    if (!sesionResuelta) return 'cargando'
    if (sesion === null) return 'sin-sesion'
    if (perfil === undefined) return 'cargando'
    // Un usuario desactivado tiene fila pero RLS le filtra todo lo demás:
    // para la app es lo mismo que no tener perfil.
    if (perfil === null || !perfil.activo) return 'sin-perfil'
    return 'autenticado'
  }, [sesionResuelta, sesion, perfil])

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    // No hace falta setear nada: `onAuthStateChange` avisa del login y el efecto
    // del perfil se dispara solo.
    await iniciarSesionEnSupabase(email, password)
  }, [])

  const cerrarSesion = useCallback(async () => {
    await cerrarSesionEnSupabase()
  }, [])

  const valor = useMemo<ContextoAuth>(
    () => ({
      estado,
      sesion,
      usuario: sesion?.user ?? null,
      perfil: perfil ?? null,
      rol: perfil?.rol ?? null,
      cargando: estado === 'cargando',
      iniciarSesion,
      cerrarSesion,
    }),
    [estado, sesion, perfil, iniciarSesion, cerrarSesion],
  )

  return <contextoAuth.Provider value={valor}>{children}</contextoAuth.Provider>
}
