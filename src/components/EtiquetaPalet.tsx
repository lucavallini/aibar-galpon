import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useImpresora } from '@/hooks/useImpresora'
import { urlPalet, urlPublicaConfigurada } from '@/lib/urlPalet'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Spinner } from '@/components/ui/Spinner'

/**
 * QR del palet en pantalla, con impresión en la NIIMBOT.
 *
 * Este componente no sabe nada de Bluetooth ni de niimbluelib: solo dibuja el
 * QR y le pasa el canvas al hook. Toda la conversación con la impresora vive en
 * `src/lib/printer.ts`.
 */

interface Props {
  id: number
  producto: string
  lote: string
  /** Ya formateada con su unidad. Ej. `120 litro`. */
  cantidad: string
}

/**
 * Lado del QR en pantalla, en píxeles.
 *
 * Grande a propósito: se muestra para poder escanearlo directo del celular de
 * otra persona, no solo como adorno.
 */
const LADO_QR_PANTALLA = 260

/**
 * Lado del QR que se manda a imprimir.
 *
 * Se renderiza aparte y más grande que el de pantalla para que, al reescalarlo
 * a los 300 dpi de la impresora, los módulos del código queden nítidos.
 */
const LADO_QR_IMPRESION = 600

export function EtiquetaPalet({ id, producto, lote, cantidad }: Props) {
  const refQRImpresion = useRef<HTMLCanvasElement>(null)
  const { estado, error, modelo, hayBluetooth, imprimir, desconectar, limpiarError } =
    useImpresora()

  const url = urlPalet(id)
  const dominioListo = urlPublicaConfigurada()

  async function manejarImprimir() {
    const qr = refQRImpresion.current

    if (qr === null) return

    await imprimir({ qr, id, producto, lote, cantidad })
  }

  function descargarQR() {
    const qr = refQRImpresion.current

    if (qr === null) return

    const enlace = document.createElement('a')
    enlace.download = `palet-${id}-qr.png`
    enlace.href = qr.toDataURL('image/png')
    enlace.click()
  }

  const imprimiendo = estado === 'conectando' || estado === 'imprimiendo'

  return (
    <Card className="flex flex-col items-center gap-4">
      <h2 className="text-lg font-semibold text-piedra-900">Código QR</h2>

      <div className="rounded-lg border border-piedra-200 bg-white p-3">
        <QRCodeCanvas
          value={url}
          size={LADO_QR_PANTALLA}
          level="M"
          marginSize={2}
          aria-label={`Código QR del palet ${id}`}
        />
      </div>

      {/* Copia oculta, en alta resolución, que es la que se imprime o se descarga. */}
      <div className="hidden" aria-hidden="true">
        <QRCodeCanvas
          ref={refQRImpresion}
          value={url}
          size={LADO_QR_IMPRESION}
          level="M"
          marginSize={2}
        />
      </div>

      <p className="text-center text-sm break-all text-piedra-500">{url}</p>

      {!dominioListo && (
        <ErrorMessage
          titulo="Falta configurar el dominio"
          mensaje="El QR apunta a una dirección local, así que solo funciona en esta computadora. Antes de imprimir etiquetas de verdad hay que definir VITE_URL_PUBLICA con el dominio donde queda publicada la app."
        />
      )}

      {/* --- Sin Web Bluetooth: nunca fallar en silencio --- */}
      {!hayBluetooth ? (
        <div className="flex w-full flex-col gap-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">
              No se puede imprimir desde este dispositivo
            </p>
            {/* El motivo lo arma `printer.ts`, que distingue entre falta de
                HTTPS, iOS y la flag apagada de Chrome en Linux. */}
            <p className="mt-1 text-base text-amber-800">{error}</p>
            <p className="mt-2 text-base text-amber-800">
              Mientras tanto podés descargar el QR e imprimirlo por otro medio.
            </p>
          </div>

          <Button variante="secundario" tamaño="lg" anchoCompleto onClick={descargarQR}>
            Descargar QR
          </Button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          {estado === 'error' && error !== null && (
            <ErrorMessage
              titulo="No se pudo imprimir"
              mensaje={error}
              onReintentar={limpiarError}
            />
          )}

          {estado === 'impresa' && (
            <p
              role="status"
              className="rounded-lg border border-marca-200 bg-marca-50 px-4 py-3 text-center text-base font-medium text-marca-900"
            >
              Etiqueta impresa. Pegala en el palet.
            </p>
          )}

          {imprimiendo && (
            <p
              role="status"
              aria-live="polite"
              className="flex items-center justify-center gap-2 text-base text-piedra-600"
            >
              <Spinner tamaño="sm" decorativo />
              {estado === 'conectando'
                ? 'Buscando la impresora…'
                : 'Imprimiendo la etiqueta…'}
            </p>
          )}

          <Button
            tamaño="lg"
            anchoCompleto
            cargando={imprimiendo}
            onClick={() => void manejarImprimir()}
          >
            {estado === 'impresa' ? 'Imprimir otra vez' : 'Imprimir etiqueta'}
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variante="secundario" anchoCompleto onClick={descargarQR}>
              Descargar QR
            </Button>

            {(estado === 'conectada' || estado === 'impresa') && (
              <Button
                variante="fantasma"
                anchoCompleto
                onClick={() => void desconectar()}
                disabled={imprimiendo}
              >
                Desconectar{modelo !== null && ` ${modelo}`}
              </Button>
            )}
          </div>

          {estado === 'desconectada' && (
            <p className="text-center text-sm text-piedra-500">
              Encendé la impresora y tocá «Imprimir etiqueta»: el teléfono te va a pedir
              que la elijas de la lista.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
