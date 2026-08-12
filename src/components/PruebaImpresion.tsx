import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useImpresora } from '@/hooks/useImpresora'
import { componerEtiqueta } from '@/lib/printer'
import { urlPalet } from '@/lib/urlPalet'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Banco de pruebas de impresión, para el catálogo de desarrollo.
 *
 * Permite probar la impresora y ver cómo queda la etiqueta sin necesidad de
 * tener productos cargados ni palets creados: usa datos inventados. Sirve
 * también para verificar de un vistazo si este navegador puede hablar Bluetooth
 * y en qué estado está la conexión.
 */

/** Palet inventado, con nombre largo a propósito para probar el recorte. */
const PALET_DE_PRUEBA = {
  id: 152,
  producto: 'Glifosato 48% concentrado soluble',
  lote: 'L-2026-0113',
  cantidad: '120 litro',
}

const ETIQUETAS_DE_ESTADO: Record<string, { texto: string; variante: 'neutral' | 'exito' | 'advertencia' | 'peligro' | 'info' }> = {
  'sin-soporte': { texto: 'Sin Bluetooth', variante: 'advertencia' },
  desconectada: { texto: 'Desconectada', variante: 'neutral' },
  conectando: { texto: 'Conectando…', variante: 'info' },
  conectada: { texto: 'Conectada', variante: 'exito' },
  imprimiendo: { texto: 'Imprimiendo…', variante: 'info' },
  impresa: { texto: 'Impresa', variante: 'exito' },
  error: { texto: 'Error', variante: 'peligro' },
}

export function PruebaImpresion() {
  const refQR = useRef<HTMLCanvasElement>(null)
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null)
  const { estado, error, modelo, hayBluetooth, imprimir, conectar, desconectar } =
    useImpresora()

  /** Compone la etiqueta igual que la impresión, pero para verla en pantalla. */
  function verVistaPrevia() {
    const qr = refQR.current
    if (qr === null) return

    const etiqueta = componerEtiqueta({ qr, ...PALET_DE_PRUEBA })
    setVistaPrevia(etiqueta.toDataURL('image/png'))
  }

  async function imprimirPrueba() {
    const qr = refQR.current
    if (qr === null) return

    await imprimir({ qr, ...PALET_DE_PRUEBA })
  }

  const trabajando = estado === 'conectando' || estado === 'imprimiendo'
  const insignia = ETIQUETAS_DE_ESTADO[estado] ?? ETIQUETAS_DE_ESTADO.desconectada

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-neutral-900">Impresora NIIMBOT</h3>
        <Badge variante={insignia.variante}>{insignia.texto}</Badge>
      </div>

      <dl className="text-sm text-neutral-600">
        <div className="flex justify-between gap-4 py-1">
          <dt>Web Bluetooth</dt>
          <dd className="font-medium">{hayBluetooth ? 'disponible' : 'no disponible'}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt>Modelo detectado</dt>
          <dd className="font-medium">{modelo ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-4 py-1">
          <dt>URL del QR</dt>
          <dd className="font-mono text-xs break-all">{urlPalet(PALET_DE_PRUEBA.id)}</dd>
        </div>
      </dl>

      {/* QR en alta resolución, oculto: es el que se compone en la etiqueta. */}
      <div className="hidden" aria-hidden="true">
        <QRCodeCanvas
          ref={refQR}
          value={urlPalet(PALET_DE_PRUEBA.id)}
          size={600}
          level="M"
          marginSize={2}
        />
      </div>

      {error !== null && <ErrorMessage mensaje={error} />}

      {trabajando && (
        <p role="status" className="flex items-center gap-2 text-base text-neutral-600">
          <Spinner tamaño="sm" decorativo />
          {estado === 'conectando' ? 'Buscando la impresora…' : 'Imprimiendo…'}
        </p>
      )}

      {vistaPrevia !== null && (
        <figure className="flex flex-col gap-2">
          <img
            src={vistaPrevia}
            alt="Vista previa de la etiqueta"
            className="w-full rounded-lg border border-neutral-300"
          />
          <figcaption className="text-center text-xs text-neutral-500">
            Así sale la etiqueta: 47,4 × 29,8 mm a 300 dpi (560 × 352 px)
          </figcaption>
        </figure>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variante="secundario" anchoCompleto onClick={verVistaPrevia}>
          Ver vista previa
        </Button>

        {hayBluetooth && (
          <>
            {estado === 'desconectada' || estado === 'error' ? (
              <Button anchoCompleto onClick={() => void conectar()} cargando={trabajando}>
                Conectar
              </Button>
            ) : (
              <Button
                variante="secundario"
                anchoCompleto
                onClick={() => void desconectar()}
                disabled={trabajando}
              >
                Desconectar
              </Button>
            )}

            <Button anchoCompleto onClick={() => void imprimirPrueba()} cargando={trabajando}>
              Imprimir prueba
            </Button>
          </>
        )}
      </div>

      {!hayBluetooth && (
        <p className="text-sm text-neutral-500">
          Este navegador no expone <code>navigator.bluetooth</code>. La vista previa
          funciona igual; la impresión necesita Chrome, Chromium o Edge.
        </p>
      )}
    </Card>
  )
}
