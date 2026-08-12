import { cx } from '@/lib/cx'
import { Button } from '@/components/ui/Button'

interface Props {
  /**
   * Texto a mostrar. Los errores de la capa de queries (`ErrorSupabase`,
   * `ErrorAutenticacion`) ya vienen redactados para el operario: se pasa su
   * `message` tal cual, sin reescribirlo acá.
   */
  mensaje: string
  titulo?: string
  onReintentar?: () => void
  className?: string
}

/**
 * Bloque de error.
 *
 * Lleva `role="alert"` para que el lector de pantalla lo anuncie apenas
 * aparece, sin esperar a que el usuario llegue navegando.
 */
export function ErrorMessage({ mensaje, titulo, onReintentar, className }: Props) {
  return (
    <div
      role="alert"
      className={cx(
        'flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4',
        className,
      )}
    >
      <div>
        {titulo !== undefined && (
          <p className="font-semibold text-red-900">{titulo}</p>
        )}
        <p className={cx('text-base text-red-800', titulo !== undefined && 'mt-1')}>
          {mensaje}
        </p>
      </div>

      {onReintentar !== undefined && (
        <Button variante="secundario" onClick={onReintentar} className="self-start">
          Reintentar
        </Button>
      )}
    </div>
  )
}
