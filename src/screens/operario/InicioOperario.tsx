import { useNavigate } from 'react-router'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'
import { RUTAS } from '@/rutas'

/**
 * Inicio del operario.
 *
 * Dos accesos y nada más. Se usa con guantes y a veces con una mano ocupada, así
 * que los objetivos son grandes y están separados: equivocarse de botón acá
 * cuesta tiempo. Escanear va primero porque es lo que más se hace en el día.
 */

interface PropsAcceso {
  icono: string
  titulo: string
  descripcion: string
  onClick: () => void
  destacado?: boolean
}

function Acceso({ icono, titulo, descripcion, onClick, destacado = false }: PropsAcceso) {
  return (
    <Card comoBoton onClick={onClick} className={destacado ? 'border-marca-200 bg-marca-50' : undefined}>
      <div className="flex items-center gap-4 py-3">
        <span className="text-4xl" aria-hidden="true">
          {icono}
        </span>
        <div className="min-w-0">
          <p
            className={
              destacado
                ? 'text-xl font-semibold text-marca-900'
                : 'text-xl font-semibold text-neutral-900'
            }
          >
            {titulo}
          </p>
          <p className="mt-0.5 text-base text-neutral-600">{descripcion}</p>
        </div>
      </div>
    </Card>
  )
}

export function InicioOperario() {
  const navegar = useNavigate()
  const { perfil } = useAuth()

  return (
    <div className="flex flex-col gap-4">
      {perfil !== null && (
        <p className="text-base text-neutral-600">Hola, {perfil.nombre}.</p>
      )}

      <Acceso
        destacado
        icono="📷"
        titulo="Escanear QR"
        descripcion="Leé la etiqueta de un palet para ver su stock."
        onClick={() => navegar(RUTAS.escanear)}
      />

      <Acceso
        icono="🔎"
        titulo="Buscar palet"
        descripcion="Si la etiqueta no se puede escanear, buscalo por número o lote."
        onClick={() => navegar(RUTAS.buscarPalets)}
      />

      <Acceso
        icono="📦"
        titulo="Cargar palet nuevo"
        descripcion="Dar de alta mercadería que acaba de llegar."
        onClick={() => navegar(RUTAS.nuevoPalet)}
      />

      <Acceso
        icono="🏢"
        titulo="Agregar cliente"
        descripcion="Empresas cuya mercadería se guarda en el depósito."
        onClick={() => navegar(RUTAS.nuevoCliente)}
      />

      <Acceso
        icono="🏷️"
        titulo="Agregar producto"
        descripcion="Sumar un producto que todavía no está en el sistema."
        onClick={() => navegar(RUTAS.nuevoProducto)}
      />
    </div>
  )
}
