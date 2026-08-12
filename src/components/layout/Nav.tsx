import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { cx } from '@/lib/cx'

export interface ItemNav {
  /** Ruta destino. Tiene que existir en `src/rutas.tsx`. */
  a: string
  etiqueta: string
  icono: ReactNode
}

interface Props {
  items: ItemNav[]
  /** `pie` en el celular, `lateral` desde `md`. */
  disposicion: 'pie' | 'lateral'
}

/**
 * Navegación principal.
 *
 * Se renderiza dos veces con distinta disposición —al pie en el celular y al
 * costado en el escritorio— en lugar de una sola que cambie de forma con CSS.
 * Duplicar el marcado permite que cada una tenga la estructura que le sirve; la
 * copia oculta se marca con `aria-hidden` en `Layout` para que el lector de
 * pantalla no anuncie los destinos dos veces.
 */
export function Nav({ items, disposicion }: Props) {
  if (items.length === 0) {
    return null
  }

  const esPie = disposicion === 'pie'

  return (
    <nav
      aria-label="Navegación principal"
      className={cx(
        esPie
          ? // Fija al pie, con el margen de la barra gestual del teléfono.
            'sticky bottom-0 z-10 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]'
          : 'w-56 shrink-0 border-r border-neutral-200 bg-white p-3',
      )}
    >
      <ul className={cx(esPie ? 'flex' : 'flex flex-col gap-1')}>
        {items.map((item) => (
          <li key={item.a} className={cx(esPie && 'flex-1')}>
            <NavLink
              to={item.a}
              end
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-2 font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-marca-600',
                  esPie
                    ? 'min-h-toque-holgado flex-col justify-center gap-1 px-1 py-2 text-xs'
                    : 'min-h-toque rounded-lg px-3 py-2 text-base',
                  isActive
                    ? esPie
                      ? 'text-marca-700'
                      : 'bg-marca-50 text-marca-800'
                    : 'text-neutral-600 hover:text-neutral-900',
                )
              }
            >
              <span aria-hidden="true" className="shrink-0">
                {item.icono}
              </span>
              <span className={cx(esPie && 'leading-none')}>{item.etiqueta}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
