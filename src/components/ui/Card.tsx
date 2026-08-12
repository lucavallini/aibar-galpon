import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/cx'

interface PropsComunes {
  /** Quita el padding interno, para tarjetas que traen su propia estructura. */
  sinPadding?: boolean
  className?: string
  children: ReactNode
}

type PropsEstatica = PropsComunes &
  Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children'> & {
    comoBoton?: false
  }

type PropsInteractiva = PropsComunes &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    /** Renderiza un `<button>` de verdad, no un `<div>` con `onClick`. */
    comoBoton: true
  }

type Props = PropsEstatica | PropsInteractiva

const CLASES_BASE = 'rounded-xl border border-neutral-200 bg-white shadow-sm'

/**
 * Contenedor de contenido.
 *
 * Cuando la tarjeta entera es clickeable —como van a ser las de palet— hay que
 * pasar `comoBoton`, que renderiza un `<button>`. Un `<div>` con `onClick` no
 * se puede enfocar con el teclado ni lo anuncia el lector de pantalla.
 */
export function Card(props: Props) {
  if (props.comoBoton === true) {
    const { comoBoton: _comoBoton, sinPadding, className, children, ...resto } = props

    return (
      <button
        type="button"
        className={cx(
          CLASES_BASE,
          'block w-full min-h-toque text-left transition-colors',
          'hover:border-neutral-300 hover:bg-neutral-50 active:bg-neutral-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-600 focus-visible:ring-offset-2',
          sinPadding !== true && 'p-4',
          className,
        )}
        {...resto}
      >
        {children}
      </button>
    )
  }

  const { comoBoton: _comoBoton, sinPadding, className, children, ...resto } = props

  return (
    <div className={cx(CLASES_BASE, sinPadding !== true && 'p-4', className)} {...resto}>
      {children}
    </div>
  )
}
