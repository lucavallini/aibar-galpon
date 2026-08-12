import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/cx'
import { Spinner } from '@/components/ui/Spinner'

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma'
export type TamañoBoton = 'md' | 'lg'

interface PropsBase extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton
  tamaño?: TamañoBoton
  /** Muestra el spinner y bloquea el botón para evitar el doble envío. */
  cargando?: boolean
  /** Ocupa todo el ancho disponible. En el celular casi siempre conviene. */
  anchoCompleto?: boolean
  children: ReactNode
}

/**
 * Un botón que solo muestra un ícono necesita `aria-label`, porque no tiene
 * texto que el lector de pantalla pueda leer. Los tipos lo exigen en lugar de
 * dejarlo librado a que alguien se acuerde.
 */
type Props =
  | (PropsBase & { iconoSolo: true; 'aria-label': string })
  | (PropsBase & { iconoSolo?: false })

const CLASES_POR_VARIANTE: Record<VarianteBoton, string> = {
  primario:
    'bg-marca-700 text-white hover:bg-marca-800 active:bg-marca-900 disabled:bg-neutral-400',
  secundario:
    'border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200 disabled:text-neutral-400',
  peligro:
    'bg-red-700 text-white hover:bg-red-800 active:bg-red-900 disabled:bg-neutral-400',
  fantasma:
    'text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:text-neutral-400',
}

const CLASES_POR_TAMAÑO: Record<TamañoBoton, string> = {
  md: 'min-h-toque px-4 text-base',
  lg: 'min-h-toque-holgado px-6 text-lg',
}

/**
 * Botón de acción.
 *
 * Nunca baja de 44px de alto: se toca con guantes. El estado de carga bloquea el
 * botón además de mostrarlo, que es lo que evita registrar dos veces el mismo
 * movimiento por un doble toque.
 */
export function Button({
  variante = 'primario',
  tamaño = 'md',
  cargando = false,
  anchoCompleto = false,
  iconoSolo = false,
  disabled,
  className,
  type = 'button',
  children,
  ...resto
}: Props) {
  return (
    <button
      // Sin esto, un botón dentro de un <form> envía el formulario sin querer.
      type={type}
      disabled={disabled === true || cargando}
      aria-busy={cargando || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed',
        CLASES_POR_VARIANTE[variante],
        iconoSolo ? 'aspect-square min-w-toque px-0' : CLASES_POR_TAMAÑO[tamaño],
        anchoCompleto && 'w-full',
        className,
      )}
      {...resto}
    >
      {cargando && <Spinner tamaño="sm" decorativo />}
      {children}
    </button>
  )
}
