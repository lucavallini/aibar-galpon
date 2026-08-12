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
        'block w-full min-h-toque rounded-md border bg-white px-3 py-2.5 text-base text-piedra-900',
        'placeholder:text-piedra-400',
        'focus:outline-none focus:ring-2',
        invalido
          ? 'border-red-500 focus:border-red-600 focus:ring-red-500/30'
          : 'border-piedra-300 focus:border-marca-600 focus:ring-marca-600/30',
        'disabled:cursor-not-allowed disabled:bg-piedra-100 disabled:text-piedra-500',
        className,
      )}
      {...resto}
    />
  )
}
