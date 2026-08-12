import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCorregirMovimiento } from '@/hooks/useCorregirMovimiento'
import { Dialogo } from '@/components/ui/Dialogo'
import { Form, FormAcciones } from '@/components/ui/Form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import type { MovimientoConAutor, PaletCompleto, TipoMovimiento } from '@/types'

/**
 * Deshace un movimiento mal cargado.
 *
 * No es un formulario de «sumar stock»: la cantidad no se elige, se revierte
 * entera la del movimiento original. Lo único que se pide es el motivo, que
 * queda guardado en el historial para que después se entienda qué pasó.
 */

interface Props {
  palet: PaletCompleto
  /** El movimiento a deshacer. `null` cierra el diálogo. */
  movimiento: MovimientoConAutor | null
  onCerrar: () => void
}

const ETIQUETA_TIPO: Record<TipoMovimiento, string> = {
  venta: 'Venta',
  salida: 'Salida',
  ajuste: 'Ajuste',
  correccion: 'Corrección',
}

const esquemaCorreccion = z.object({
  motivo: z
    .string()
    .trim()
    .min(1, 'Contá por qué lo estás corrigiendo.')
    // `movimiento.motivo` es VARCHAR(255).
    .max(255, 'El motivo no puede tener más de 255 caracteres.'),
})

type FormularioCorreccion = z.infer<typeof esquemaCorreccion>

export function CorregirMovimiento({ palet, movimiento, onCerrar }: Props) {
  const [listo, setListo] = useState(false)
  const corregir = useCorregirMovimiento()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormularioCorreccion>({
    defaultValues: { motivo: '' },
    resolver: zodResolver(esquemaCorreccion),
  })

  const unidad = palet.producto.unidad_medida
  // La corrección devuelve exactamente lo que descontó el movimiento original.
  const restituido = movimiento?.cantidad ?? 0
  const nuevoDisponible = palet.cantidad_disponible + restituido

  function cerrarYLimpiar() {
    onCerrar()
    setTimeout(() => {
      setListo(false)
      reset()
      corregir.reset()
    }, 150)
  }

  async function confirmar(datos: FormularioCorreccion) {
    if (movimiento === null) return

    try {
      await corregir.mutateAsync({
        movimientoId: movimiento.id,
        motivo: datos.motivo,
        paletId: palet.id,
      })
      setListo(true)
    } catch {
      // El error queda en `corregir.error`. Es el caso esperable cuando se
      // vence el plazo con el formulario abierto: la base lo rechaza y su
      // mensaje se muestra sin tocarlo.
    }
  }

  return (
    <Dialogo
      abierto={movimiento !== null}
      onCerrar={cerrarYLimpiar}
      bloqueado={corregir.isPending}
      titulo={listo ? 'Movimiento corregido' : 'Corregir movimiento'}
    >
      {movimiento !== null && !listo && (
        <Form onSubmit={(evento) => void handleSubmit(confirmar)(evento)}>
          <div className="rounded-lg border border-piedra-200 bg-piedra-50 p-4">
            <p className="text-base text-piedra-600">Vas a deshacer</p>
            <p className="mt-1 text-xl font-bold text-piedra-900">
              {ETIQUETA_TIPO[movimiento.tipo]} de {movimiento.cantidad} {unidad}
            </p>
            <p className="mt-2 text-sm text-piedra-500">
              Palet #{palet.id} · {palet.producto.nombre}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-marca-200 bg-marca-50 p-4">
            <span className="text-base text-marca-900">El stock vuelve a</span>
            <span className="text-3xl font-bold text-marca-900">
              {nuevoDisponible} {unidad}
            </span>
          </div>

          <Field
            label="Motivo de la corrección"
            error={errors.motivo?.message}
            ayuda="Queda guardado en el historial."
            requerido
          >
            {(props) => (
              <Input
                {...props}
                {...register('motivo')}
                invalido={errors.motivo !== undefined}
                placeholder="Ej. Cargué 100 en vez de 10"
                maxLength={255}
                autoFocus
              />
            )}
          </Field>

          <p className="text-sm text-piedra-500">
            El movimiento original no se borra: queda en el historial junto con esta
            corrección.
          </p>

          {corregir.isError && (
            <ErrorMessage
              titulo="No se pudo corregir"
              // Viene de la base: «El movimiento ya no puede corregirse (fuera
              // de plazo)» y similares.
              mensaje={corregir.error.message}
            />
          )}

          <FormAcciones>
            <Button type="submit" tamaño="lg" cargando={corregir.isPending}>
              {corregir.isPending ? 'Corrigiendo…' : 'Confirmar corrección'}
            </Button>
            <Button
              variante="secundario"
              disabled={corregir.isPending}
              onClick={cerrarYLimpiar}
            >
              Cancelar
            </Button>
          </FormAcciones>
        </Form>
      )}

      {listo && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-marca-200 bg-marca-50 p-4 text-center">
            <p className="text-base font-medium text-marca-800">
              Se devolvieron {restituido} {unidad} al palet
            </p>
            <p className="mt-3 text-base text-marca-800">Ahora quedan</p>
            <p className="text-5xl font-bold text-marca-900">{nuevoDisponible}</p>
            <p className="text-lg text-marca-800">{unidad}</p>
          </div>

          <Button tamaño="lg" anchoCompleto onClick={cerrarYLimpiar}>
            Listo
          </Button>
        </div>
      )}
    </Dialogo>
  )
}
