import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useBuscarPalets } from '@/hooks/useBuscarPalets'
import { useValorDemorado } from '@/hooks/useValorDemorado'
import { useClientes } from '@/hooks/useClientes'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EstadoPaletBadge } from '@/components/EstadoPaletBadge'
import { cx } from '@/lib/cx'
import { rutaPalet } from '@/rutas'
import type { Categoria, Galpon, PaletConProducto } from '@/types'

/**
 * Listado y búsqueda de palets.
 *
 * Es el camino alternativo al QR: cuando la etiqueta se despegó, se mojó o no
 * lee, esta pantalla es la única forma de llegar a un palet.
 *
 * Cada dato tiene su casilla en vez de un buscador único. Con un solo campo, el
 * operario no sabe qué se espera que escriba —¿el número?, ¿el lote?— y no
 * puede combinar dos criterios. Separados, cada casilla dice exactamente qué
 * lleva, y se pueden usar juntas: el lote «A» *dentro del* sector «Pasillo B».
 */

const GALPONES: Galpon[] = [1, 2, 3]

interface PropsFila {
  palet: PaletConProducto
  onAbrir: () => void
}

function FilaDePalet({ palet, onAbrir }: PropsFila) {
  return (
    <Card comoBoton onClick={onAbrir}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-piedra-900">
            <span className="cifra text-piedra-500">#{palet.id}</span>{' '}
            {palet.producto.nombre}
          </p>
          <p className="mt-0.5 truncate text-sm text-piedra-500">
            Lote {palet.lote} · Galpón {palet.galpon}
            {palet.sector !== null ? (
              <span className="font-medium text-piedra-700"> · {palet.sector}</span>
            ) : (
              <span className="font-semibold text-amber-800"> · sin ubicar</span>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="cifra text-xl leading-none font-bold text-piedra-900">
            {palet.cantidad_disponible}
          </p>
          <p className="mt-0.5 text-xs text-piedra-500">{palet.unidad_medida}</p>
        </div>
      </div>

      <div className="mt-2">
        <EstadoPaletBadge estado={palet.estado} />
      </div>
    </Card>
  )
}

interface PropsCampo {
  id: string
  etiqueta: string
  valor: string
  onCambiar: (valor: string) => void
  placeholder: string
  soloNumeros?: boolean
}

function Campo({ id, etiqueta, valor, onCambiar, placeholder, soloNumeros }: PropsCampo) {
  return (
    <div>
      <label htmlFor={id} className="rotulo mb-1 block">
        {etiqueta}
      </label>
      <Input
        id={id}
        type="search"
        value={valor}
        onChange={(evento) => onCambiar(evento.target.value)}
        placeholder={placeholder}
        // Teclado numérico para el número de palet: menos errores de tipeo con
        // guantes que el alfanumérico completo.
        inputMode={soloNumeros === true ? 'numeric' : 'search'}
        autoComplete="off"
      />
    </div>
  )
}

export function BuscarPalets() {
  const navegar = useNavigate()
  const { data: clientes } = useClientes()

  const [numero, setNumero] = useState('')
  const [lote, setLote] = useState('')
  const [sector, setSector] = useState('')
  const [producto, setProducto] = useState('')
  const [galpon, setGalpon] = useState<Galpon | undefined>(undefined)
  const [categoria, setCategoria] = useState<Categoria | undefined>(undefined)
  const [clienteId, setClienteId] = useState<number | 'propia' | undefined>(undefined)
  const [soloConStock, setSoloConStock] = useState(true)
  const [soloSinUbicar, setSoloSinUbicar] = useState(false)

  // Los campos se actualizan en cada tecla, pero la consulta espera a que el
  // operario termine de escribir.
  const filtros = {
    numero: useValorDemorado(numero),
    lote: useValorDemorado(lote),
    sector: useValorDemorado(sector),
    producto: useValorDemorado(producto),
    galpon,
    categoria,
    clienteId,
    soloConStock,
    soloSinUbicar,
  }

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
  } = useBuscarPalets(filtros)

  const palets = data?.pages.flatMap((pagina) => pagina.palets) ?? []

  const hayFiltros =
    filtros.numero.trim() !== '' ||
    filtros.lote.trim() !== '' ||
    filtros.sector.trim() !== '' ||
    filtros.producto.trim() !== '' ||
    galpon !== undefined ||
    categoria !== undefined ||
    clienteId !== undefined ||
    soloSinUbicar ||
    !soloConStock

  function limpiar() {
    setNumero('')
    setLote('')
    setSector('')
    setProducto('')
    setGalpon(undefined)
    setCategoria(undefined)
    setClienteId(undefined)
    setSoloConStock(true)
    setSoloSinUbicar(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            id="buscar-numero"
            etiqueta="Número de palet"
            valor={numero}
            onCambiar={setNumero}
            placeholder="Ej. 152"
            soloNumeros
          />
          <Campo
            id="buscar-lote"
            etiqueta="Lote"
            valor={lote}
            onCambiar={setLote}
            placeholder="Ej. L-2026"
          />
          <Campo
            id="buscar-sector"
            etiqueta="Sector"
            valor={sector}
            onCambiar={setSector}
            placeholder="Ej. Pasillo B"
          />
          <Campo
            id="buscar-producto"
            etiqueta="Producto"
            valor={producto}
            onCambiar={setProducto}
            placeholder="Ej. Glifosato"
          />
        </div>

        {/* Tipo y galpón van como botones y no como selects: son pocas
            opciones, se ven todas de una y se tocan con guantes. */}
        <div>
          <p className="rotulo mb-1.5">Tipo</p>
          <div className="flex gap-2">
            <Button
              variante={categoria === undefined ? 'primario' : 'secundario'}
              onClick={() => setCategoria(undefined)}
              className="flex-1"
            >
              Todos
            </Button>
            <Button
              variante={categoria === 'agroquimico' ? 'primario' : 'secundario'}
              onClick={() => setCategoria('agroquimico')}
              className="flex-1"
            >
              Agroquímicos
            </Button>
            <Button
              variante={categoria === 'semilla' ? 'primario' : 'secundario'}
              onClick={() => setCategoria('semilla')}
              className="flex-1"
            >
              Semillas
            </Button>
          </div>
        </div>

        <div>
          <p className="rotulo mb-1.5">Galpón</p>
          <div className="flex gap-2">
            <Button
              variante={galpon === undefined ? 'primario' : 'secundario'}
              onClick={() => setGalpon(undefined)}
              className="flex-1"
            >
              Todos
            </Button>
            {GALPONES.map((numeroGalpon) => (
              <Button
                key={numeroGalpon}
                variante={galpon === numeroGalpon ? 'primario' : 'secundario'}
                onClick={() => setGalpon(numeroGalpon)}
                className="flex-1"
              >
                {numeroGalpon}
              </Button>
            ))}
          </div>
        </div>

        {/* La empresa va como select y no como botones: los clientes son
            muchos y crecen, mientras que los tipos y los galpones son tres. */}
        <div>
          <label
            htmlFor="buscar-empresa"
            className="rotulo mb-1.5 block"
          >
            Empresa
          </label>
          <Select
            id="buscar-empresa"
            value={clienteId === undefined ? '' : String(clienteId)}
            onChange={(evento) => {
              const valor = evento.target.value
              setClienteId(
                valor === '' ? undefined : valor === 'propia' ? 'propia' : Number(valor),
              )
            }}
          >
            <option value="">Todas</option>
            {/* Un palet sin cliente es mercadería propia: en la base es un
                `null`, no una empresa más de la lista. */}
            <option value="propia">AIBAR S.R.L</option>
            {clientes?.map((cliente) => (
              <option key={cliente.id} value={String(cliente.id)}>
                {cliente.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-toque cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={soloConStock}
              onChange={(evento) => setSoloConStock(evento.target.checked)}
              className="size-5 accent-marca-700"
            />
            <span className="text-base text-piedra-700">Solo palets con stock</span>
          </label>

          {/* Los palets de un alta en lote nacen sin sector: este filtro es la
              lista de los que todavía hay que ubicar en el galpón. */}
          <label className="flex min-h-toque cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={soloSinUbicar}
              onChange={(evento) => setSoloSinUbicar(evento.target.checked)}
              className="size-5 accent-marca-700"
            />
            <span className="text-base text-piedra-700">Solo sin ubicar</span>
          </label>

          {hayFiltros && (
            <Button variante="fantasma" onClick={limpiar}>
              Limpiar búsqueda
            </Button>
          )}
        </div>
      </Card>

      {isPending ? (
        <div className="flex justify-center py-12 text-marca-700">
          <Spinner tamaño="lg" etiqueta="Buscando palets" />
        </div>
      ) : isError ? (
        <ErrorMessage
          titulo="No se pudieron cargar los palets"
          mensaje={error.message}
          onReintentar={() => void refetch()}
        />
      ) : palets.length === 0 ? (
        <EmptyState
          titulo={hayFiltros ? 'No se encontró ningún palet' : 'Todavía no hay palets'}
          descripcion={
            hayFiltros
              ? 'Probá con menos casillas: cuantas más completes, más se achica la búsqueda. Si el palet está vacío o dado de baja, destildá «Solo palets con stock».'
              : 'Cuando des de alta el primer palet va a aparecer acá.'
          }
        />
      ) : (
        <>
          <p className={cx('text-sm text-piedra-500', isFetching && 'opacity-60')}>
            {palets.length} palet{palets.length === 1 ? '' : 's'}
            {hasNextPage === true && ' (hay más)'}
          </p>

          <div className="flex flex-col gap-3">
            {palets.map((palet) => (
              <FilaDePalet
                key={palet.id}
                palet={palet}
                onAbrir={() => navegar(rutaPalet(palet.id))}
              />
            ))}
          </div>

          {hasNextPage === true && (
            <Button
              variante="secundario"
              tamaño="lg"
              anchoCompleto
              cargando={isFetchingNextPage}
              onClick={() => void fetchNextPage()}
            >
              {isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
