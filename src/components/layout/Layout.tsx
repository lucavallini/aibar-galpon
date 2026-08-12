import { Outlet } from 'react-router'
import { Header } from '@/components/layout/Header'
import { Nav, type ItemNav } from '@/components/layout/Nav'

interface Props {
  titulo: string
  /**
   * Destinos de la navegación. Solo se pasan rutas que ya existen: cada fase
   * suma las suyas. Con la lista vacía la navegación no se renderiza y el
   * contenido ocupa todo el ancho, que es el caso mientras haya un solo destino
   * por rol.
   */
  items?: ItemNav[]
}

/**
 * Estructura de las pantallas privadas.
 *
 * Mobile-first: en el celular es header arriba, contenido con scroll y
 * navegación fija al pie, que es donde llega el pulgar. Desde `md` la
 * navegación pasa a una barra lateral y el contenido se limita a un ancho
 * legible, que es la vista del jefe en la computadora.
 *
 * El scroll vive en el `<main>` y no en el documento: así el header y la
 * navegación quedan quietos mientras se recorre una lista larga de palets.
 */
export function Layout({ titulo, items = [] }: Props) {
  return (
    <div className="flex h-dvh flex-col bg-neutral-50">
      <Header titulo={titulo} />

      <div className="flex min-h-0 flex-1">
        {/* Escritorio: navegación al costado. */}
        <div className="hidden md:block">
          <Nav items={items} disposicion="lateral" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl p-4">
              <Outlet />
            </div>
          </main>

          {/* Celular: navegación al pie, al alcance del pulgar. */}
          <div className="md:hidden">
            <Nav items={items} disposicion="pie" />
          </div>
        </div>
      </div>
    </div>
  )
}
