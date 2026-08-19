import { Badge, type VarianteBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cx } from '@/lib/cx'
import type { MovimientoConAutor, TipoMovimiento } from '@/types'

/**
 * El alta del palet, para abrir el historial con ella.
 *
 * No es una fila de `movimiento`: el alta no genera ninguna, porque la cantidad
 * inicial la fija el trigger `inicializar_palet()` y no un movimiento de stock.
 * Se arma acá, en la presentación, y por eso no lleva id ni se puede corregir.
 * Sin ella el historial empieza contando salidas de un total que no aparece por
 * ningún lado, y no cierra: «−20» sobre nada.
 */
export interface AltaDelPalet {
  /** `YYYY-MM-DD`: la fecha de ingreso que cargó el operario. */
  fecha: string
  cantidad: number
  /**
   * Quién trajo el palet al depósito, si se registró.
   *
   * Es `palet.transportista_id`, y no tiene nada que ver con el transportista
   * de un movimiento: ese es quién se llevó una parte. Acá va el del ingreso,
   * que es el único momento en que el palet entró completo.
   */
  transportista?: string | null
}

interface Props {
  movimientos: MovimientoConAutor[]
  /** El ingreso original. Va al final: es lo más viejo del historial. */
  alta?: AltaDelPalet
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

/** `12/08/2026` a partir de un `YYYY-MM-DD`, sin pasar por `Date`. */
function formatearFecha(iso: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)

  // `new Date('2026-08-12')` se interpreta en UTC y en Argentina muestra el día
  // anterior. Con la fecha ya partida en tres, eso no puede pasar.
  return partes === null ? iso : `${partes[3]}/${partes[2]}/${partes[1]}`
}

/** El ingreso original, cerrando el historial por abajo. */
function FilaDeAlta({ alta, unidad }: { alta: AltaDelPalet; unidad: string }) {
  return (
    <li className="border-t border-piedra-200 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variante="exito">Alta del palet</Badge>
        <span className="text-base font-semibold text-piedra-900">
          +{alta.cantidad} {unidad}
        </span>
      </div>

      <p className="mt-1 text-sm text-piedra-500">
        {formatearFecha(alta.fecha)} · ingreso al depósito
      </p>

      {/* Es opcional: trabar el alta por un dato que el operario no siempre
          tiene a mano termina en palets sin cargar. */}
      {alta.transportista != null && alta.transportista !== '' && (
        <p className="mt-1 text-sm text-piedra-600">Lo trajo {alta.transportista}</p>
      )}
    </li>
  )
}

export function HistorialMovimientos({
  movimientos,
  alta,
  usuarioActualId,
  unidad,
  idCorregible = null,
  onCorregir,
}: Props) {
  if (movimientos.length === 0) {
    return (
      <>
        <EmptyState
          titulo="Sin movimientos"
          descripcion="Este palet todavía está entero: no se registró ninguna salida."
        />

        {/* Aun sin salidas se muestra el alta: es el punto de partida del
            stock, y verlo confirma con cuánto entró el palet. */}
        {alta !== undefined && (
          <ol className="mt-2 flex flex-col">
            <FilaDeAlta alta={alta} unidad={unidad} />
          </ol>
        )}
      </>
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
              'border-b border-piedra-100 py-3 last:border-b-0',
              // La corrección se despega visualmente: es la única que suma.
              esCorreccion && '-mx-2 rounded-lg border-b-0 bg-marca-50 px-2',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variante={presentacion.variante}>{presentacion.etiqueta}</Badge>
              <span
                className={cx(
                  'text-base font-semibold',
                  esCorreccion ? 'text-marca-900' : 'text-piedra-900',
                  // Tachado: el movimiento sigue en el historial pero su efecto
                  // sobre el stock ya fue revertido.
                  fueCorregido && 'text-piedra-400 line-through',
                )}
              >
                {presentacion.signo}
                {movimiento.cantidad} {unidad}
              </span>

              {fueCorregido && (
                <span className="text-sm font-medium text-piedra-500">deshecho</span>
              )}
            </div>

            <p className="mt-1 text-sm text-piedra-500">
              {formatearFechaHora(movimiento.fecha_hora)}
              {' · '}
              {/* Sin nombre solo si RLS lo filtró: la fila del movimiento
                  existe igual y no hay que ocultarla por eso. */}
              {esPropio ? 'Vos' : (movimiento.usuario?.nombre ?? 'Usuario no disponible')}
            </p>

            {/* En un ajuste no hay chofer: no hubo ningún camión. */}
            {movimiento.transportista !== null && (
              <p className="mt-1 text-sm text-piedra-600">
                Se lo llevó {movimiento.transportista.nombre}
              </p>
            )}

            {movimiento.corrige_a !== null && (
              <p className="mt-1 text-sm font-medium text-marca-800">
                Deshace el movimiento #{movimiento.corrige_a}
              </p>
            )}

            {movimiento.motivo !== null && (
              <p className="mt-1 text-sm text-piedra-600 italic">«{movimiento.motivo}»</p>
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

      {/* Último de la lista porque el historial va del más reciente al más
          viejo, y el alta es lo primero que le pasó al palet. */}
      {alta !== undefined && <FilaDeAlta alta={alta} unidad={unidad} />}
    </ol>
  )
}
