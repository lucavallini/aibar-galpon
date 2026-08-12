import { useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { usePalet } from '@/hooks/usePalet'
import { useMovimientosDePalet } from '@/hooks/useMovimientosDePalet'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { EstadoPaletBadge } from '@/components/EstadoPaletBadge'
import { EtiquetaPalet } from '@/components/EtiquetaPalet'
import { HistorialMovimientos } from '@/components/HistorialMovimientos'
import { RegistrarMovimiento } from '@/components/RegistrarMovimiento'
import { CorregirMovimiento } from '@/components/CorregirMovimiento'
import { BitacoraPalet } from '@/components/BitacoraPalet'
import { EditarPalet } from '@/components/EditarPalet'
import { useVentanaDeCorreccion } from '@/hooks/useVentanaDeCorreccion'
import { useOffline } from '@/hooks/useOffline'
import { ErrorSupabase } from '@/lib/queries/errores'
import { RUTAS } from '@/rutas'
import type { MovimientoConAutor } from '@/types'

/**
 * Detalle de un palet: lo que ve el operario al escanear su QR y también al
 * terminar de darlo de alta.
 *
 * Es una sola pantalla para los dos momentos —con `?creado=1` agrega el aviso de
 * alta— porque mostraban exactamente lo mismo y mantener dos era duplicar.
 */

interface PropsDato {
  etiqueta: string
  children: ReactNode
}

function Dato({ etiqueta, children }: PropsDato) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-2 last:border-b-0">
      <dt className="text-base text-neutral-500">{etiqueta}</dt>
      <dd className="text-right text-base font-medium text-neutral-900">{children}</dd>
    </div>
  )
}

/** `2026-08-12` a `12/08/2026`, sin correr el día por la zona horaria. */
function formatearFecha(fecha: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)

  if (partes === null) return fecha

  return `${partes[3]}/${partes[2]}/${partes[1]}`
}

