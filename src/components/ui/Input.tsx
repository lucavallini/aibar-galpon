import type { InputHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  /** Pinta el borde de error. Lo pasa `Field`; no hace falta setearlo a mano. */
  invalido?: boolean
}

/**
 * Campo de texto, sin label.
 *
 * El label, la ayuda y el mensaje de error los pone `Field`, que además se
 * encarga de asociarlos por `id` y `aria-describedby`.
 *
 * `text-base` (16px) no es decorativo: con una tipografía más chica, Safari en
 * iOS hace zoom automático al enfocar el campo y descoloca toda la pantalla.
 */
export function Input({ invalido = false, className, ...resto }: Props) {
  return (
    <input
      aria-invalid={invalido || undefined}
      className={cx(
        'block w-full min-h-toque rounded-lg border bg-white px-3 py-2.5 text-base text-neutral-900',
        'placeholder:text-neutral-400',
        'focus:outline-none focus:ring-2',
        invalido
          ? 'border-red-500 focus:border-red-600 focus:ring-red-500/30'
          : 'border-neutral-300 focus:border-marca-600 focus:ring-marca-600/30',
        'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500',
        className,
      )}
      {...resto}
    />
  )
}
