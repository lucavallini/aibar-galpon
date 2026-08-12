import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

export type VarianteBadge = 'neutral' | 'exito' | 'advertencia' | 'peligro' | 'info'

interface Props {
  variante?: VarianteBadge
  children: ReactNode
  className?: string
}

const CLASES_POR_VARIANTE: Record<VarianteBadge, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-300',
  exito: 'bg-marca-100 text-marca-900 border-marca-200',
  advertencia: 'bg-amber-100 text-amber-900 border-amber-300',
  peligro: 'bg-red-100 text-red-900 border-red-300',
  info: 'bg-blue-100 text-blue-900 border-blue-300',
}

/**
 * Etiqueta de estado.
 *
 * Genérico a propósito: no sabe nada de palets. El mapeo de los estados del
 * dominio a estas variantes vive en `EstadoPaletBadge`, que sí conoce el
 * negocio.
 */
export function Badge({ variante = 'neutral', children, className }: Props) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-sm font-semibold whitespace-nowrap',
        CLASES_POR_VARIANTE[variante],
        className,
      )}
    >
      {children}
    </span>
  )
}
