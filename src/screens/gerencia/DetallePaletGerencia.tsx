import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { usePaletGerencia } from '@/hooks/useGerencia'
import { useMovimientosDePalet } from '@/hooks/useMovimientosDePalet'
import { useAuth } from '@/hooks/useAuth'
import { DIAS_INMOVILIZADO } from '@/lib/queries/gerencia'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EstadoPaletBadge } from '@/components/EstadoPaletBadge'
import { FaroPalet } from '@/components/FaroPalet'
import { HistorialMovimientos } from '@/components/HistorialMovimientos'
import { BitacoraPalet } from '@/components/BitacoraPalet'
import { BotonDescargarMovimientos } from '@/components/BotonDescargarMovimientos'
import { formatearAnticipacion } from '@/lib/vencimiento'
import { RUTAS } from '@/rutas'

/**
 * Detalle de un palet para gerencia. **Solo lectura.**
 *
 * Es deliberadamente una pantalla aparte de la del operario y no la misma con
 * los botones ocultos: así no existe ninguna ruta de código por la que al jefe
 * se le pueda escapar una acción de escritura. Lo único que comparte es el
 * historial, que ya era de solo lectura.
 */

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-piedra-100 py-2 last:border-b-0">
      <dt className="text-base text-piedra-500">{etiqueta}</dt>
      <dd className="text-right text-base font-medium text-piedra-900">{children}</dd>
    </div>
  )
}

function formatearFecha(fecha: string | null): string {
  if (fecha === null) return '—'

  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  return partes === null ? fecha : `${partes[3]}/${partes[2]}/${partes[1]}`
}

