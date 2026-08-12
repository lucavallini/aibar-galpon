import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Icono } from '@/components/ui/Icono'
import { IndicadorConexion } from '@/components/IndicadorConexion'

interface Props {
  titulo: string
}

const ETIQUETA_POR_ROL = {
  operario: 'Operario',
  jefe: 'Administración',
} as const

/**
 * Barra superior: dónde estoy, en qué estado está la conexión, y salir.
 *
 * En el celular la marca no aparece acá —está en la pantalla de login y en el
 * ícono de la app— porque los 375 px de ancho se necesitan enteros para el
 * título y el estado de la conexión, que es lo que hay que poder mirar de reojo
 * mientras se trabaja.
 */
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
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-piedra-200 bg-white px-4 py-2.5 sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-piedra-900">{titulo}</h1>
        <p className="truncate text-xs text-piedra-500">
          {perfil?.nombre ?? usuario?.email}
          {perfil !== null && ` · ${ETIQUETA_POR_ROL[perfil.rol]}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <IndicadorConexion />

        <button
          type="button"
          onClick={manejarSalir}
          disabled={saliendo}
          title="Cerrar sesión"
          className="flex min-h-toque min-w-toque items-center justify-center gap-2 rounded-md border border-piedra-300 px-3 text-sm font-medium text-piedra-700 transition-colors hover:bg-piedra-100 disabled:opacity-50"
        >
          <Icono nombre="salir" tamaño={18} />
          <span className="hidden sm:inline">{saliendo ? 'Saliendo…' : 'Salir'}</span>
          <span className="sr-only sm:hidden">Cerrar sesión</span>
        </button>
      </div>
    </header>
  )
}
