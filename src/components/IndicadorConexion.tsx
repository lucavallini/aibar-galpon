import { useNavigate } from 'react-router'
import { useOffline } from '@/hooks/useOffline'
import { cx } from '@/lib/cx'
import { RUTAS } from '@/rutas'

/**
 * Estado de la conexión y de la cola, siempre a la vista.
 *
 * Va en el header y no aparece y desaparece: el operario tiene que poder mirar
 * en cualquier momento y saber si lo que está haciendo llegó a la base o está
 * esperando. Cuando hay algo pendiente o fallido se puede tocar para ver el
 * detalle.
 */
export function IndicadorConexion() {
  const navegar = useNavigate()
  const { enLinea, pendientes, fallidos, sincronizando } = useOffline()

  const hayAlgo = pendientes > 0 || fallidos > 0

  // Un fallo es lo más urgente: hay un movimiento que no entró y alguien tiene
  // que decidir qué hacer con él.
  const tono = fallidos > 0
    ? 'border-red-300 bg-red-50 text-red-900'
    : !enLinea
      ? 'border-amber-300 bg-amber-50 text-amber-900'
      : pendientes > 0
        ? 'border-blue-300 bg-blue-50 text-blue-900'
        : 'border-piedra-200 bg-piedra-50 text-piedra-600'

  const texto = sincronizando
    ? 'Sincronizando…'
    : fallidos > 0
      ? `${fallidos} sin registrar`
      : !enLinea
        ? pendientes > 0
          ? `Sin señal · ${pendientes} en espera`
          : 'Sin señal'
        : pendientes > 0
          ? `${pendientes} en espera`
          : 'En línea'

  const contenido = (
    <>
      <span
        aria-hidden="true"
        className={cx(
          'size-2 shrink-0 rounded-full',
          sincronizando && 'animate-pulse bg-blue-600',
          !sincronizando && fallidos > 0 && 'bg-red-600',
          !sincronizando && fallidos === 0 && !enLinea && 'bg-amber-500',
          !sincronizando && fallidos === 0 && enLinea && pendientes > 0 && 'bg-blue-600',
          !sincronizando && fallidos === 0 && enLinea && pendientes === 0 && 'bg-marca-600',
        )}
      />
      <span className="truncate">{texto}</span>
    </>
  )

  const clases = cx(
    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium',
    tono,
  )

  if (!hayAlgo) {
    return (
      <p className={clases} role="status" aria-live="polite">
        {contenido}
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={() => navegar(RUTAS.pendientes)}
      className={cx(
        clases,
        'min-h-toque focus-visible:ring-2 focus-visible:ring-marca-600 focus-visible:outline-none',
      )}
      aria-live="polite"
    >
      {contenido}
      <span aria-hidden="true">›</span>
    </button>
  )
}
