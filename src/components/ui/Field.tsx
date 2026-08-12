import { useId, type ReactNode } from 'react'
import { cx } from '@/lib/cx'

/**
 * Atributos que `Field` calcula y le pasa al control.
 *
 * Se entregan por render prop en lugar de inyectarlos con `cloneElement`, que es
 * frágil y no se puede tipar bien. Al esparcirlos sobre el `Input` o el
 * `Select`, la asociación accesible queda garantizada y no depende de que quien
 * escribe la pantalla se acuerde de armarla.
 */
export interface PropsDeControl {
  id: string
  'aria-invalid': boolean | undefined
  'aria-describedby': string | undefined
  required: boolean | undefined
}

interface Props {
  label: string
  /** Texto de error del campo. Su presencia es lo que lo marca como inválido. */
  error?: string
  /** Aclaración bajo el campo, del estilo "Como figura en el remito". */
  ayuda?: string
  requerido?: boolean
  children: (props: PropsDeControl) => ReactNode
  className?: string
}

/**
 * Envoltorio de un campo de formulario: label, control, ayuda y error.
 *
 * Estandariza el espaciado y, sobre todo, el cableado accesible — `htmlFor`,
 * `aria-invalid` y `aria-describedby` apuntando al mensaje correcto.
 *
 * @example
 * <Field label="Lote" error={errores.lote} requerido>
 *   {(props) => <Input {...props} value={lote} onChange={…} />}
 * </Field>
 */
export function Field({
  label,
  error,
  ayuda,
  requerido = false,
  children,
  className,
}: Props) {
  const id = useId()
  const idError = `${id}-error`
  const idAyuda = `${id}-ayuda`

  const hayError = error !== undefined && error !== ''
  const hayAyuda = ayuda !== undefined && ayuda !== ''

  // El error manda sobre la ayuda: si el campo está mal, eso es lo que hay que
  // escuchar primero.
  const descripcion = hayError ? idError : hayAyuda ? idAyuda : undefined

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-base font-medium text-piedra-800">
        {label}
        {requerido && (
          <span className="ml-0.5 text-red-700" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({
        id,
        'aria-invalid': hayError || undefined,
        'aria-describedby': descripcion,
        required: requerido || undefined,
      })}

      {hayAyuda && !hayError && (
        <p id={idAyuda} className="text-sm text-piedra-500">
          {ayuda}
        </p>
      )}

      {hayError && (
        <p id={idError} className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
