import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useProductos } from '@/hooks/useProductos'
import { useClientes } from '@/hooks/useClientes'
import { useCrearPalet } from '@/hooks/useCrearPalet'
import { Card } from '@/components/ui/Card'
import { Form, FormAcciones } from '@/components/ui/Form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { rutaPalet, RUTAS } from '@/rutas'
import {
  aDatosNuevoPalet,
  esquemaPaletSegunCategoria,
  hoyISO,
  type FormularioPalet,
} from '@/screens/operario/esquemaPalet'
import type { Categoria } from '@/types'

/**
 * Alta de palet.
 *
 * El producto se elige primero porque su categoría decide qué campos
 * específicos se piden: fechas para agroquímicos, híbrido y calibre para
 * semillas.
 */
export function AltaPalet() {
  const navegar = useNavigate()
  const {
    data: productos,
    isPending: cargandoProductos,
    isError: falloElCatalogo,
    error: errorDelCatalogo,
    refetch: reintentarCatalogo,
  } = useProductos()

  const { data: clientes } = useClientes()
  const crear = useCrearPalet()

  /**
   * Categoría del producto elegido, leída en el momento de validar.
   *
   * Va en un ref y no como argumento directo del resolver porque el resolver se
   * arma dentro de `useForm`, antes de que exista el `watch` que dice qué
   * producto está elegido. El ref rompe esa circularidad: el resolver lo
   * consulta recién cuando corre la validación, con el valor ya actualizado.
   */
  const refCategoria = useRef<Categoria | null>(null)

  const {
    register,
    handleSubmit,
    control,
    resetField,
    formState: { errors },
  } = useForm<FormularioPalet>({
    defaultValues: {
      productoId: '',
      lote: '',
      cantidadInicial: '',
      galpon: '1',
      sector: '',
      fechaIngreso: hoyISO(),
      fechaElaboracion: '',
      fechaVencimiento: '',
      hibrido: '',
      calibre: '',
      clienteId: '',
      observacion: '',
    },
    resolver: (valores, contexto, opciones) =>
      zodResolver(esquemaPaletSegunCategoria(refCategoria.current))(
        valores,
        contexto,
        opciones,
      ),
  })

  // `useWatch` y no `watch()`: este último devuelve una función que el React
  // Compiler no puede memoizar, y por eso saltea la optimización del componente
  // entero.
  const productoIdElegido = useWatch({ control, name: 'productoId' })

  const categoria: Categoria | null = (() => {
    const id = Number(productoIdElegido)
    if (Number.isNaN(id) || id === 0) return null

    return productos?.find((producto) => producto.id === id)?.categoria ?? null
  })()

  // Al pasar a un producto de otra categoría, los campos del bloque anterior
  // quedarían cargados pero invisibles, y se mandarían igual. Se limpian.
  const categoriaPrevia = useRef<Categoria | null>(null)

  useEffect(() => {
    refCategoria.current = categoria

    if (categoriaPrevia.current === categoria) return

    if (categoriaPrevia.current === 'agroquimico') {
      resetField('fechaElaboracion')
      resetField('fechaVencimiento')
    }

    if (categoriaPrevia.current === 'semilla') {
      resetField('calibre')
    }

    categoriaPrevia.current = categoria
  }, [categoria, resetField])

  async function guardar(valores: FormularioPalet) {
    const palet = await crear.mutateAsync(aDatosNuevoPalet(valores, categoria))
    // `replace` para que el botón «atrás» no vuelva al formulario ya enviado.
    navegar(rutaPalet(palet.id, true), { replace: true })
  }

  if (cargandoProductos) {
    return (
      <div className="flex justify-center py-12 text-marca-700">
        <Spinner tamaño="lg" etiqueta="Cargando productos" />
      </div>
    )
  }

  if (falloElCatalogo) {
    return (
      <ErrorMessage
        titulo="No se pudo cargar el catálogo de productos"
        mensaje={errorDelCatalogo.message}
        onReintentar={() => void reintentarCatalogo()}
      />
    )
  }

  return (
    <Card>
      <h2 className="mb-5 text-xl font-semibold text-piedra-900">Nuevo palet</h2>

      <Form onSubmit={(evento) => void handleSubmit(guardar)(evento)}>
        <Field label="Producto" error={errors.productoId?.message} requerido>
          {(props) => (
            <Select {...props} {...register('productoId')} placeholder="Elegí un producto">
              {productos?.map((producto) => (
                <option key={producto.id} value={String(producto.id)}>
                  {producto.nombre} ({producto.unidad_medida})
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/* Acá es donde se descubre que falta un producto: llegó mercadería de
            algo que nunca se cargó. El acceso va justo debajo del selector. */}
        <Button
          variante="fantasma"
          onClick={() => navegar(RUTAS.nuevoProducto)}
          className="-mt-3 self-start"
        >
          {productos?.length === 0
            ? 'No hay productos cargados: agregá el primero'
            : '¿No está el producto? Agregalo'}
        </Button>

        <Field label="Lote" error={errors.lote?.message} requerido>
          {(props) => (
            <Input
              {...props}
              {...register('lote')}
              invalido={errors.lote !== undefined}
              autoCapitalize="characters"
              autoCorrect="off"
              placeholder="Como figura en el remito"
            />
          )}
        </Field>

        <Field
          label="Cantidad inicial"
          error={errors.cantidadInicial?.message}
          ayuda="Una vez creado el palet no se puede cambiar."
          requerido
        >
          {(props) => (
            <Input
              {...props}
              {...register('cantidadInicial')}
              invalido={errors.cantidadInicial !== undefined}
              type="text"
              inputMode="decimal"
              placeholder="0"
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

        <Field label="Fecha de ingreso" error={errors.fechaIngreso?.message} requerido>
          {(props) => (
            <Input
              {...props}
              {...register('fechaIngreso')}
              invalido={errors.fechaIngreso !== undefined}
              type="date"
            />
          )}
        </Field>

        <Field
          label="Cliente"
          error={errors.clienteId?.message}
          ayuda="Dejalo en AIBAR S.R.L si la mercadería es nuestra."
        >
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

        <Button
          variante="fantasma"
          onClick={() => navegar(RUTAS.nuevoCliente)}
          className="-mt-3 self-start"
        >
          {clientes?.length === 0
            ? 'No hay clientes cargados: agregá el primero'
            : '¿No está el cliente? Agregalo'}
        </Button>

        {categoria === 'agroquimico' && (
          <fieldset className="flex flex-col gap-5 rounded-lg border border-piedra-200 p-4">
            <legend className="px-1 text-sm font-semibold text-piedra-500 uppercase">
              Datos del agroquímico
            </legend>

            <Field
              label="Fecha de elaboración"
              error={errors.fechaElaboracion?.message}
              ayuda="Opcional."
            >
              {(props) => (
                <Input
                  {...props}
                  {...register('fechaElaboracion')}
                  invalido={errors.fechaElaboracion !== undefined}
                  type="date"
                />
              )}
            </Field>

            <Field
              label="Fecha de vencimiento"
              error={errors.fechaVencimiento?.message}
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  {...register('fechaVencimiento')}
                  invalido={errors.fechaVencimiento !== undefined}
                  type="date"
                />
              )}
            </Field>
          </fieldset>
        )}

        {categoria === 'semilla' && (
          <fieldset className="flex flex-col gap-5 rounded-lg border border-piedra-200 p-4">
            <legend className="px-1 text-sm font-semibold text-piedra-500 uppercase">
              Datos de la semilla
            </legend>

            <Field label="Calibre" error={errors.calibre?.message} ayuda="Opcional.">
              {(props) => (
                <Input
                  {...props}
                  {...register('calibre')}
                  invalido={errors.calibre !== undefined}
                />
              )}
            </Field>
          </fieldset>
        )}

        <Field
          label="Observaciones"
          error={errors.observacion?.message}
          ayuda="Opcional. Si la mercadería viene con algún problema, anotalo acá. Después vas a poder sumar más notas."
        >
          {(props) => (
            <textarea
              {...props}
              {...register('observacion')}
              rows={2}
              maxLength={500}
              placeholder="Ej. 2 bidones pinchados"
              className="w-full rounded-lg border border-piedra-300 px-3 py-2.5 text-base text-piedra-900 placeholder:text-piedra-400 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/30 focus:outline-none"
            />
          )}
        </Field>

        {crear.isError && (
          <ErrorMessage
            titulo="No se pudo dar de alta el palet"
            mensaje={crear.error.message}
          />
        )}

        <FormAcciones>
          <Button type="submit" tamaño="lg" cargando={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Dar de alta'}
          </Button>
          <Button
            variante="secundario"
            onClick={() => navegar(RUTAS.operario)}
            disabled={crear.isPending}
          >
            Cancelar
          </Button>
        </FormAcciones>
      </Form>
    </Card>
  )
}
