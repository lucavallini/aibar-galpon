import { NavLink } from 'react-router'
import { Icono, type NombreIcono } from '@/components/ui/Icono'
import { cx } from '@/lib/cx'

export interface ItemNav {
  /** Ruta destino. Tiene que existir en `src/rutas.tsx`. */
  a: string
  etiqueta: string
  icono: NombreIcono
}

interface Props {
  items: ItemNav[]
  /** `pie` en el celular, `lateral` desde `md`. */
  disposicion: 'pie' | 'lateral'
}

/**
 * Navegación principal.
 *
 * Se renderiza dos veces con distinta disposición —al pie en el celular, al
 * costado en el escritorio— porque son dos estructuras distintas, no la misma
 * doblada con CSS. Solo una está montada a la vez: `Layout` alterna con
 * `hidden`/`md:hidden`, así el lector de pantalla no anuncia los destinos dos
 * veces.
 */
export function Nav({ items, disposicion }: Props) {
  if (items.length === 0) return null

  return disposicion === 'pie' ? <NavPie items={items} /> : <NavLateral items={items} />
}

/**
 * Celular: barra fija al pie, donde llega el pulgar.
 *
 * No lleva `sticky` ni `fixed`: es hermana del contenedor con scroll dentro de
 * un flex de alto completo, así que queda quieta por estructura. Un `fixed` acá
 * volvería a taparle el final del contenido.
 */
function NavPie({ items }: { items: ItemNav[] }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="shrink-0 border-t border-piedra-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {items.map((item) => (
          <li key={item.a} className="flex-1">
            <NavLink
              to={item.a}
              end
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-toque-holgado flex-col items-center justify-center gap-1 px-1 py-2',
                  'text-[0.6875rem] font-medium transition-colors',
                  isActive ? 'text-marca-700' : 'text-piedra-500 active:text-piedra-800',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Marca de posición arriba del ícono: en el pie, un fondo
                      lleno compite con el contenido de la pantalla. */}
                  <span
                    aria-hidden="true"
                    className={cx(
                      'absolute inset-x-3 top-0 h-0.5 rounded-full transition-colors',
                      isActive ? 'bg-marca-700' : 'bg-transparent',
                    )}
                  />
                  <Icono nombre={item.icono} tamaño={22} />
                  <span className="leading-none">{item.etiqueta}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Escritorio: columna oscura a la izquierda.
 *
 * Oscura a propósito. Una barra lateral blanca sobre fondo claro no separa
 * nada: se lee como una lista suelta flotando al costado. El bloque oscuro
 * ancla la pantalla, deja el contenido claro como la única superficie de
 * trabajo, y hace que el destino activo se distinga sin necesidad de más
 * adornos.
 */
function NavLateral({ items }: { items: ItemNav[] }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="flex h-full w-lateral shrink-0 flex-col bg-marca-950"
    >
      <div className="px-5 py-5">
        <p className="text-lg font-bold tracking-tight text-white">AIBAR</p>
        <p className="rotulo mt-0.5 text-marca-300">Depósito</p>
      </div>

      <ul className="flex flex-col gap-0.5 px-3">
        {items.map((item) => (
          <li key={item.a}>
            <NavLink
              to={item.a}
              end
              className={({ isActive }) =>
                cx(
                  'flex min-h-toque items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-marca-800 text-white'
                    : 'text-marca-200 hover:bg-marca-900 hover:text-white',
                )
              }
            >
              <Icono nombre={item.icono} tamaño={19} />
              {item.etiqueta}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
