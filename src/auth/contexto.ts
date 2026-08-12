import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Rol, Usuario } from '@/types'

/**
 * Definición del contexto de autenticación.
 *
 * Vive separado del provider a propósito: si el archivo de un componente exporta
 * además cosas que no son componentes, se rompe el fast refresh de Vite.
 */

/**
 * En qué punto está la resolución de la sesión.
 *
 * - `cargando`: todavía no se sabe. Es el estado inicial de cada recarga de
 *   página, mientras Supabase rehidrata el token. **Nunca redirigir en este
 *   estado**: es justamente lo que causa el parpadeo hacia el login.
 * - `sin-sesion`: no hay nadie logueado.
 * - `autenticado`: hay sesión y perfil con rol.
 * - `sin-perfil`: hay sesión válida pero la tabla `usuario` no tiene fila para
 *   ella, o la tiene con `activo = false`. La cuenta no puede operar: RLS le va
 *   a filtrar todo, así que conviene decirlo explícitamente en vez de mostrar
 *   pantallas vacías.
 */
export type EstadoSesion = 'cargando' | 'sin-sesion' | 'autenticado' | 'sin-perfil'

export interface ContextoAuth {
  estado: EstadoSesion
  /** Sesión de Supabase Auth, o `null`. */
  sesion: Session | null
  /** Usuario de `auth.users`: trae el email. */
  usuario: User | null
  /** Fila de la tabla `usuario`: trae el nombre y el rol. */
  perfil: Usuario | null
  /** Atajo de `perfil?.rol`, que es lo que deciden las rutas. */
  rol: Rol | null
  /** `true` mientras no se sepa si hay sesión. Atajo de `estado === 'cargando'`. */
  cargando: boolean
  /** @throws {ErrorAutenticacion} con un mensaje ya en español. */
  iniciarSesion: (email: string, password: string) => Promise<void>
  cerrarSesion: () => Promise<void>
}

export const contextoAuth = createContext<ContextoAuth | null>(null)
