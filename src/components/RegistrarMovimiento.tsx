import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRegistrarMovimiento } from '@/hooks/useRegistrarMovimiento'
import { Dialogo } from '@/components/ui/Dialogo'
import { Form, FormAcciones } from '@/components/ui/Form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { cx } from '@/lib/cx'
import type { PaletCompleto, TipoMovimientoRegistrable } from '@/types'

/**
 * Registro de un movimiento de stock.
 *
 * Son tres pasos y no uno solo a propósito: esto descuenta stock real, y un
 * cero de más en la cantidad es un error que después hay que ir a corregir con
 * la ventana de 30 minutos encima. El paso de confirmación muestra el resumen y
 * cuánto va a quedar, para que el error se vea antes y no después.
 */

type Paso = 'formulario' | 'confirmacion' | 'listo'

/** Dónde terminó el movimiento: hay que decírselo tal cual al operario. */
type Destino = 'base' | 'cola'

interface Props {
  palet: PaletCompleto
  abierto: boolean
  onCerrar: () => void
}

const TIPOS: { valor: TipoMovimientoRegistrable; etiqueta: string; ayuda: string }[] = [
  { valor: 'venta', etiqueta: 'Venta', ayuda: 'Salió vendido a un cliente' },
  { valor: 'salida', etiqueta: 'Salida', ayuda: 'Salió del depósito por otro motivo' },
  { valor: 'ajuste', etiqueta: 'Ajuste', ayuda: 'Corrección de inventario, rotura o faltante' },
]

/**
 * Valida contra el disponible del palet para dar respuesta inmediata.
 *
 * Es solo por comodidad: la validación que manda es la de la base, que además
 * bloquea el palet mientras calcula. Entre que se abre este formulario y se
 * confirma, otro operario puede haber descontado del mismo palet.
 */
function crearEsquema(disponible: number) {
  return z.object({
    tipo: z.enum(['venta', 'salida', 'ajuste'], { message: 'Elegí el tipo de movimiento.' }),
    cantidad: z
      .string()
      .min(1, 'Poné la cantidad.')
      .refine((valor) => !Number.isNaN(Number(valor.replace(',', '.'))), 'Poné un número.')
      .refine(
        (valor) => Number(valor.replace(',', '.')) > 0,
        'La cantidad tiene que ser mayor que cero.',
      )
      .refine(
        (valor) => /^\d+([.,]\d{1,2})?$/.test(valor.trim()),
        'Como máximo dos decimales.',
      )
      .refine(
        (valor) => Number(valor.replace(',', '.')) <= disponible,
        `No hay tanto stock: quedan ${disponible}.`,
      ),
  })
}

type FormularioMovimiento = z.infer<ReturnType<typeof crearEsquema>>

