import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useOffline } from '@/hooks/useOffline'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Dialogo } from '@/components/ui/Dialogo'
import { cx } from '@/lib/cx'
import { rutaPalet, RUTAS } from '@/rutas'
import type { MovimientoPendiente } from '@/offline/db'

/**
 * Movimientos que todavía no llegaron a la base.
 *
 * Dos grupos bien separados: los que esperan señal —se van a mandar solos— y
 * los que la base rechazó, que necesitan que alguien decida. Mezclarlos haría
 * que los segundos pasen desapercibidos, y son los únicos que requieren acción.
 */

const ETIQUETA_TIPO = {
  venta: 'Venta',
  salida: 'Salida',
  ajuste: 'Ajuste',
} as const

function formatearFechaHora(marca: number): string {
  return new Date(marca).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface PropsFila {
  movimiento: MovimientoPendiente
  onVerPalet: () => void
  onReintentar?: () => void
  onDescartar?: () => void
}

function FilaPendiente({ movimiento, onVerPalet, onReintentar, onDescartar }: PropsFila) {
  const fallido = movimiento.estado === 'fallido'

  return (
    <Card className={cx(fallido && 'border-red-200 bg-red-50')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-piedra-900">
            {ETIQUETA_TIPO[movimiento.tipo]} de {movimiento.cantidad} {movimiento.unidad}
          </p>
          <p className="mt-0.5 truncate text-sm text-piedra-600">
            {movimiento.paletEtiqueta}
          </p>
          <p className="mt-0.5 text-sm text-piedra-500">
            Registrado {formatearFechaHora(movimiento.creadoEn)}
          </p>
        </div>

        <Badge variante={fallido ? 'peligro' : 'info'}>
          {fallido ? 'Rechazado' : movimiento.estado === 'sincronizando' ? 'Enviando…' : 'En espera'}
        </Badge>
      </div>

      {fallido && movimiento.error !== undefined && (
        <p className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-base text-red-800">
          {movimiento.error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variante="secundario" onClick={onVerPalet}>
          Ver palet
        </Button>

        {onReintentar !== undefined && (
          <Button variante="secundario" onClick={onReintentar}>
            Reintentar
          </Button>
        )}

        {onDescartar !== undefined && (
          <Button variante="fantasma" onClick={onDescartar}>
            Descartar
          </Button>
        )}
      </div>
    </Card>
  )
}

export function Pendientes() {
  const navegar = useNavigate()
  const {
    cola,
    enLinea,
    sincronizando,
    sincronizarAhora,
    reintentarUno,
    descartarUno,
  } = useOffline()

  const [aDescartar, setADescartar] = useState<MovimientoPendiente | null>(null)

  const enEspera = cola.filter((movimiento) => movimiento.estado !== 'fallido')
  const fallidos = cola.filter((movimiento) => movimiento.estado === 'fallido')

  if (cola.length === 0) {
    return (
      <EmptyState
        titulo="No hay nada pendiente"
        descripcion="Todos los movimientos que registraste llegaron a la base."
        accion={<Button onClick={() => navegar(RUTAS.operario)}>Volver al inicio</Button>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-base text-piedra-600">
          {enLinea ? 'Con señal' : 'Sin señal en este momento'}
        </p>
        <Button
          cargando={sincronizando}
          disabled={!enLinea || enEspera.length === 0}
          onClick={() => void sincronizarAhora()}
        >
          {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
        </Button>
      </div>

      {/* --- Los que necesitan una decisión van primero --- */}
      {fallidos.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-bold tracking-wide text-red-700 uppercase">
              No se pudieron registrar
            </h2>
            <p className="mt-1 text-base text-piedra-600">
              La base los rechazó. Revisá el motivo y decidí: reintentar si la situación
              cambió, o descartar si el movimiento ya no corresponde.
            </p>
          </div>

          {fallidos.map((movimiento) => (
            <FilaPendiente
              key={movimiento.id}
              movimiento={movimiento}
              onVerPalet={() => navegar(rutaPalet(movimiento.paletId))}
              onReintentar={() => void reintentarUno(movimiento.id)}
              onDescartar={() => setADescartar(movimiento)}
            />
          ))}
        </section>
      )}

      {enEspera.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm font-bold tracking-wide text-piedra-500 uppercase">
              Esperando señal
            </h2>
            <p className="mt-1 text-base text-piedra-600">
              Se van a registrar solos apenas haya conexión. No hace falta que hagas nada.
            </p>
          </div>

          {enEspera.map((movimiento) => (
            <FilaPendiente
              key={movimiento.id}
              movimiento={movimiento}
              onVerPalet={() => navegar(rutaPalet(movimiento.paletId))}
              onDescartar={() => setADescartar(movimiento)}
            />
          ))}
        </section>
      )}

      {/* Descartar borra un movimiento que el operario ya hizo físicamente:
          conviene preguntar antes. */}
      <Dialogo
        abierto={aDescartar !== null}
        onCerrar={() => setADescartar(null)}
        titulo="¿Descartar el movimiento?"
      >
        {aDescartar !== null && (
          <div className="flex flex-col gap-4">
            <p className="text-base text-piedra-700">
              Vas a descartar la {ETIQUETA_TIPO[aDescartar.tipo].toLowerCase()} de{' '}
              <strong>
                {aDescartar.cantidad} {aDescartar.unidad}
              </strong>{' '}
              del {aDescartar.paletEtiqueta}.
            </p>
            <p className="text-base text-piedra-600">
              No se va a registrar nunca. Si la mercadería salió del depósito de verdad,
              el stock del sistema va a quedar más alto que el real.
            </p>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button
                variante="peligro"
                tamaño="lg"
                anchoCompleto
                onClick={() => {
                  void descartarUno(aDescartar.id)
                  setADescartar(null)
                }}
              >
                Descartar
              </Button>
              <Button variante="secundario" anchoCompleto onClick={() => setADescartar(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Dialogo>
    </div>
  )
}
