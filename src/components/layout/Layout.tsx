import { Outlet } from 'react-router'
import { Header } from '@/components/layout/Header'
import { Nav, type ItemNav } from '@/components/layout/Nav'

interface Props {
  titulo: string
  items?: ItemNav[]
}

/**
 * Estructura de las pantallas privadas.
 *
 * **El scroll vive en el `<main>`, nunca en el documento.** Esa es la regla que
 * sostiene todo el layout: el header y la navegación quedan quietos mientras se
 * recorre una lista larga, en vez de irse hacia arriba.
 *
 * Para que funcione, la cadena de alturas tiene que estar completa:
 * `html`, `body` y `#root` al 100% —declarados en `index.css`— y este contenedor
 * en `h-full`. Con `h-dvh` acá, el layout medía el viewport dinámico mientras el
 * body medía el inicial, y en el celular esos dos valores se separan cuando
 * aparece la barra de direcciones: esa diferencia es la que hacía scrollear el
 * documento y llevarse la barra inferior.
 *
 * En el celular la navegación va al pie, donde llega el pulgar; desde `md` pasa
 * a una columna a la izquierda.
 */
export function Layout({ titulo, items = [] }: Props) {
  return (
    <div className="flex h-full overflow-hidden bg-piedra-100">
      {/* Escritorio: columna fija a la izquierda. */}
      <div className="hidden md:block">
        <Nav items={items} disposicion="lateral" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header titulo={titulo} />

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
            <Outlet />
          </div>
        </main>

        {/* Celular: barra al pie. Queda quieta por estructura, sin `fixed`. */}
        <div className="md:hidden">
          <Nav items={items} disposicion="pie" />
        </div>
      </div>
    </div>
  )
}