export function RegistrarMovimiento({ palet, abierto, onCerrar }: Props) {
  const [paso, setPaso] = useState<Paso>('formulario')
  const [destino, setDestino] = useState<Destino>('base')
  const registrar = useRegistrarMovimiento()

  const unidad = palet.producto.unidad_medida
  const disponible = palet.cantidad_disponible

  /**
   * Lo que se va a registrar, ya validado por Zod.
   *
   * Se guarda al pasar a la confirmación en lugar de leerlo con `getValues()`
   * en el render: ese método no es reactivo, así que el resumen podría mostrar
   * una cantidad distinta de la que se manda. Y el resumen es justamente lo que
   * el operario revisa antes de tocar el stock.
   */
  const [aConfirmar, setAConfirmar] = useState<{
    tipo: TipoMovimientoRegistrable
    cantidad: number
  } | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormularioMovimiento>({
    defaultValues: { tipo: 'venta', cantidad: '' },
    resolver: zodResolver(crearEsquema(disponible)),
  })

  const cantidadNumerica = aConfirmar?.cantidad ?? 0

  /**
   * Cuánto va a quedar. Se calcula acá porque los tres tipos siempre restan
   * —lo garantiza `registrar_movimiento()`—, así el resumen se puede mostrar
   * antes de llamar a la base.
   */
  const restante = disponible - cantidadNumerica

  function cerrarYLimpiar() {
    onCerrar()
    // Se difiere para que el formulario no se vea vaciarse durante la animación
    // de cierre del diálogo.
    setTimeout(() => {
      setPaso('formulario')
      setDestino('base')
      setAConfirmar(null)
      reset()
      registrar.reset()
    }, 150)
  }

  function irAConfirmacion(datos: FormularioMovimiento) {
    setAConfirmar({
      tipo: datos.tipo,
      // La coma decimal es lo natural en el teclado del celular en castellano.
      cantidad: Number(datos.cantidad.replace(',', '.')),
    })
    setPaso('confirmacion')
  }

  async function confirmar() {
    if (aConfirmar === null) return

    try {
      const resultado = await registrar.mutateAsync({
        paletId: palet.id,
        tipo: aConfirmar.tipo,
        cantidad: aConfirmar.cantidad,
        paletEtiqueta: `Palet #${palet.id} · ${palet.producto.nombre}`,
        unidad,
      })
      setDestino(resultado.destino)
      setPaso('listo')
    } catch {
      // El error queda en `registrar.error` y se muestra abajo. Se vuelve al
      // formulario para poder corregir la cantidad sin recargar nada.
      setPaso('formulario')
    }
  }

  const etiquetaTipo =
    TIPOS.find((tipo) => tipo.valor === aConfirmar?.tipo)?.etiqueta ?? ''

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={cerrarYLimpiar}
      bloqueado={registrar.isPending}
      titulo={
        paso === 'listo'
          ? destino === 'base'
            ? 'Movimiento registrado'
            : 'Guardado sin señal'
          : paso === 'confirmacion'
            ? 'Confirmá el movimiento'
            : 'Registrar movimiento'
      }
    >
      {/* ---------- Paso 1: qué y cuánto ---------- */}
      {paso === 'formulario' && (
        <Form onSubmit={(evento) => void handleSubmit(irAConfirmacion)(evento)}>
          <p className="text-base text-neutral-600">
            Palet #{palet.id} · {palet.producto.nombre}
            <br />
            Disponible: <strong>{disponible} {unidad}</strong>
          </p>

          <fieldset>
            <legend className="mb-2 text-base font-medium text-neutral-800">
              Tipo de movimiento
            </legend>

            <div className="flex flex-col gap-2">
              {TIPOS.map((tipo) => (
                <label
                  key={tipo.valor}
                  className={cx(
                    'flex min-h-toque cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                    'has-[:checked]:border-marca-600 has-[:checked]:bg-marca-50',
                    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-marca-600',
                    'border-neutral-300',
                  )}
                >
                  <input
                    type="radio"
                    value={tipo.valor}
                    {...register('tipo')}
                    className="mt-1 size-5 accent-marca-700"
                  />
                  <span>
                    <span className="block text-base font-medium text-neutral-900">
                      {tipo.etiqueta}
                    </span>
                    <span className="block text-sm text-neutral-500">{tipo.ayuda}</span>
                  </span>
                </label>
              ))}
            </div>

            {errors.tipo !== undefined && (
              <p className="mt-1 text-sm font-medium text-red-700">{errors.tipo.message}</p>
            )}
          </fieldset>

          <Field
            label={`Cantidad (${unidad})`}
            error={errors.cantidad?.message}
            requerido
          >
            {(props) => (
              <Input
                {...props}
                {...register('cantidad')}
                invalido={errors.cantidad !== undefined}
                type="text"
                inputMode="decimal"
                placeholder="0"
                autoFocus
              />
            )}
          </Field>

          {/* Atajo para el caso más común: sacar todo lo que queda. */}
          <Button
            variante="fantasma"
            onClick={() => setValue('cantidad', String(disponible))}
            className="self-start"
          >
            Usar todo el disponible ({disponible} {unidad})
          </Button>

          {registrar.isError && (
            <ErrorMessage
              titulo="No se pudo registrar"
              // El mensaje viene de la base y está escrito para el operario:
              // «Stock insuficiente. Disponible: 80, solicitado: 100».
              mensaje={registrar.error.message}
            />
          )}

          <FormAcciones>
            <Button type="submit" tamaño="lg">
              Continuar
            </Button>
            <Button variante="secundario" onClick={cerrarYLimpiar}>
              Cancelar
            </Button>
          </FormAcciones>
        </Form>
      )}

      {/* ---------- Paso 2: resumen antes de tocar el stock ---------- */}
      {paso === 'confirmacion' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-base text-neutral-600">Vas a registrar</p>
            <p className="mt-1 text-2xl font-bold text-neutral-900">
              {etiquetaTipo} de {cantidadNumerica} {unidad}
            </p>
            <p className="mt-2 text-base text-neutral-600">
              Palet #{palet.id} · {palet.producto.nombre}
              <br />
              Lote {palet.lote}
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-marca-200 bg-marca-50 p-4">
            <span className="text-base text-marca-900">Van a quedar</span>
            <span className="text-3xl font-bold text-marca-900">
              {restante} {unidad}
            </span>
          </div>

          <p className="text-sm text-neutral-500">
            Una vez registrado, solo se puede corregir dentro de los 30 minutos.
          </p>

          <FormAcciones>
            <Button tamaño="lg" cargando={registrar.isPending} onClick={() => void confirmar()}>
              {registrar.isPending ? 'Registrando…' : 'Confirmar'}
            </Button>
            <Button
              variante="secundario"
              disabled={registrar.isPending}
              onClick={() => setPaso('formulario')}
            >
              Volver
            </Button>
          </FormAcciones>
        </div>
      )}

      {/* ---------- Paso 3: qué pasó y cuánto queda ---------- */}
      {paso === 'listo' && destino === 'base' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-marca-200 bg-marca-50 p-4 text-center">
            <p className="text-base font-medium text-marca-800">
              {etiquetaTipo} de {cantidadNumerica} {unidad} registrada
            </p>
            <p className="mt-3 text-base text-marca-800">Ahora quedan</p>
            <p className="text-5xl font-bold text-marca-900">{restante}</p>
            <p className="text-lg text-marca-800">{unidad}</p>
          </div>

          {restante === 0 && (
            <p className="text-center text-base text-neutral-600">
              El palet quedó vacío.
            </p>
          )}

          <Button tamaño="lg" anchoCompleto onClick={cerrarYLimpiar}>
            Listo
          </Button>
        </div>
      )}

      {/* Sin señal el movimiento NO se registró: quedó guardado en el teléfono.
          Mostrar el stock resultante como si fuera el real sería mentirle al
          operario, porque otro puede descontar del mismo palet mientras tanto. */}
      {paso === 'listo' && destino === 'cola' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <p className="text-base font-semibold text-amber-900">
              Se guardó en el teléfono, todavía no en el sistema
            </p>
            <p className="mt-2 text-base text-amber-900">
              La {etiquetaTipo.toLowerCase()} de {cantidadNumerica} {unidad} quedó
              anotada y se va a registrar sola apenas haya señal. No hace falta que la
              cargues de nuevo.
            </p>
            <p className="mt-2 text-base text-amber-900">
              Hasta entonces el stock que muestra la pantalla es el que hay en el
              sistema, sin descontar este movimiento.
            </p>
          </div>

          <Button tamaño="lg" anchoCompleto onClick={cerrarYLimpiar}>
            Entendido
          </Button>
        </div>
      )}
    </Dialogo>
  )
}
