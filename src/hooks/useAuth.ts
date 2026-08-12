import { use } from 'react'
import { contextoAuth, type ContextoAuth } from '@/auth/contexto'

/**
 * Acceso al estado de sesión: usuario, perfil con su rol, estado de carga y las
 * funciones de login y logout.
 *
 * Es la única forma de leer la sesión desde un componente. Nadie llama a
 * `supabase.auth` por su cuenta.
 */
export function useAuth(): ContextoAuth {
  const contexto = use(contextoAuth)

  if (contexto === null) {
    throw new Error('useAuth necesita estar dentro de <AuthProvider>.')
  }

  return contexto
}