export function DetallePaletGerencia() {
  const navegar = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { usuario } = useAuth()

  const idNumerico = id !== undefined && /^\d+$/.test(id) ? Number(id) : null

  const { data: palet, isPending, isError, error, refetch } = usePaletGerencia(idNumerico)
  const {
    data: movimientos,
    isPending: cargandoMovimientos,
    isError: falloHistorial,
    error: errorHistorial,
    refetch: reintentarHistorial,
  } = useMovimientosDePalet(idNumerico)

  if (idNumerico === null) {
    return (
      <EmptyState
        titulo="Dirección no válida"
        descripcion="Esta dirección no corresponde a ningún palet."
        accion={<Button onClick={() => navegar(RUTAS.gerencia)}>Volver al panel</Button>}
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
    return (
      <ErrorMessage
        titulo="No se pudo cargar el palet"
        mensaje={error.message}
        onReintentar={() => void refetch()}
      />
    )
  }

  if (palet === null) {
    return (
      <EmptyState
        titulo={`No existe el palet #${idNumerico}`}
        descripcion="Puede haber sido eliminado, o la etiqueta pertenecer a otro depósito."
        accion={<Button onClick={() => navegar(RUTAS.gerencia)}>Volver al panel</Button>}
      />
    )
  }

  const unidad = palet.unidad_medida
  const vencido = palet.dias_para_vencer !== null && palet.dias_para_vencer < 0
  const consumido = palet.cantidad_inicial - palet.cantidad_disponible

  return (
    <div className="flex flex-col gap-4">
      {vencido && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="font-semibold text-red-900">Producto vencido</p>
          <p className="mt-1 text-base text-red-800">
            Venció el {formatearFecha(palet.fecha_vencimiento)}, hace{' '}
            {Math.abs(palet.dias_para_vencer ?? 0)} días, y todavía figuran{' '}
            {palet.cantidad_disponible} {unidad} en stock.
          </p>
        </div>
      )}

      {/* El mismo bloque que ve el operario al escanear, y a propósito: cuando
          el jefe y el depósito hablan por teléfono sobre un palet, los dos
          tienen que estar mirando el mismo número en el mismo lugar. */}
      <FaroPalet
        disponible={palet.cantidad_disponible}
        inicial={palet.cantidad_inicial}
        unidad={unidad}
        apagado={palet.cantidad_disponible === 0 || palet.estado === 'baja'}
        encabezado={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="cifra text-base font-bold tracking-wide text-white">
              PALET {palet.id}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <EstadoPaletBadge estado={palet.estado} />
              {palet.dias_sin_movimiento >= DIAS_INMOVILIZADO && (
                <Badge variante="neutral">Quieto {palet.dias_sin_movimiento} días</Badge>
              )}
            </div>
          </div>
        }
      />

      <p className="cifra -mt-1 text-sm text-piedra-500">
        Salieron {consumido} {unidad} desde que ingresó.
      </p>

      <Card>
        <dl>
          <Dato etiqueta="Producto">{palet.producto_nombre}</Dato>
          <Dato etiqueta="Categoría">
            {palet.producto_categoria === 'agroquimico' ? 'Agroquímico' : 'Semilla'}
          </Dato>
          <Dato etiqueta="Lote">{palet.lote}</Dato>
          <Dato etiqueta="Empresa">
            {palet.cliente_nombre ?? 'AIBAR S.R.L'}
          </Dato>
          <Dato etiqueta="Ubicación">
            {palet.sector !== null ? (
              `Galpón ${palet.galpon} · ${palet.sector}`
            ) : (
              <span className="font-semibold text-amber-800">
                Galpón {palet.galpon} · sin ubicar
              </span>
            )}
          </Dato>
          <Dato etiqueta="Ingreso">{formatearFecha(palet.fecha_ingreso)}</Dato>
          <Dato etiqueta="Lo trajo">{palet.transportista_nombre ?? '—'}</Dato>

          {palet.producto_categoria === 'agroquimico' && (
            <>
              <Dato etiqueta="Elaboración">{formatearFecha(palet.fecha_elaboracion)}</Dato>
              <Dato etiqueta="Vencimiento">
                {formatearFecha(palet.fecha_vencimiento)}
                {palet.dias_para_vencer !== null && !vencido && (
                  <span className="ml-2 text-sm font-normal text-piedra-500">
                    (en {formatearAnticipacion(palet.dias_para_vencer)})
                  </span>
                )}
              </Dato>
            </>
          )}

          {palet.producto_categoria === 'semilla' && (
            <>
              <Dato etiqueta="Híbrido">{palet.hibrido ?? '—'}</Dato>
              <Dato etiqueta="Calibre">{palet.calibre ?? '—'}</Dato>
            </>
          )}

          <Dato etiqueta="Último movimiento">
            {palet.ultimo_movimiento !== null
              ? new Date(palet.ultimo_movimiento).toLocaleString('es-AR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Nunca se movió'}
          </Dato>
        </dl>
      </Card>

      {/* Solo lectura: el jefe lee la bitácora pero no escribe en ella. */}
      <BitacoraPalet paletId={palet.id} soloLectura />

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-piedra-900">
          Historial de movimientos
        </h2>

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
          // Sin `onCorregir`: el historial no ofrece ninguna acción al jefe.
          <HistorialMovimientos
            movimientos={movimientos}
            alta={{
              fecha: palet.fecha_ingreso,
              cantidad: palet.cantidad_inicial,
              transportista: palet.transportista_nombre,
            }}
            usuarioActualId={usuario?.id ?? null}
            unidad={unidad}
          />
        )}

        {/* Descargar no es escribir: el panel sigue siendo de solo lectura. */}
        <div className="mt-4">
          <BotonDescargarMovimientos
            palet={{
              id: palet.id,
              producto: palet.producto_nombre,
              lote: palet.lote,
              galpon: palet.galpon,
              sector: palet.sector,
              unidad,
              cantidadInicial: palet.cantidad_inicial,
              cantidadDisponible: palet.cantidad_disponible,
              estado: palet.estado,
              empresa: palet.cliente_nombre,
              transportista: palet.transportista_nombre,
              fechaIngreso: palet.fecha_ingreso,
            }}
            movimientos={movimientos ?? []}
          />
        </div>
      </Card>

      <Button variante="secundario" anchoCompleto onClick={() => navegar(RUTAS.gerencia)}>
        Volver al panel
      </Button>
    </div>
  )
}
