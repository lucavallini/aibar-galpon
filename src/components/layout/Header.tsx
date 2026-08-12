import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { IndicadorConexion } from '@/components/IndicadorConexion'

interface Props {
  titulo: string
}

const ETIQUETA_POR_ROL = {
  operario: 'Operario',
  jefe: 'Gerencia',
} as const

/** Encabezado con el usuario logueado y el botón de salir. */
export function Header({ titulo }: Props) {
  const { perfil, usuario, cerrarSesion } = useAuth()
  const [saliendo, setSaliendo] = useState(false)

  async function manejarSalir() {
    setSaliendo(true)

    try {
      await cerrarSesion()
      // No hace falta navegar: al caer la sesión, las rutas protegidas mandan
      // solas al login.
    } catch (error: unknown) {
      console.error('[auth] fallo al cerrar sesión', error)
      setSaliendo(false)
    }
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-2.5">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-neutral-900">{titulo}</h1>
        <p className="truncate text-sm text-neutral-500">
          {perfil?.nombre ?? usuario?.email}
          {perfil !== null && ` · ${ETIQUETA_POR_ROL[perfil.rol]}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <IndicadorConexion />

        <Button variante="secundario" onClick={manejarSalir} cargando={saliendo}>
          {saliendo ? 'Saliendo…' : 'Salir'}
        </Button>
      </div>
    </header>
  )
}
