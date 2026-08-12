import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useBuscarPalets } from '@/hooks/useBuscarPalets'
import { useValorDemorado } from '@/hooks/useValorDemorado'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EstadoPaletBadge } from '@/components/EstadoPaletBadge'
import { cx } from '@/lib/cx'
import { rutaPalet } from '@/rutas'
import type { Galpon, PaletConProducto } from '@/types'

/**
 * Listado y búsqueda de palets.
 *
 * Es el camino alternativo al QR: cuando la etiqueta se despegó, se mojó o no
 * lee, esta pantalla es la única forma de llegar a un palet. Por eso busca por
 * lo que se pueda tener a mano —el número, el lote del remito o el producto— y
 * no solo por un campo.
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
            #{palet.id} · {palet.producto.nombre}
          </p>
          <p className="mt-0.5 truncate text-sm text-piedra-500">
            Lote {palet.lote} · Galpón {palet.galpon}
            {palet.sector !== null && ` · ${palet.sector}`}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-xl font-bold text-marca-800">{palet.cantidad_disponible}</p>
          <p className="text-xs text-piedra-500">{palet.producto.unidad_medida}</p>
        </div>
      </div>

      <div className="mt-2">
        <EstadoPaletBadge estado={palet.estado} />
      </div>
    </Card>
  )
}

export function BuscarPalets() {
  const navegar = useNavigate()

  const [texto, setTexto] = useState('')
  // El campo se actualiza en cada tecla, pero la consulta espera a que el
  // operario termine de escribir.
  const textoBuscado = useValorDemorado(texto)
  const [galpon, setGalpon] = useState<Galpon | undefined>(undefined)
  const [soloConStock, setSoloConStock] = useState(true)

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
  } = useBuscarPalets({ texto: textoBuscado, galpon, soloConStock })

  const palets = data?.pages.flatMap((pagina) => pagina.palets) ?? []
  const hayFiltros = textoBuscado.trim() !== '' || galpon !== undefined || !soloConStock

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <label htmlFor="buscar-palet" className="text-base font-medium text-piedra-800">
          Buscar palet
        </label>

        <Input
          id="buscar-palet"
          type="search"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Número, lote o producto"
          inputMode="search"
          autoComplete="off"
        />

        {/* Filtro por galpón: botones y no un select, porque son tres opciones
            y se tocan con guantes. */}
        <div>
          <p className="mb-1.5 text-sm font-medium text-piedra-600">Galpón</p>
          <div className="flex gap-2">
            <Button
              variante={galpon === undefined ? 'primario' : 'secundario'}
              onClick={() => setGalpon(undefined)}
              className="flex-1"
            >
              Todos
            </Button>
            {GALPONES.map((numero) => (
              <Button
                key={numero}
                variante={galpon === numero ? 'primario' : 'secundario'}
                onClick={() => setGalpon(numero)}
                className="flex-1"
              >
                {numero}
              </Button>
            ))}
          </div>
        </div>

        <label className="flex min-h-toque cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={soloConStock}
            onChange={(evento) => setSoloConStock(evento.target.checked)}
            className="size-5 accent-marca-700"
          />
          <span className="text-base text-piedra-700">
            Solo palets con stock
          </span>
        </label>
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
              ? 'Probá con otro número, otro lote, o sacá los filtros. Si el palet está vacío o dado de baja, destildá «Solo palets con stock».'
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