export function DetallePalet() {
  const navegar = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [parametros] = useSearchParams()
  const { usuario } = useAuth()
  const { paletTienePendientes, enLinea } = useOffline()

  const [registrando, setRegistrando] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState<MovimientoConAutor | null>(null)
  const [editando, setEditando] = useState(false)

  const reciénCreado = parametros.get('creado') === '1'
  const idNumerico = id !== undefined && /^\d+$/.test(id) ? Number(id) : null

  const {
    data: palet,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = usePalet(idNumerico)

  const {
    data: movimientos,
    isPending: cargandoMovimientos,
    isError: falloHistorial,
    error: errorHistorial,
    refetch: reintentarHistorial,
  } = useMovimientosDePalet(idNumerico)

  // La lista viene del más reciente al más viejo, así que el corregible —si hay
  // alguno— solo puede ser el primero. El hook además lo da de baja solo cuando
  // se cumplen los 30 minutos, sin necesidad de recargar.
  const ultimoMovimiento = movimientos?.[0] ?? null
  const sePuedeCorregir = useVentanaDeCorreccion(ultimoMovimiento)

  if (idNumerico === null) {
    return (
      <EmptyState
        titulo="Dirección no válida"
        descripcion="Esta dirección no corresponde a ningún palet."
        accion={<Button onClick={() => navegar(RUTAS.operario)}>Volver al inicio</Button>}
      />
    )
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-12 text-marca-700">
        <Spinner tamaño="lg" etiqueta="Cargando el palet" />
      </div>
    )
  }

  if (isError) {
    // PGRST116 es «no se encontró la fila»: o el palet no existe, o RLS lo
    // oculta. Para el operario es lo mismo y merece un mensaje propio, no el
    // error crudo de Postgres.
    const noExiste = error instanceof ErrorSupabase && error.codigo === 'PGRST116'

    if (noExiste) {
      return (
        <EmptyState
          titulo={`No existe el palet #${idNumerico}`}
          descripcion="El código que escaneaste apunta a un palet que no está en el sistema. Puede haber sido eliminado, o la etiqueta ser de otro depósito."
          accion={
            <Button onClick={() => navegar(RUTAS.escanear)}>Escanear otro</Button>
          }
        />
      )
    }

    return (
      <ErrorMessage
        titulo="No se pudo cargar el palet"
        mensaje={error.message}
        onReintentar={() => void refetch()}
      />
    )
  }

  const unidad = palet.producto.unidad_medida
  const dadoDeBaja = palet.estado === 'baja'
  const sinStock = palet.cantidad_disponible === 0
  const hayPendientesDeEstePalet = paletTienePendientes(palet.id)

  return (
    <div className="flex flex-col gap-4">
      {reciénCreado && (
        <p
          role="status"
          className="rounded-lg border border-marca-200 bg-marca-50 px-4 py-3 text-center text-base font-medium text-marca-900"
        >
          Palet creado. Imprimí la etiqueta y pegala en el palet.
        </p>
      )}

      {dadoDeBaja && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="font-semibold text-red-900">Este palet está dado de baja</p>
          <p className="mt-1 text-base text-red-800">
            No se pueden registrar movimientos sobre él. Si es un error, hablá con el
            encargado.
          </p>
        </div>
      )}

      {/* El operario tiene que saber cuándo el número que ve puede no ser el
          real: o porque hay movimientos suyos sin sincronizar, o porque está
          viendo datos guardados de la última vez que hubo señal. */}
      {hayPendientesDeEstePalet && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="font-semibold text-amber-900">Tenés movimientos sin registrar</p>
          <p className="mt-1 text-base text-amber-900">
            El número de abajo es el que hay en el sistema y todavía no incluye lo que
            registraste sin señal. Va a cambiar cuando se sincronice.
          </p>
        </div>
      )}

      {!enLinea && !hayPendientesDeEstePalet && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="font-semibold text-amber-900">Sin señal</p>
          <p className="mt-1 text-base text-amber-900">
            Estos son los últimos datos que se pudieron traer. Puede que otro operario
            haya movido este palet desde entonces.
          </p>
        </div>
      )}

      {/* --- Lo que se busca al escanear: cuánto queda --- */}
      <Card className="text-center">
        <p className="text-base text-neutral-500">Disponible</p>
        <p
          className={
            sinStock
              ? 'mt-1 text-6xl font-bold tracking-tight text-neutral-400'
              : 'mt-1 text-6xl font-bold tracking-tight text-marca-800'
          }
        >
          {palet.cantidad_disponible}
        </p>
        <p className="mt-1 text-lg text-neutral-600">{unidad}</p>

        <p className="mt-2 text-sm text-neutral-500">
          de {palet.cantidad_inicial} {unidad} iniciales
        </p>

        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="text-base font-medium text-neutral-700">Palet #{palet.id}</span>
          <EstadoPaletBadge estado={palet.estado} />
        </div>
      </Card>

      {/* La acción principal de esta pantalla: descontar stock.
          La base lo rechazaría igual, pero deshabilitarlo evita que el operario
          llene un formulario para que después le digan que no. */}
      {!dadoDeBaja && (
        <Button
          tamaño="lg"
          anchoCompleto
          disabled={sinStock}
          onClick={() => setRegistrando(true)}
        >
          {sinStock ? 'Sin stock para registrar' : 'Registrar movimiento'}
        </Button>
      )}

      <RegistrarMovimiento
        palet={palet}
        abierto={registrando}
        onCerrar={() => setRegistrando(false)}
      />

      <CorregirMovimiento
        palet={palet}
        movimiento={corrigiendo}
        onCerrar={() => setCorrigiendo(null)}
      />

      <EditarPalet
        palet={palet}
        abierto={editando}
        onCerrar={() => setEditando(false)}
      />

      {/* --- Identificación --- */}
      <Card>
        <dl>
          <Dato etiqueta="Producto">{palet.producto.nombre}</Dato>
          <Dato etiqueta="Lote">{palet.lote}</Dato>
          <Dato etiqueta="Cliente">
            {palet.cliente?.nombre ?? 'AIBAR S.R.L'}
          </Dato>
          <Dato etiqueta="Galpón">
            {palet.galpon}
            {palet.sector !== null && ` · ${palet.sector}`}
          </Dato>
          <Dato etiqueta="Ingreso">{formatearFecha(palet.fecha_ingreso)}</Dato>

          {palet.detalle_agroquimico !== null && (
            <>
              <Dato etiqueta="Elaboración">
                {palet.detalle_agroquimico.fecha_elaboracion !== null
                  ? formatearFecha(palet.detalle_agroquimico.fecha_elaboracion)
                  : '—'}
              </Dato>
              <Dato etiqueta="Vencimiento">
                {palet.detalle_agroquimico.fecha_vencimiento !== null
                  ? formatearFecha(palet.detalle_agroquimico.fecha_vencimiento)
                  : '—'}
              </Dato>
            </>
          )}

          {palet.detalle_semilla !== null && (
            <>
              <Dato etiqueta="Híbrido">{palet.detalle_semilla.hibrido ?? '—'}</Dato>
              <Dato etiqueta="Calibre">{palet.detalle_semilla.calibre ?? '—'}</Dato>
            </>
          )}
        </dl>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button
            variante="fantasma"
            anchoCompleto
            cargando={isFetching}
            onClick={() => {
              void refetch()
              void reintentarHistorial()
            }}
          >
            {isFetching ? 'Actualizando…' : 'Actualizar datos'}
          </Button>

          {/* Un palet dado de baja ya no se corrige: quedó fuera de
              circulación y su historial tiene que reflejar cómo estaba. */}
          {!dadoDeBaja && (
            <Button variante="secundario" anchoCompleto onClick={() => setEditando(true)}>
              Corregir datos
            </Button>
          )}
        </div>
      </Card>

      {/* --- Historial --- */}
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-neutral-900">Movimientos</h2>

        {cargandoMovimientos ? (
          <div className="flex justify-center py-6 text-marca-700">
            <Spinner etiqueta="Cargando movimientos" />
          </div>
        ) : falloHistorial ? (
          <ErrorMessage
            mensaje={errorHistorial.message}
            onReintentar={() => void reintentarHistorial()}
          />
        ) : (
          <HistorialMovimientos
            movimientos={movimientos}
            usuarioActualId={usuario?.id ?? null}
            unidad={unidad}
            idCorregible={
              sePuedeCorregir && ultimoMovimiento !== null ? ultimoMovimiento.id : null
            }
            onCorregir={setCorrigiendo}
          />
        )}
      </Card>

      <BitacoraPalet paletId={palet.id} />

      <EtiquetaPalet
        id={palet.id}
        producto={palet.producto.nombre}
        lote={palet.lote}
        cantidad={`${palet.cantidad_inicial} ${unidad}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button tamaño="lg" anchoCompleto onClick={() => navegar(RUTAS.escanear)}>
          Escanear otro palet
        </Button>
        <Button
          variante="secundario"
          anchoCompleto
          onClick={() => navegar(reciénCreado ? RUTAS.nuevoPalet : RUTAS.operario)}
        >
          {reciénCreado ? 'Dar de alta otro' : 'Volver al inicio'}
        </Button>
      </div>
    </div>
  )
}
