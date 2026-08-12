import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

/**
 * La cuenta existe en Auth pero no puede operar: o no tiene fila en `usuario`,
 * o la tiene con `activo = false`.
 *
 * Vale la pena distinguirlo del login fallido, porque si no el usuario entraría
 * a una app donde RLS le filtra absolutamente todo y vería pantallas vacías sin
 * ninguna explicación.
 */
export function SinAcceso() {
  const { usuario, cerrarSesion } = useAuth()
  const [saliendo, setSaliendo] = useState(false)

  async function manejarSalir() {
    setSaliendo(true)

    try {
      await cerrarSesion()
    } catch (error: unknown) {
      console.error('[auth] fallo al cerrar sesión', error)
      setSaliendo(false)
    }
  }

  const detalleCuenta =
    usuario?.email !== undefined ? ` (${usuario.email})` : ''

  return (
    <main className="flex h-full items-center justify-center overflow-y-auto bg-piedra-100">
      <EmptyState
        titulo="Cuenta sin acceso"
        descripcion={`Tu cuenta${detalleCuenta} está registrada pero todavía no está habilitada para usar el sistema. Pedile al encargado del depósito que la active.`}
        accion={
          <Button variante="secundario" onClick={manejarSalir} cargando={saliendo}>
            {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
          </Button>
        }
      />
    </main>
  )
}
