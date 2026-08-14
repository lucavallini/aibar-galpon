import type { UseFormRegisterReturn } from 'react-hook-form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { UNIDADES_DE_MEDIDA } from '@/lib/unidades'

interface Props {
  /** `register('cantidadInicial')` de la pantalla que lo usa. */
  registroCantidad: UseFormRegisterReturn
  /** `register('unidadMedida')`. */
  registroUnidad: UseFormRegisterReturn
  errorCantidad?: string
  errorUnidad?: string
  label?: string
  ayuda?: string
}

/**
 * Cuánto entró y en qué se cuenta: los dos controles pegados, como se lee.
 *
 * Van juntos porque son un solo dato —«40 bolsas»— y separarlos en dos campos
 * uno debajo del otro invita a completar el número y dejar la unidad en lo que
 * viniera puesto. Es un componente y no dos controles sueltos en la pantalla
 * porque el par se repite en cada tipo de mercadería.
 *
 * El `<label>` del `Field` apunta al número, que es lo que se tipea; el select
 * lleva su propio nombre accesible, si no el lector de pantalla lo anunciaría
 * como «cantidad» a él también.
 */
export function CampoCantidad({
  registroCantidad,
  registroUnidad,
  errorCantidad,
  errorUnidad,
  label = 'Cantidad',
  ayuda,
}: Props) {
  return (
    <Field label={label} error={errorCantidad ?? errorUnidad} ayuda={ayuda} requerido>
      {(props) => (
        // El ancho lo llevan los contenedores y no los controles: `Input` y
        // `Select` ya traen `w-full`, y `cx()` solo concatena clases —no
        // resuelve conflictos de Tailwind como hace `tailwind-merge`—, así que
        // un `w-36` pasado por `className` no le gana al `w-full` de adentro.
        // Cuando estaba así, el select se quedaba con todo el ancho y el input
        // del número desaparecía.
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Input
              {...props}
              {...registroCantidad}
              invalido={errorCantidad !== undefined}
              type="text"
              inputMode="decimal"
              placeholder="0"
            />
          </div>

          {/* Ancho fijo y chico: el número es lo que se mira, y un select que se
              estira con la palabra más larga hace saltar el campo de al lado. */}
          <div className="w-32 shrink-0">
            <Select
              {...registroUnidad}
              aria-label="Unidad de medida"
              aria-invalid={errorUnidad !== undefined || undefined}
              invalido={errorUnidad !== undefined}
            >
              {UNIDADES_DE_MEDIDA.map((unidad) => (
                <option key={unidad} value={unidad}>
                  {unidad}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}
    </Field>
  )
}
