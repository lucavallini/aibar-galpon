import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useProductos } from '@/hooks/useProductos'
import { useClientes } from '@/hooks/useClientes'
import { useCrearLoteDePalets, useCrearPalet } from '@/hooks/useCrearPalet'
import { Card } from '@/components/ui/Card'
import { Form, FormAcciones } from '@/components/ui/Form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { SelectorDeSector } from '@/components/SelectorDeSector'
import { CampoCantidad } from '@/components/CampoCantidad'
import { SelectorDeTransportista } from '@/components/SelectorDeTransportista'
import { UNIDAD_POR_OMISION } from '@/lib/unidades'
import { rutaLote, rutaPalet, RUTAS } from '@/rutas'
import {
  aDatosNuevoLote,
  aDatosNuevoPalet,
  esquemaPaletSegunCategoria,
  esUnSoloPalet,
  hoyISO,
  MAXIMO_PALETS_POR_LOTE,
  repartirEntrePalets,
  type FormularioPalet,
} from '@/screens/operario/esquemaPalet'
import type { Categoria, Galpon } from '@/types'

/**
 * Alta de palet.
 *
 * Se elige primero **el tipo de mercadería**: es el orden en que el operario
 * tiene la información —sabe que llegó un agroquímico antes de mirar cuál— y es
 * lo que decide todo lo que viene después.
 *
 * Después se elige el producto —el catálogo ya viene recortado a ese tipo— y se
 * completa lo que cambia de partida en partida:
 *
 * - **Agroquímico**: número de lote, fecha de elaboración, fecha de vencimiento
 *   y cantidad.
 * - **Semilla**: híbrido, batch, calibre y cantidad.
 *
 * Dos nombres que conviene no confundir: el **producto** es qué cosa es —Maíz,
 * Glifosato 48%— y se carga una sola vez; el **híbrido** es la variedad que vino
 * en este palet, y cambia de camión a camión.
 *
 * El «lote» y el «batch» son la misma columna, `palet.lote`: el depósito le dice
 * de una manera al dato del remito de un agroquímico y de otra al de la bolsa de
 * semilla, y el formulario habla como el depósito.
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
  const crearLote = useCrearLoteDePalets()

  /**
   * Tipo elegido, leído en el momento de validar.
   *
   * Va en un ref porque el resolver se arma dentro de `useForm`, antes de que
   * exista el `watch` que dice qué tipo está seleccionado. El ref rompe esa
   * circularidad: el resolver lo consulta recién cuando corre la validación.
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
      categoria: 'agroquimico',
      productoId: '',
      lote: '',
      cantidadInicial: '',
      unidadMedida: UNIDAD_POR_OMISION,
      cantidadPalets: '1',
      galpon: '1',
      sectorId: '',
      fechaIngreso: hoyISO(),
      fechaElaboracion: '',
      fechaVencimiento: '',
      hibrido: '',
      calibre: '',
      clienteId: '',
      transportistaId: '',
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
  const categoria = useWatch({ control, name: 'categoria' })
  const galpon = useWatch({ control, name: 'galpon' })
  const cantidadPalets = useWatch({ control, name: 'cantidadPalets' })
  const cantidadInicial = useWatch({ control, name: 'cantidadInicial' })
  const unidadMedida = useWatch({ control, name: 'unidadMedida' })

  /**
   * Un lote llega repartido en varios palets: se carga el total una vez y la
   * base lo divide, en lugar de completar el mismo formulario diez veces.
   */
  const esUno = esUnSoloPalet(cantidadPalets)

  /** Cuánto va a quedar en cada palet, para verlo antes de crearlos. */
  const reparto = esUno
    ? null
    : repartirEntrePalets(
        Number(cantidadInicial.trim().replace(',', '.')),
        Number(cantidadPalets),
      )

  /** Solo los productos del tipo elegido: media lista menos para revisar. */
  const productosDeLaCategoria = (productos ?? []).filter(
    (producto) => producto.categoria === categoria,
  )

  // Al cambiar de tipo, el producto elegido deja de estar en la lista y los
  // campos del bloque anterior quedan cargados pero invisibles: se mandarían
  // igual. Se limpia todo lo que dejó de corresponder.
  const categoriaPrevia = useRef<Categoria | null>(null)

  useEffect(() => {
    refCategoria.current = categoria

    if (categoriaPrevia.current === categoria) return

    if (categoriaPrevia.current !== null) {
      resetField('productoId')
    }

    if (categoriaPrevia.current === 'agroquimico') {
      resetField('fechaElaboracion')
      resetField('fechaVencimiento')
    }

    if (categoriaPrevia.current === 'semilla') {
      resetField('hibrido')
      resetField('calibre')
    }

    categoriaPrevia.current = categoria
  }, [categoria, resetField])

  // Un sector pertenece a un galpón: el que estaba elegido ya no existe en el
  // nuevo, y mandarlo crearía el palet en el galpón equivocado.
  const galponPrevio = useRef(galpon)

  useEffect(() => {
    if (galponPrevio.current === galpon) return

    galponPrevio.current = galpon
    resetField('sectorId')
  }, [galpon, resetField])

  async function guardar(valores: FormularioPalet) {
    // `replace` en los dos casos para que el botón «atrás» no vuelva al
    // formulario ya enviado y lo mande de nuevo.
    if (esUnSoloPalet(valores.cantidadPalets)) {
      const palet = await crear.mutateAsync(aDatosNuevoPalet(valores, valores.categoria))
      navegar(rutaPalet(palet.id, true), { replace: true })
      return
    }

    const palets = await crearLote.mutateAsync(
      aDatosNuevoLote(valores, valores.categoria),
    )

    // A la pantalla del lote, que muestra los QR de los N para imprimirlos uno
    // atrás del otro sin tener que ir a buscar palet por palet.
    navegar(rutaLote(palets.map((palet) => palet.id)), { replace: true })
  }

  /** El alta de a uno y la del lote comparten formulario y errores. */
  const guardando = crear.isPending || crearLote.isPending
  const falloElAlta = crear.isError || crearLote.isError
  const errorDelAlta = crear.error ?? crearLote.error

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
        <Field
          label="Tipo de mercadería"
          error={errors.categoria?.message}
          ayuda="Define qué productos se ofrecen abajo."
          requerido
        >
          {(props) => (
            <Select {...props} {...register('categoria')}>
              <option value="agroquimico">Agroquímico</option>
              <option value="semilla">Semilla</option>
            </Select>
          )}
        </Field>

        {categoria === 'agroquimico' && (
          <fieldset className="flex flex-col gap-5 rounded-lg border border-piedra-200 p-4">
            <legend className="px-1 text-sm font-semibold text-piedra-500 uppercase">
              Datos del agroquímico
            </legend>

            <Field label="Producto" error={errors.productoId?.message} requerido>
              {(props) => (
                <Select
                  {...props}
                  {...register('productoId')}
                  placeholder="Elegí un producto"
                >
                  {productosDeLaCategoria.map((producto) => (
                    <option key={producto.id} value={String(producto.id)}>
                      {/* La concentración va pegada al nombre porque es lo que
                          separa dos envases que dicen lo mismo: un Glifosato al
                          48% y uno al 62% no rinden igual. */}
                      {producto.nombre}
                      {producto.concentracion !== null && ` ${producto.concentracion}`}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Número de lote" error={errors.lote?.message} requerido>
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
              label="Fecha de elaboración"
              error={errors.fechaElaboracion?.message}
              ayuda="Opcional: solo si viene impresa en el envase."
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

            <CampoCantidad
              registroCantidad={register('cantidadInicial')}
              registroUnidad={register('unidadMedida')}
              errorCantidad={errors.cantidadInicial?.message}
              errorUnidad={errors.unidadMedida?.message}
              label={esUno ? 'Cantidad' : 'Cantidad total del lote'}
              ayuda={
                esUno
                  ? 'Una vez creado el palet no se puede cambiar.'
                  : 'Todo lo que entró junto: se reparte entre los palets.'
              }
            />
          </fieldset>
        )}

        {categoria === 'semilla' && (
          <fieldset className="flex flex-col gap-5 rounded-lg border border-piedra-200 p-4">
            <legend className="px-1 text-sm font-semibold text-piedra-500 uppercase">
              Datos de la semilla
            </legend>

            {/* El producto es el cultivo —Maíz, Soja— y el híbrido de abajo dice
                cuál vino en este palet: dos partidas con híbridos distintos son
                el mismo producto, no dos entradas del catálogo. */}
            <Field label="Producto" error={errors.productoId?.message} requerido>
              {(props) => (
                <Select
                  {...props}
                  {...register('productoId')}
                  placeholder="Elegí una semilla"
                >
                  {productosDeLaCategoria.map((producto) => (
                    <option key={producto.id} value={String(producto.id)}>
                      {producto.nombre}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field
              label="Híbrido"
              error={errors.hibrido?.message}
              ayuda="La variedad, tal como figura en la bolsa."
              requerido
            >
              {(props) => (
                <Input
                  {...props}
                  {...register('hibrido')}
                  invalido={errors.hibrido !== undefined}
                  placeholder="Ej. DK 7210"
                  maxLength={100}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                />
              )}
            </Field>

            <Field label="Batch" error={errors.lote?.message} requerido>
              {(props) => (
                <Input
                  {...props}
                  {...register('lote')}
                  invalido={errors.lote !== undefined}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  placeholder="Como figura en la bolsa"
                />
              )}
            </Field>

            <Field
              label="Calibre"
              error={errors.calibre?.message}
              ayuda="Opcional: solo si viene indicado."
            >
              {(props) => (
                <Input
                  {...props}
                  {...register('calibre')}
                  invalido={errors.calibre !== undefined}
                  placeholder="Ej. M, G, 24/26"
                  maxLength={50}
                  autoComplete="off"
                />
              )}
            </Field>

            <CampoCantidad
              registroCantidad={register('cantidadInicial')}
              registroUnidad={register('unidadMedida')}
              errorCantidad={errors.cantidadInicial?.message}
              errorUnidad={errors.unidadMedida?.message}
              label={esUno ? 'Cantidad' : 'Cantidad total del lote'}
              ayuda={
                esUno
                  ? 'Una vez creado el palet no se puede cambiar.'
                  : 'Todo lo que entró junto: se reparte entre los palets.'
              }
            />
          </fieldset>
        )}

        {/* Un lote de semilla no llega en un palet: llegan 10.000 kg del mismo
            batch repartidos en diez. Antes eso eran diez formularios idénticos
            salvo la cantidad, con diez chances de tipear distinto el batch. */}
        <Field
          label="¿Cuántos palets?"
          error={errors.cantidadPalets?.message}
          ayuda={`Si la partida vino repartida en varios, poné cuántos: se crean todos juntos. Hasta ${MAXIMO_PALETS_POR_LOTE}.`}
          requerido
        >
          {(props) => (
            <Input
              {...props}
              {...register('cantidadPalets')}
              invalido={errors.cantidadPalets !== undefined}
              type="text"
              inputMode="numeric"
              placeholder="1"
              className="max-w-32"
            />
          )}
        </Field>

        {/* Ver el reparto antes de crear es lo que evita el error caro: si el
            total estaba mal, se descubre acá y no con diez palets ya impresos. */}
        {reparto !== null && (
          <div className="rounded-lg border border-marca-200 bg-marca-50 px-4 py-3">
            <p className="text-base font-semibold text-marca-900">
              {reparto.cantidadPalets} palets de {reparto.porPalet} {unidadMedida}
            </p>
            {reparto.ultimo !== reparto.porPalet && (
              <p className="mt-1 text-sm text-marca-800">
                El último lleva {reparto.ultimo} {unidadMedida}: la división no da
                exacta y el resto va ahí, así la suma cierra con el total.
              </p>
            )}
          </div>
        )}

        <Field label="Galpón" error={errors.galpon?.message} requerido>
          {(props) => (
            <Select {...props} {...register('galpon')}>
              <option value="1">Galpón 1</option>
              <option value="2">Galpón 2</option>
              <option value="3">Galpón 3</option>
            </Select>
          )}
        </Field>

        {/* Se elige de la lista y no se escribe: así 'A7' y 'a7' no pueden ser
            dos lugares distintos, y no se puede apuntar a un sector ocupado.

            En un lote no se pide: elegir diez lugares antes de tener los palets
            delante obliga a decidirlos de memoria. Nacen sin ubicar y se les
            asigna el sector al descargarlos, con la etiqueta ya pegada. */}
        {esUno ? (
          <Controller
            control={control}
            name="sectorId"
            render={({ field }) => (
              <SelectorDeSector
                galpon={Number(galpon) as Galpon}
                valor={field.value}
                onChange={field.onChange}
                error={errors.sectorId?.message}
              />
            )}
          />
        ) : (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
            Los {cantidadPalets} palets se van a crear <strong>sin ubicar</strong>. Al
            descargarlos, escaneá cada etiqueta y asignale su sector.
          </p>
        )}

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

        {/* Quién trajo el palet: queda registrado en el ingreso y no cambia
            más. Si el mismo camión trajo un lote entero, los N palets quedan
            con el mismo chofer. */}
        <Controller
          control={control}
          name="transportistaId"
          render={({ field }) => (
            <SelectorDeTransportista
              label={esUno ? '¿Quién trajo el palet?' : '¿Quién trajo el lote?'}
              valor={field.value ?? ''}
              onChange={field.onChange}
              ayuda="Opcional. Si no sabés quién fue, dejalo sin registrar."
              error={errors.transportistaId?.message}
            />
          )}
        />

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

        {falloElAlta && (
          <ErrorMessage
            titulo={esUno ? 'No se pudo dar de alta el palet' : 'No se pudo crear el lote'}
            // Si falla, no queda ningún palet creado: la base los crea a todos
            // dentro de la misma transacción.
            mensaje={errorDelAlta?.message ?? 'Probá de nuevo.'}
          />
        )}

        <FormAcciones>
          <Button type="submit" tamaño="lg" cargando={guardando}>
            {guardando
              ? 'Guardando…'
              : esUno
                ? 'Dar de alta'
                : `Crear ${cantidadPalets} palets`}
          </Button>
          <Button
            variante="secundario"
            onClick={() => navegar(RUTAS.operario)}
            disabled={guardando}
          >
            Cancelar
          </Button>
        </FormAcciones>
      </Form>
    </Card>
  )
}
