import { Badge, type VarianteBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cx } from '@/lib/cx'
import type { MovimientoConAutor, TipoMovimiento } from '@/types'

interface Props {
  movimientos: MovimientoConAutor[]
  /** Id del usuario que está mirando, para marcar sus propios movimientos. */
  usuarioActualId?: string | null
  unidad: string
  /**
   * Id del único movimiento que se puede corregir ahora mismo: el más reciente,
   * dentro de la ventana de 30 minutos. `null` si no hay ninguno.
   */
  idCorregible?: number | null
  onCorregir?: (movimiento: MovimientoConAutor) => void
}

/**
 * Presentación de cada tipo de movimiento.
 *
 * `correccion` es la única que suma stock, así que se distingue del resto: en el
 * historial tiene que quedar claro de un vistazo que ahí se deshizo algo.
 */
const PRESENTACION: Record<
  TipoMovimiento,
  { etiqueta: string; variante: VarianteBadge; signo: string }
> = {
  venta: { etiqueta: 'Venta', variante: 'info', signo: '−' },
  salida: { etiqueta: 'Salida', variante: 'neutral', signo: '−' },
  ajuste: { etiqueta: 'Ajuste', variante: 'advertencia', signo: '−' },
  correccion: { etiqueta: 'Corrección', variante: 'exito', signo: '+' },
}

/** `12/08/2026 14:35` a partir de un timestamptz. */
function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso)

  if (Number.isNaN(fecha.getTime())) return iso

  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistorialMovimientos({
  movimientos,
  usuarioActualId,
  unidad,
  idCorregible = null,
  onCorregir,
}: Props) {
  if (movimientos.length === 0) {
    return (
      <EmptyState
        titulo="Sin movimientos"
        descripcion="Este palet todavía está entero: no se registró ninguna salida."
      />
    )
  }

  /** Movimientos que ya fueron deshechos, para tacharlos. */
  const corregidos = new Set(
    movimientos
      .filter((movimiento) => movimiento.corrige_a !== null)
      .map((movimiento) => movimiento.corrige_a),
  )

  return (
    <ol className="flex flex-col">
      {movimientos.map((movimiento) => {
        const presentacion = PRESENTACION[movimiento.tipo]
        const esPropio =
          usuarioActualId != null && movimiento.usuario?.id === usuarioActualId
        const esCorreccion = movimiento.tipo === 'correccion'
        const fueCorregido = corregidos.has(movimiento.id)
        const sePuedeCorregir = movimiento.id === idCorregible && onCorregir !== undefined

        return (
          <li
            key={movimiento.id}
            className={cx(
              'border-b border-neutral-100 py-3 last:border-b-0',
              // La corrección se despega visualmente: es la única que suma.
              esCorreccion && '-mx-2 rounded-lg border-b-0 bg-marca-50 px-2',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variante={presentacion.variante}>{presentacion.etiqueta}</Badge>
              <span
                className={cx(
                  'text-base font-semibold',
                  esCorreccion ? 'text-marca-900' : 'text-neutral-900',
                  // Tachado: el movimiento sigue en el historial pero su efecto
                  // sobre el stock ya fue revertido.
                  fueCorregido && 'text-neutral-400 line-through',
                )}
              >
                {presentacion.signo}
                {movimiento.cantidad} {unidad}
              </span>

              {fueCorregido && (
                <span className="text-sm font-medium text-neutral-500">deshecho</span>
              )}
            </div>

            <p className="mt-1 text-sm text-neutral-500">
              {formatearFechaHora(movimiento.fecha_hora)}
              {' · '}
              {/* Sin nombre solo si RLS lo filtró: la fila del movimiento
                  existe igual y no hay que ocultarla por eso. */}
              {esPropio ? 'Vos' : (movimiento.usuario?.nombre ?? 'Usuario no disponible')}
            </p>

            {movimiento.corrige_a !== null && (
              <p className="mt-1 text-sm font-medium text-marca-800">
                Deshace el movimiento #{movimiento.corrige_a}
              </p>
            )}

            {movimiento.motivo !== null && (
              <p className="mt-1 text-sm text-neutral-600 italic">«{movimiento.motivo}»</p>
            )}

            {sePuedeCorregir && (
              <Button
                variante="secundario"
                className="mt-2"
                onClick={() => onCorregir(movimiento)}
              >
                Corregir
              </Button>
            )}
          </li>
        )
      })}
    </ol>
  )
}
