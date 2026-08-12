import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  invalido?: boolean
  /** Opción inicial deshabilitada, del estilo "Elegí un producto". */
  placeholder?: string
  children: ReactNode
}

/**
 * Lista desplegable.
 *
 * Es un `<select>` nativo a propósito, no un dropdown propio: en el celular
 * abre el selector a pantalla completa del sistema operativo, que se maneja
 * mucho mejor con guantes que una lista de opciones chiquitas. Además funciona
 * con teclado y lector de pantalla sin que haya que programarlo.
 */
export function Select({
  invalido = false,
  placeholder,
  className,
  defaultValue,
  value,
  children,
  ...resto
}: Props) {
  // Con placeholder, el valor vacío tiene que ser el inicial para que se vea.
  const valorPorDefecto =
    placeholder !== undefined && value === undefined && defaultValue === undefined
      ? ''
      : defaultValue

  return (
    <select
      aria-invalid={invalido || undefined}
      value={value}
      defaultValue={valorPorDefecto}
      className={cx(
        'block w-full min-h-toque appearance-none rounded-lg border bg-white px-3 py-2.5 text-base text-neutral-900',
        // Espacio a la derecha para la flecha dibujada de fondo.
        'bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat pr-10',
        "bg-[url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='2' stroke='%23525252'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5'/%3e%3c/svg%3e\")]",
        'focus:outline-none focus:ring-2',
        invalido
          ? 'border-red-500 focus:border-red-600 focus:ring-red-500/30'
          : 'border-neutral-300 focus:border-marca-600 focus:ring-marca-600/30',
        'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500',
        className,
      )}
      {...resto}
    >
      {placeholder !== undefined && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  )
}
