import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  CLAVE_GERENCIA,
  useAlertas,
  usePaletsGerencia,
  useStockPorProducto,
} from '@/hooks/useGerencia'
import { useProductos } from '@/hooks/useProductos'
import { useValorDemorado } from '@/hooks/useValorDemorado'
import { useClientes } from '@/hooks/useClientes'
import { DIAS_INMOVILIZADO, type PreguntaDeNegocio } from '@/lib/queries/gerencia'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EstadoPaletBadge } from '@/components/EstadoPaletBadge'
import { cx } from '@/lib/cx'
import { rutaPaletGerencia } from '@/rutas'
import type { Categoria, EstadoPalet, Galpon, PaletGerencia } from '@/types'

/**
 * Panel administrativo. Estrictamente de solo lectura.
 *
 * El jefe no viene a mirar «los palets»: viene a saber qué se le vence, qué no
 * se mueve y cuánto tiene de cada cosa. Por eso lo primero de la pantalla no es
 * una tabla sino las preguntas, y elegir una reencuadra todo el listado.
 */

const PREGUNTAS: Record<PreguntaDeNegocio, { titulo: string; explica: string }> = {
  todo: { titulo: 'Todo el depósito', explica: 'Todos los palets registrados.' },
  vencidos: {
    titulo: 'Ya vencidos',
    explica: 'Agroquímicos con stock cuya fecha de vencimiento ya pasó. No se pueden vender.',
  },
  'vence-30': {
    titulo: 'Vencen en 30 días',
    explica: 'Hay que colocarlos ya.',
  },
  'vence-90': {
    titulo: 'Vencen en 90 días',
    explica: 'Para tener en cuenta en la planificación.',
  },
  'sin-movimiento': {
    titulo: 'Sin movimiento',
    explica: `Con stock y más de ${DIAS_INMOVILIZADO} días sin registrar una salida. Es capital quieto ocupando galpón.`,
  },
  parciales: {
    titulo: 'Con movimientos',
    explica:
      'Palets empezados: ya se les sacó mercadería pero todavía queda. Varios del mismo producto conviene consolidarlos.',
  },
  'con-novedades': {
    titulo: 'Con observaciones',
    explica:
      'Palets con observaciones cargadas por los operarios: roturas, faltantes, humedad. Se lee la última acá abajo, sin entrar a cada uno.',
  },
}

const GALPONES: Galpon[] = [1, 2, 3]

/** `12/08/2026 14:35` — cuándo se trajeron los datos. */
function formatearHora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

/** `12/08 14:35` — corto, porque va dentro de una fila del listado. */
function formatearFechaCorta(iso: string): string {
  const fecha = new Date(iso)

  if (Number.isNaN(fecha.getTime())) return iso

  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatearFecha(fecha: string | null): string {
  if (fecha === null) return '—'

  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  return partes === null ? fecha : `${partes[3]}/${partes[2]}/${partes[1]}`
}

interface PropsAlerta {
  titulo: string
  cantidad: number
  cargando: boolean
  tono: 'peligro' | 'advertencia' | 'neutral'
  activa: boolean
  onClick: () => void
}

function TarjetaDeAlerta({ titulo, cantidad, cargando, tono, activa, onClick }: PropsAlerta) {
  // Banda de color arriba en vez de fondo lleno: cuatro tarjetas con el fondo
  // pintado compiten entre sí y ninguna resalta. La banda marca la urgencia sin
  // robarle contraste a la cifra, que es el dato.
  const banda = {
    peligro: 'bg-red-600',
    advertencia: 'bg-amber-500',
    neutral: 'bg-piedra-300',
  } as const

  const vacia = cantidad === 0 && !cargando

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'relative overflow-hidden rounded-lg border bg-white px-4 py-3 text-left transition-colors',
        activa
          ? 'border-piedra-800 ring-1 ring-piedra-800'
          : 'border-piedra-200 hover:border-piedra-300 hover:bg-piedra-50',
      )}
    >
      <span
        aria-hidden="true"
        className={cx('absolute inset-x-0 top-0 h-1', vacia ? 'bg-piedra-200' : banda[tono])}
      />

      <span
        className={cx(
          'cifra block text-3xl leading-none font-bold',
          vacia ? 'text-piedra-300' : 'text-piedra-900',
        )}
      >
        {cargando ? <Spinner tamaño="sm" decorativo /> : cantidad}
      </span>

      <span className="mt-1.5 block text-sm font-medium text-piedra-600">{titulo}</span>
    </button>
  )
}

