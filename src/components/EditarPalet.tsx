import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEditarPalet, useDarDeBajaPalet } from '@/hooks/usePaletAcciones'
import { useProductos } from '@/hooks/useProductos'
import { useClientes } from '@/hooks/useClientes'
import { Dialogo } from '@/components/ui/Dialogo'
import { Form, FormAcciones } from '@/components/ui/Form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import type { Galpon, PaletCompleto } from '@/types'

/**
 * Corrección de los datos de un palet, y baja.
 *
 * Van juntas porque son las dos formas de arreglar un palet que quedó mal: o se
 * corrige el dato equivocado, o se saca de circulación. Lo que **no** se toca
 * desde acá es el stock: `cantidad_inicial` es inmutable y `cantidad_disponible`
 * solo se mueve registrando movimientos.
 */

type Modo = 'editar' | 'baja'

interface Props {
  palet: PaletCompleto
  abierto: boolean
  onCerrar: () => void
}

const esquemaEdicion = z.object({
  lote: z
    .string()
    .trim()
    .min(1, 'El lote es obligatorio.')
    .max(50, 'El lote no puede tener más de 50 caracteres.'),
  galpon: z.enum(['1', '2', '3'], { message: 'Elegí un galpón.' }),
  sector: z.string().trim().max(50, 'El sector no puede tener más de 50 caracteres.'),
  clienteId: z.string(),
})

type FormularioEdicion = z.infer<typeof esquemaEdicion>

export function EditarPalet({ palet, abierto, onCerrar }: Props) {
  const [modo, setModo] = useState<Modo>('editar')
  const [motivo, setMotivo] = useState('')

  const editar = useEditarPalet()
  const darDeBaja = useDarDeBajaPalet()
  const { data: productos } = useProductos()
  const { data: clientes } = useClientes()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormularioEdicion>({
    defaultValues: {
      lote: palet.lote,
      galpon: String(palet.galpon) as '1' | '2' | '3',
      sector: palet.sector ?? '',
      clienteId: palet.cliente_id === null ? '' : String(palet.cliente_id),
    },
    resolver: zodResolver(esquemaEdicion),
  })

  // El producto no se ofrece si el palet ya tuvo movimientos: la base lo
  // rechazaría (trigger `proteger_identidad_palet`) porque a esa altura la
  // etiqueta impresa y el historial ya dicen otra cosa.
  const productoDelPalet = productos?.find((p) => p.id === palet.producto_id)

  function cerrarYLimpiar() {
    onCerrar()
    setTimeout(() => {
      setModo('editar')
      setMotivo('')
      reset()
      editar.reset()
      darDeBaja.reset()
    }, 150)
  }

  async function guardar(datos: FormularioEdicion) {
    await editar.mutateAsync({
      paletId: palet.id,
      datos: {
        lote: datos.lote,
        galpon: Number(datos.galpon) as Galpon,
        sector: datos.sector,
        clienteId: datos.clienteId === '' ? null : Number(datos.clienteId),
      },
    })

    cerrarYLimpiar()
  }

  async function confirmarBaja() {
    if (motivo.trim() === '') return

    await darDeBaja.mutateAsync({ paletId: palet.id, motivo })
    cerrarYLimpiar()
  }

  const trabajando = editar.isPending || darDeBaja.isPending

  return (
    <Dialogo
      abierto={abierto}
      onCerrar={cerrarYLimpiar}
      bloqueado={trabajando}
      titulo={modo === 'baja' ? 'Dar de baja el palet' : 'Corregir datos del palet'}
    >
      {modo === 'editar' && (
        <Form onSubmit={(evento) => void handleSubmit(guardar)(evento)}>
          <p className="text-base text-neutral-600">
            Palet #{palet.id} · {productoDelPalet?.nombre ?? palet.producto.nombre}
          </p>

          <Field label="Lote" error={errors.lote?.message} requerido>
            {(props) => (
              <Input
                {...props}
                {...register('lote')}
                invalido={errors.lote !== undefined}
                autoCapitalize="characters"
                autoCorrect="off"
              />
            )}
          </Field>

          <Field label="Galpón" error={errors.galpon?.message} requerido>
            {(props) => (
              <Select {...props} {...register('galpon')}>
                <option value="1">Galpón 1</option>
                <option value="2">Galpón 2</option>
                <option value="3">Galpón 3</option>
              </Select>
            )}
          </Field>

          <Field label="Sector" error={errors.sector?.message} ayuda="Opcional.">
            {(props) => (
              <Input
                {...props}
                {...register('sector')}
                invalido={errors.sector !== undefined}
                placeholder="Ej. Pasillo B, estante 3"
              />
            )}
          </Field>

          <Field label="Cliente" ayuda="Dejalo en AIBAR S.R.L si la mercadería es nuestra.">
            {(props) => (
              <Select {...props} {...register('clienteId')}>
                <option value="">AIBAR S.R.L</option>
                {clientes?.map((cliente) => (
                  <option key={cliente.id} value={String(cliente.id)}>
                    {cliente.nombre}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <p className="text-sm text-neutral-500">
            La cantidad inicial no se puede cambiar. Si está mal, hay que dar de baja el
            palet y cargarlo de nuevo.
          </p>

          {editar.isError && (
            <ErrorMessage titulo="No se pudo guardar" mensaje={editar.error.message} />
          )}

          <FormAcciones>
            <Button type="submit" tamaño="lg" cargando={editar.isPending}>
              {editar.isPending ? 'Guardando…' : 'Guardar cambios'}
            </Button>
            <Button variante="secundario" disabled={trabajando} onClick={cerrarYLimpiar}>
              Cancelar
            </Button>
          </FormAcciones>

          <Button
            variante="peligro"
            anchoCompleto
            disabled={trabajando}
            onClick={() => setModo('baja')}
          >
            Dar de baja este palet
          </Button>
        </Form>
      )}

      {modo === 'baja' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-900">
              Palet #{palet.id} · {palet.producto.nombre}
            </p>
            <p className="mt-2 text-base text-red-800">
              Quedan {palet.cantidad_disponible} {palet.producto.unidad_medida} que van a
              dejar de figurar como stock disponible.
            </p>
            <p className="mt-2 text-base text-red-800">
              No se puede deshacer desde la app, y el palet no va a admitir más
              movimientos.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="motivo-baja" className="text-base font-medium text-neutral-800">
              Motivo de la baja <span className="text-red-700">*</span>
            </label>
            <textarea
              id="motivo-baja"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
              rows={3}
              maxLength={400}
              placeholder="Ej. Mercadería vencida, se descartó"
              disabled={trabajando}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/30 focus:outline-none disabled:bg-neutral-100"
            />
            <p className="text-sm text-neutral-500">
              Queda en la bitácora del palet, para que después se entienda por qué esa
              mercadería salió del stock.
            </p>
          </div>

          {darDeBaja.isError && (
            <ErrorMessage
              titulo="No se pudo dar de baja"
              mensaje={darDeBaja.error.message}
            />
          )}

          <FormAcciones>
            <Button
              variante="peligro"
              tamaño="lg"
              cargando={darDeBaja.isPending}
              disabled={motivo.trim() === ''}
              onClick={() => void confirmarBaja()}
            >
              {darDeBaja.isPending ? 'Dando de baja…' : 'Confirmar baja'}
            </Button>
            <Button variante="secundario" disabled={trabajando} onClick={() => setModo('editar')}>
              Volver
            </Button>
          </FormAcciones>
        </div>
      )}
    </Dialogo>
  )
}
