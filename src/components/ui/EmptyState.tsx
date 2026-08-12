import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

interface Props {
  /** Ícono o ilustración. Decorativo: el mensaje lo da el título. */
  icono?: ReactNode
  titulo: string
  descripcion?: string
  /** Acción para salir del vacío, normalmente un `Button` o un `Link`. */
  accion?: ReactNode
  className?: string
}

/**
 * Hueco sin contenido: "todavía no hay palets en este galpón".
 *
 * Siempre conviene que diga qué hacer a continuación, no solo que no hay nada.
 */
export function EmptyState({ icono, titulo, descripcion, accion, className }: Props) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      {icono !== undefined && (
        <div className="text-neutral-400" aria-hidden="true">
          {icono}
        </div>
      )}

      <h2 className="text-lg font-semibold text-neutral-900">{titulo}</h2>

      {descripcion !== undefined && (
        <p className="max-w-sm text-base text-neutral-600">{descripcion}</p>
      )}

      {accion !== undefined && <div className="mt-2">{accion}</div>}
    </div>
  )
}
