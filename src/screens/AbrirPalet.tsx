import { Navigate, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { EmptyState } from '@/components/ui/EmptyState'
import { rutaPalet, rutaPaletGerencia, RUTAS } from '@/rutas'

/**
 * Destino de los QR impresos: `/p/152`.
 *
 * Es la dirección que queda pegada al palet, así que tiene que sobrevivir a
 * cualquier reorganización interna de rutas. Por eso no muestra nada por su
 * cuenta: resuelve a dónde mandar a quien escaneó y se corre del medio.
 *
 * Quien no tenga sesión pasa por el login y vuelve acá solo, gracias al
 * `desde` que ya maneja `RutaProtegida`.
 */
export function AbrirPalet() {
  const { id } = useParams<{ id: string }>()
  const { estado, rol } = useAuth()

  const idNumerico = id !== undefined && /^\d+$/.test(id) ? Number(id) : null

  if (idNumerico === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-50">
        <EmptyState
          titulo="Código QR no válido"
          descripcion="Este código no corresponde a ningún palet. Puede estar dañado o pertenecer a otro sistema."
        />
      </main>
    )
  }

  // Sin esperar a saber si hay sesión, se mandaría al login a alguien que ya
  // está logueado.
  if (estado === 'cargando') {
    return <LoadingScreen mensaje="Abriendo el palet…" />
  }

  if (estado === 'sin-perfil') {
    return <Navigate to={RUTAS.sinAcceso} replace />
  }

  if (estado === 'sin-sesion') {
    return (
      <Navigate to={RUTAS.login} replace state={{ desde: rutaPalet(idNumerico) }} />
    )
  }

  // Cada rol va a su propia vista del mismo palet: el operario a la que puede
  // operar, el jefe a la de solo lectura.
  return (
    <Navigate
      to={rol === 'jefe' ? rutaPaletGerencia(idNumerico) : rutaPalet(idNumerico)}
      replace
    />
  )
}