/** Una fila del listado. Sin acciones: abre el detalle, nada más. */
function FilaPalet({ palet, onAbrir }: { palet: PaletGerencia; onAbrir: () => void }) {
  const vencido = palet.dias_para_vencer !== null && palet.dias_para_vencer < 0
  const porVencer =
    palet.dias_para_vencer !== null &&
    palet.dias_para_vencer >= 0 &&
    palet.dias_para_vencer <= 30

  return (
    <Card comoBoton onClick={onAbrir}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-piedra-900">
            <span className="cifra text-piedra-500">#{palet.id}</span>{' '}
            {palet.producto_nombre}
          </p>
          <p className="mt-0.5 text-sm text-piedra-500">
            Lote {palet.lote} · Galpón {palet.galpon}
            {palet.sector !== null && ` · ${palet.sector}`}
          </p>
          {palet.cliente_nombre !== null && (
            <p className="mt-0.5 truncate text-sm font-medium text-piedra-600">
              Cliente: {palet.cliente_nombre}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <EstadoPaletBadge estado={palet.estado} />

            {vencido && <Badge variante="peligro">Vencido</Badge>}
            {porVencer && (
              <Badge variante="advertencia">Vence en {palet.dias_para_vencer} d</Badge>
            )}
            {palet.dias_sin_movimiento >= DIAS_INMOVILIZADO && (
              <Badge variante="neutral">Quieto {palet.dias_sin_movimiento} d</Badge>
            )}
          </div>

          {/* La última nota, para no tener que abrir el palet: es el motivo
              por el que el jefe entraría, así que se muestra directamente. */}
          {palet.ultima_observacion !== null && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-sm whitespace-pre-line text-amber-900">
                «{palet.ultima_observacion}»
              </p>
              <p className="mt-1 text-xs text-amber-700">
                {palet.ultima_observacion_autor ?? 'Alguien'}
                {palet.ultima_observacion_fecha !== null &&
                  ` · ${formatearFechaCorta(palet.ultima_observacion_fecha)}`}
                {palet.cantidad_observaciones > 1 &&
                  ` · ${palet.cantidad_observaciones} observaciones en total`}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="cifra text-2xl leading-none font-bold text-piedra-900">
            {palet.cantidad_disponible}
          </p>
          <p className="cifra mt-0.5 text-xs text-piedra-500">
            de {palet.cantidad_inicial} {palet.producto_unidad_medida}
          </p>
        </div>
      </div>
    </Card>
  )
}

export function PanelGerencia() {
  const navegar = useNavigate()
  const clienteDeQueries = useQueryClient()

  const [pregunta, setPregunta] = useState<PreguntaDeNegocio>('todo')
  const [galpon, setGalpon] = useState<Galpon | undefined>(undefined)
  const [categoria, setCategoria] = useState<Categoria | undefined>(undefined)
  const [estado, setEstado] = useState<EstadoPalet | undefined>(undefined)
  const [productoId, setProductoId] = useState<number | undefined>(undefined)
  const [clienteId, setClienteId] = useState<number | 'propia' | undefined>(undefined)
  const [lote, setLote] = useState('')
  // Igual que en el buscador del operario: sin esto, cada tecla del filtro de
  // lote es una consulta.
  const loteBuscado = useValorDemorado(lote)
  const [actualizado, setActualizado] = useState(() => new Date())

  const { data: productos } = useProductos()
  const { data: clientes } = useClientes()
  const alertas = useAlertas()
  const { data: stock, isPending: cargandoStock } = useStockPorProducto()

  const filtros = { pregunta, galpon, categoria, estado, productoId, clienteId, lote: loteBuscado }
  const { data: palets, isPending, isError, error, isFetching } = usePaletsGerencia(filtros)

  function refrescar() {
    void clienteDeQueries.invalidateQueries({ queryKey: CLAVE_GERENCIA })
    setActualizado(new Date())
  }

  const totalDisponible = stock?.reduce((suma, fila) => suma + fila.total_disponible, 0) ?? 0
  const productosConStock = stock?.filter((fila) => fila.palets_con_stock > 0).length ?? 0

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- Encabezado con refresco ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-piedra-500">
          Actualizado a las {formatearHora(actualizado)}
        </p>
        <Button variante="secundario" cargando={isFetching} onClick={refrescar}>
          {isFetching ? 'Actualizando…' : 'Actualizar'}
        </Button>
      </div>

      {/* ---------- Preguntas de negocio ---------- */}
      <section>
        <h2 className="rotulo mb-2">Qué necesita atención</h2>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {alertas.map((alerta) => (
            <TarjetaDeAlerta
              key={alerta.pregunta}
              titulo={PREGUNTAS[alerta.pregunta].titulo}
              cantidad={alerta.cantidad}
              cargando={alerta.cargando}
              tono={
                alerta.pregunta === 'vencidos'
                  ? 'peligro'
                  : alerta.pregunta === 'vence-30' || alerta.pregunta === 'con-novedades'
                    ? 'advertencia'
                    : 'neutral'
              }
              activa={pregunta === alerta.pregunta}
              onClick={() =>
                setPregunta(pregunta === alerta.pregunta ? 'todo' : alerta.pregunta)
              }
            />
          ))}
        </div>
      </section>

      {/* ---------- Stock consolidado ---------- */}
      <section>
        <h2 className="rotulo mb-2">Stock por producto</h2>

        <Card sinPadding>
          <div className="flex flex-wrap gap-6 border-b border-piedra-100 p-4">
            <div>
              <p className="cifra text-2xl leading-none font-bold text-piedra-900">
                {productosConStock}
              </p>
              <p className="mt-1 text-sm text-piedra-500">productos con stock</p>
            </div>
            <div>
              <p className="cifra text-2xl leading-none font-bold text-piedra-900">
                {totalDisponible.toLocaleString('es-AR')}
              </p>
              <p className="mt-1 text-sm text-piedra-500">unidades en total</p>
            </div>
          </div>

          {cargandoStock ? (
            <div className="flex justify-center p-6 text-marca-700">
              <Spinner etiqueta="Cargando stock" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-piedra-200">
                  <tr>
                    <th className="rotulo p-3">Producto</th>
                    <th className="rotulo p-3 text-right">Disponible</th>
                    <th className="rotulo p-3 text-right">Palets</th>
                    <th className="rotulo p-3">Galpones</th>
                    <th className="rotulo p-3">Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {stock
                    ?.filter((fila) => fila.palets_con_stock > 0)
                    .map((fila) => (
                      <tr
                        key={fila.producto_id}
                        className="border-b border-piedra-100 last:border-b-0"
                      >
                        <td className="p-3">
                          <span className="font-medium text-piedra-900">
                            {fila.producto_nombre}
                          </span>
                          <span className="ml-2 text-xs text-piedra-500">
                            {fila.producto_categoria === 'agroquimico'
                              ? 'agroquímico'
                              : 'semilla'}
                          </span>
                        </td>
                        <td className="cifra p-3 text-right font-semibold text-piedra-900">
                          {fila.total_disponible}{' '}
                          <span className="font-normal text-piedra-500">
                            {fila.producto_unidad_medida}
                          </span>
                        </td>
                        <td className="cifra p-3 text-right text-piedra-600">
                          {fila.palets_con_stock}
                          {fila.palets_parciales > 0 && (
                            <span className="text-piedra-400">
                              {' '}
                              ({fila.palets_parciales} abiertos)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-piedra-600">
                          {fila.galpones.length > 0 ? fila.galpones.join(', ') : '—'}
                        </td>
                        <td className="p-3 text-piedra-600">
                          {formatearFecha(fila.proximo_vencimiento)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* ---------- Listado con filtros ---------- */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="rotulo">{PREGUNTAS[pregunta].titulo}</h2>
          {pregunta !== 'todo' && (
            <Button variante="fantasma" onClick={() => setPregunta('todo')}>
              Ver todo
            </Button>
          )}
        </div>

        <p className="-mt-2 text-sm text-piedra-500">{PREGUNTAS[pregunta].explica}</p>

        <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label
              htmlFor="filtro-lote"
              className="mb-1 block text-sm font-medium text-piedra-700"
            >
              Lote
            </label>
            <Input
              id="filtro-lote"
              type="search"
              value={lote}
              onChange={(evento) => setLote(evento.target.value)}
              placeholder="Buscar por lote"
            />
          </div>

          <div>
            <label
              htmlFor="filtro-producto"
              className="mb-1 block text-sm font-medium text-piedra-700"
            >
              Producto
            </label>
            <Select
              id="filtro-producto"
              value={productoId === undefined ? '' : String(productoId)}
              onChange={(evento) =>
                setProductoId(evento.target.value === '' ? undefined : Number(evento.target.value))
              }
            >
              <option value="">Todos</option>
              {productos?.map((producto) => (
                <option key={producto.id} value={String(producto.id)}>
                  {producto.nombre}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label
              htmlFor="filtro-cliente"
              className="mb-1 block text-sm font-medium text-piedra-700"
            >
              Cliente
            </label>
            <Select
              id="filtro-cliente"
              value={clienteId === undefined ? '' : String(clienteId)}
              onChange={(evento) => {
                const valor = evento.target.value
                setClienteId(
                  valor === '' ? undefined : valor === 'propia' ? 'propia' : Number(valor),
                )
              }}
            >
              <option value="">Todos</option>
              <option value="propia">AIBAR S.R.L</option>
              {clientes?.map((cliente) => (
                <option key={cliente.id} value={String(cliente.id)}>
                  {cliente.nombre}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label
              htmlFor="filtro-categoria"
              className="mb-1 block text-sm font-medium text-piedra-700"
            >
              Categoría
            </label>
            <Select
              id="filtro-categoria"
              value={categoria ?? ''}
              onChange={(evento) =>
                setCategoria(
                  evento.target.value === '' ? undefined : (evento.target.value as Categoria),
                )
              }
            >
              <option value="">Todas</option>
              <option value="agroquimico">Agroquímico</option>
              <option value="semilla">Semilla</option>
            </Select>
          </div>

          <div>
            <label
              htmlFor="filtro-estado"
              className="mb-1 block text-sm font-medium text-piedra-700"
            >
              Estado
            </label>
            <Select
              id="filtro-estado"
              value={estado ?? ''}
              onChange={(evento) =>
                setEstado(
                  evento.target.value === '' ? undefined : (evento.target.value as EstadoPalet),
                )
              }
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="parcial">Parcial</option>
              <option value="vacio">Vacío</option>
              <option value="baja">De baja</option>
            </Select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <p className="mb-1 text-sm font-medium text-piedra-700">Galpón</p>
            <div className="flex gap-2">
              <Button
                variante={galpon === undefined ? 'primario' : 'secundario'}
                onClick={() => setGalpon(undefined)}
                className="flex-1 sm:flex-none"
              >
                Todos
              </Button>
              {GALPONES.map((numero) => (
                <Button
                  key={numero}
                  variante={galpon === numero ? 'primario' : 'secundario'}
                  onClick={() => setGalpon(numero)}
                  className="flex-1 sm:flex-none"
                >
                  Galpón {numero}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {isPending ? (
          <div className="flex justify-center py-12 text-marca-700">
            <Spinner tamaño="lg" etiqueta="Cargando palets" />
          </div>
        ) : isError ? (
          <ErrorMessage
            titulo="No se pudieron cargar los palets"
            mensaje={error.message}
            onReintentar={refrescar}
          />
        ) : palets.length === 0 ? (
          <EmptyState
            titulo="No hay palets en esta situación"
            descripcion={
              pregunta === 'todo'
                ? 'Todavía no hay palets cargados, o los filtros no dejan pasar ninguno.'
                : 'Buena noticia: no hay ninguno que cumpla este criterio.'
            }
          />
        ) : (
          <>
            <p className="text-sm text-piedra-500">
              {palets.length} palet{palets.length === 1 ? '' : 's'}
            </p>

            <div className="grid gap-3 lg:grid-cols-2">
              {palets.map((palet) => (
                <FilaPalet
                  key={palet.id}
                  palet={palet}
                  onAbrir={() => navegar(rutaPaletGerencia(palet.id))}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
