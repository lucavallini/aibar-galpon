import { useState } from 'react'
import { useObservaciones, useCrearObservacion } from '@/hooks/useObservaciones'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

/**
 * Bitácora del palet: qué le fue pasando.
 *
 * Bidones pinchados, envases rotos, humedad. Se puede anotar **en cualquier
 * momento**, incluso sobre un palet vacío o dado de baja: dejar constancia de
 * qué pasó no toca el stock.
 *
 * Las notas no se editan ni se borran. Si una estaba equivocada, se agrega otra
 * aclarándolo — igual que con los movimientos.
 */

interface Props {
  paletId: number
  /** El jefe ve la bitácora pero no puede escribir en ella. */
  soloLectura?: boolean
}

const MAXIMO = 500

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

export function BitacoraPalet({ paletId, soloLectura = false }: Props) {
  const { usuario } = useAuth()
  const [texto, setTexto] = useState('')

  const {
    data: observaciones,
    isPending,
    isError,
    error,
    refetch,
  } = useObservaciones(paletId)

  const crear = useCrearObservacion()

  const limpio = texto.trim()
  const puedeGuardar = limpio !== '' && usuario !== null && !crear.isPending

  async function guardar() {
    if (!puedeGuardar || usuario === null) return

    try {
      await crear.mutateAsync({ paletId, texto: limpio, usuarioId: usuario.id })
      setTexto('')
    } catch {
      // El error queda en `crear.error` y se muestra abajo; el texto no se
      // pierde, así el operario puede reintentar sin volver a escribirlo.
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-piedra-900">Observaciones</h2>
      <p className="mb-3 text-sm text-piedra-500">
        Anotá lo que le pase al palet: envases rotos, faltantes, humedad.
      </p>

      {!soloLectura && (
        <div className="mb-4 flex flex-col gap-2">
          <label htmlFor={`obs-${paletId}`} className="sr-only">
            Nueva observación
          </label>
          <textarea
            id={`obs-${paletId}`}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            maxLength={MAXIMO}
            rows={3}
            placeholder="Ej. 2 bidones pinchados en la fila de arriba"
            disabled={crear.isPending}
            className="w-full rounded-lg border border-piedra-300 px-3 py-2.5 text-base text-piedra-900 placeholder:text-piedra-400 focus:border-marca-600 focus:ring-2 focus:ring-marca-600/30 focus:outline-none disabled:bg-piedra-100"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-piedra-400">
              {texto.length}/{MAXIMO}
            </span>
            <Button cargando={crear.isPending} disabled={!puedeGuardar} onClick={() => void guardar()}>
              {crear.isPending ? 'Guardando…' : 'Agregar observación'}
            </Button>
          </div>

          {crear.isError && (
            <ErrorMessage
              titulo="No se pudo guardar la observación"
              mensaje={crear.error.message}
            />
          )}
        </div>
      )}

      {isPending ? (
        <div className="flex justify-center py-4 text-marca-700">
          <Spinner etiqueta="Cargando observaciones" />
        </div>
      ) : isError ? (
        <ErrorMessage mensaje={error.message} onReintentar={() => void refetch()} />
      ) : observaciones.length === 0 ? (
        <p className="py-2 text-base text-piedra-500">
          Sin observaciones. Este palet no tuvo novedades.
        </p>
      ) : (
        <ol className="flex flex-col">
          {observaciones.map((observacion) => {
            const esPropia = observacion.usuario?.id === usuario?.id

            return (
              <li
                key={observacion.id}
                className="border-b border-piedra-100 py-3 last:border-b-0"
              >
                <p className="text-base whitespace-pre-line text-piedra-900">
                  {observacion.texto}
                </p>
                <p className="mt-1 text-sm text-piedra-500">
                  {formatearFechaHora(observacion.created_at)}
                  {' · '}
                  {esPropia ? 'Vos' : (observacion.usuario?.nombre ?? 'Usuario no disponible')}
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
