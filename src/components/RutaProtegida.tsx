import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { RUTA_INICIAL_POR_ROL, RUTAS } from '@/rutas'
import type { Rol } from '@/types'

/**
 * Portero de las rutas privadas.
 *
 * Esto es UX, no seguridad: sirve para no mostrarle a alguien pantallas que no
 * le corresponden. La seguridad real la aplican las policies RLS y las funciones
 * de la base, que no confían en nada de lo que decida el navegador. Por eso acá
 * no se replican reglas de permisos: solo se mira el rol para elegir qué
 * renderizar.
 */

interface Props {
  /** Si se indica, solo ese rol entra. Sin indicar, alcanza con estar logueado. */
  rolRequerido?: Rol
  children: ReactNode
}

export function RutaProtegida({ rolRequerido, children }: Props) {
  const { estado, rol } = useAuth()
  const ubicacion = useLocation()

  // Mientras no se sepa si hay sesión no se decide nada. Redirigir acá es
  // exactamente lo que produce el parpadeo al recargar la página.
  if (estado === 'cargando') {
    return <LoadingScreen mensaje="Verificando tu sesión…" />
  }

  if (estado === 'sin-sesion') {
    // Se recuerda a dónde quería ir para devolverlo ahí después del login.
    return (
      <Navigate
        to={RUTAS.login}
        replace
        state={{ desde: ubicacion.pathname + ubicacion.search }}
      />
    )
  }

  if (estado === 'sin-perfil') {
    return <Navigate to={RUTAS.sinAcceso} replace />
  }

  // Rol equivocado: en vez de un cartel de error, se lo manda a su propio inicio.
  if (rolRequerido !== undefined && rol !== rolRequerido) {
    return <Navigate to={rol === null ? RUTAS.sinAcceso : RUTA_INICIAL_POR_ROL[rol]} replace />
  }

  return <>{children}</>
}
