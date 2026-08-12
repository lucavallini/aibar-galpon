import { useNavigate } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Icono, type NombreIcono } from '@/components/ui/Icono'
import { cx } from '@/lib/cx'
import { RUTAS } from '@/rutas'

/**
 * Inicio del operario.
 *
 * Se usa con guantes y a veces con una mano ocupada, así que los objetivos son
 * grandes y están separados: equivocarse de botón acá cuesta tiempo.
 *
 * El orden es el del día de trabajo, no el del menú. Escanear es lo que más se
 * hace, cargar un palet pasa cuando llega mercadería, y agregar producto o
 * cliente son excepciones: por eso los últimos dos quedan abajo, agrupados y
 * más contenidos.
 */

interface PropsAcceso {
  icono: NombreIcono
  titulo: string
  descripcion: string
  onClick: () => void
  destacado?: boolean
}

function Acceso({ icono, titulo, descripcion, onClick, destacado = false }: PropsAcceso) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors',
        destacado
          ? 'border-marca-700 bg-marca-700 hover:bg-marca-800'
          : 'border-piedra-200 bg-white hover:border-piedra-300 hover:bg-piedra-50',
      )}
    >
      <span
        className={cx(
          'flex size-11 shrink-0 items-center justify-center rounded-md',
          destacado ? 'bg-marca-800 text-marca-100' : 'bg-piedra-100 text-piedra-600',
        )}
      >
        <Icono nombre={icono} tamaño={22} />
      </span>

      <span className="min-w-0">
        <span
          className={cx(
            'block text-base font-semibold',
            destacado ? 'text-white' : 'text-piedra-900',
          )}
        >
          {titulo}
        </span>
        <span
          className={cx('block text-sm', destacado ? 'text-marca-100' : 'text-piedra-500')}
        >
          {descripcion}
        </span>
      </span>
    </button>
  )
}

export function InicioOperario() {
  const navegar = useNavigate()
  const { perfil } = useAuth()

  return (
    <div className="flex flex-col gap-5">
      {perfil !== null && (
        <p className="text-lg text-piedra-700">
          Hola, <span className="font-semibold text-piedra-900">{perfil.nombre}</span>.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Acceso
          destacado
          icono="escanear"
          titulo="Escanear QR"
          descripcion="Leé la etiqueta de un palet para ver su stock"
          onClick={() => navegar(RUTAS.escanear)}
        />

        <Acceso
          icono="buscar"
          titulo="Buscar palet"
          descripcion="Si la etiqueta no se puede escanear, buscalo por número o lote"
          onClick={() => navegar(RUTAS.buscarPalets)}
        />

        <Acceso
          icono="palet"
          titulo="Cargar palet nuevo"
          descripcion="Dar de alta mercadería que acaba de llegar"
          onClick={() => navegar(RUTAS.nuevoPalet)}
        />
      </div>

      <div>
        <p className="rotulo mb-2">Catálogo</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Acceso
            icono="producto"
            titulo="Agregar producto"
            descripcion="Uno que todavía no esté cargado"
            onClick={() => navegar(RUTAS.nuevoProducto)}
          />
          <Acceso
            icono="cliente"
            titulo="Agregar cliente"
            descripcion="Empresas que guardan mercadería acá"
            onClick={() => navegar(RUTAS.nuevoCliente)}
          />
        </div>
      </div>
    </div>
  )
}
