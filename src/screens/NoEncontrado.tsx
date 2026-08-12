import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { RUTA_INICIAL_POR_ROL, RUTAS } from '@/rutas'

/** URL que no existe. */
export function NoEncontrado() {
  const { rol } = useAuth()
  const navegar = useNavigate()
  const destino = rol === null ? RUTAS.login : RUTA_INICIAL_POR_ROL[rol]

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50">
      <EmptyState
        titulo="Página no encontrada"
        descripcion="La dirección a la que entraste no existe."
        accion={<Button onClick={() => navegar(destino)}>Volver al inicio</Button>}
      />
    </main>
  )
}
