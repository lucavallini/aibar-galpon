import { cx } from '@/lib/cx'

export type TamañoSpinner = 'sm' | 'md' | 'lg'

interface Props {
  tamaño?: TamañoSpinner
  /** Texto para el lector de pantalla. */
  etiqueta?: string
  /** Cuando el spinner va dentro de otro elemento que ya anuncia el estado. */
  decorativo?: boolean
  className?: string
}

const CLASES_POR_TAMAÑO: Record<TamañoSpinner, string> = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-9 border-3',
}

/** Indicador de carga. Hereda el color del texto, así sirve sobre cualquier fondo. */
export function Spinner({
  tamaño = 'md',
  etiqueta = 'Cargando',
  decorativo = false,
  className,
}: Props) {
  return (
    <span
      className={cx(
        'inline-block shrink-0 animate-spin rounded-full border-current/25 border-t-current',
        CLASES_POR_TAMAÑO[tamaño],
        className,
      )}
      role={decorativo ? undefined : 'status'}
      aria-label={decorativo ? undefined : etiqueta}
      aria-hidden={decorativo || undefined}
    />
  )
}
