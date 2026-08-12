import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { cx } from '@/lib/cx'

/**
 * Lector de QR por cámara.
 *
 * Lo delicado acá es el ciclo de vida: si la cámara no se apaga al salir de la
 * pantalla, el led del teléfono queda prendido y el stream sigue tomado, y la
 * próxima vez que se entre la cámara aparece ocupada. Por eso el `useEffect`
 * corta el stream sí o sí al desmontar, incluso si el arranque quedó a medias.
 */

/** Por qué no se pudo usar la cámara. Cada caso se explica distinto. */
export type MotivoFalloCamara = 'permiso' | 'sin-camara' | 'inseguro' | 'desconocido'

interface Props {
  /** Se llama con el texto crudo del QR leído. */
  onLeer: (texto: string) => void
  /** Se llama si la cámara no arranca. Los fallos de lectura no cuentan. */
  onFallo: (motivo: MotivoFalloCamara, detalle: string) => void
  /** Corta el escaneo sin desmontar, para no seguir leyendo tras un acierto. */
  pausado?: boolean
  className?: string
}

export function LectorQR({ onLeer, onFallo, pausado = false, className }: Props) {
  // `useId` da un id único y estable: html5-qrcode monta el video dentro de un
  // elemento que busca por id, así que dos lectores no pueden compartirlo.
  const idContenedor = `lector-qr-${useId().replace(/:/g, '')}`
  const [arrancando, setArrancando] = useState(true)

  // En refs y no en estado: los usa la limpieza del efecto, que no puede
  // depender de un re-render para tener el valor actualizado.
  const refLector = useRef<Html5Qrcode | null>(null)
  const refOnLeer = useRef(onLeer)
  const refOnFallo = useRef(onFallo)
  const refPausado = useRef(pausado)

  // Se sincronizan después del render, no durante: escribir un ref mientras se
  // renderiza rompe las garantías de React. El valor inicial ya lo puso
  // `useRef`, así que el primer escaneo tampoco queda descubierto.
  useEffect(() => {
    refOnLeer.current = onLeer
    refOnFallo.current = onFallo
    refPausado.current = pausado
  })

  useEffect(() => {
    let vigente = true
    const lector = new Html5Qrcode(idContenedor)
    refLector.current = lector

    const arranque = lector
      .start(
        // `environment` es la cámara trasera, que es con la que se escanea un
        // palet. En una notebook simplemente toma la única que haya.
        { facingMode: 'environment' },
        {
          fps: 10,
          // Recuadro de mira cuadrado y proporcional, para que en un teléfono
          // angosto no se salga de la pantalla.
          qrbox: (anchoVista, altoVista) => {
            const lado = Math.floor(Math.min(anchoVista, altoVista) * 0.7)
            return { width: lado, height: lado }
          },
          aspectRatio: 1,
        },
        (texto) => {
          // Sin esto se dispara muchas veces por segundo mientras el QR siga
          // enfocado, y la navegación se repetiría.
          if (refPausado.current) return
          refOnLeer.current(texto)
        },
        () => {
          // Se llama en cada cuadro sin QR legible. Es el caso normal mientras
          // se apunta, no un error: se ignora a propósito.
        },
      )
      .then(() => {
        if (vigente) setArrancando(false)
      })
      .catch((error: unknown) => {
        if (!vigente) return

        setArrancando(false)
        const detalle = error instanceof Error ? error.message : String(error)
        refOnFallo.current(clasificarFallo(detalle), detalle)
      })

    return () => {
      vigente = false
      refLector.current = null

      // Clave: se espera a que `start()` termine antes de apagar.
      //
      // `start()` es asíncrono. Si se consultara `getState()` acá mismo,
      // devolvería NOT_STARTED cuando el arranque sigue en vuelo —justo lo que
      // pasa en desarrollo, donde StrictMode monta, desmonta y remonta al
      // instante—, no se llamaría a `stop()`, y la cámara que `start()` estaba
      // por abrir quedaría encendida para siempre, con el led prendido y el
      // dispositivo tomado.
      //
      // `finally` corre tanto si arrancó bien como si falló, así que también
      // cubre el caso de un arranque a medias.
      void arranque.finally(() => {
        void apagar(lector, idContenedor)
      })
    }
  }, [idContenedor])

  // Pausar detiene la decodificación pero deja el video andando, así la imagen
  // no parpadea mientras se navega al detalle del palet.
  useEffect(() => {
    const lector = refLector.current
    if (lector === null) return

    try {
      if (pausado && lector.getState() === Html5QrcodeScannerState.SCANNING) {
        lector.pause(false)
      } else if (!pausado && lector.getState() === Html5QrcodeScannerState.PAUSED) {
        lector.resume()
      }
    } catch (error: unknown) {
      console.error('[lector qr] no se pudo pausar o reanudar', error)
    }
  }, [pausado])

  return (
    <div className={cx('relative overflow-hidden rounded-xl bg-black', className)}>
      <div id={idContenedor} className="w-full [&_video]:block [&_video]:w-full" />

      {arrancando && (
        <p
          className="absolute inset-0 flex items-center justify-center text-base text-white"
          role="status"
        >
          Encendiendo la cámara…
        </p>
      )}
    </div>
  )
}

// Export por defecto además del nombrado: es lo que necesita `React.lazy` para
// que html5-qrcode —unos 380 kB— se descargue recién al abrir el escáner y no
// al arrancar la app.
export default LectorQR

/**
 * Apaga la cámara y saca el video del DOM.
 *
 * `stop()` tira error si el escaneo no está corriendo, así que se consulta el
 * estado —ahora sí confiable, porque se llama con el arranque ya resuelto—. Nada
 * de esto puede propagar una excepción: se ejecuta durante la limpieza de un
 * efecto, y romper ahí dejaría la navegación a medias.
 */
async function apagar(lector: Html5Qrcode, idContenedor: string): Promise<void> {
  try {
    const estado = lector.getState()

    if (
      estado === Html5QrcodeScannerState.SCANNING ||
      estado === Html5QrcodeScannerState.PAUSED
    ) {
      await lector.stop()
    }

    lector.clear()
  } catch (error: unknown) {
    console.error('[lector qr] no se pudo apagar la cámara', error)
  } finally {
    // Red de seguridad: si `stop()` falló, el `<video>` puede seguir con el
    // stream tomado y el led encendido. Cortar las pistas a mano es idempotente
    // —si ya las cerró la librería, esto no hace nada— y es lo único que
    // realmente apaga la cámara a nivel del sistema.
    detenerPistasDeVideo(idContenedor)
  }
}

/** Corta cualquier stream que haya quedado colgado dentro del contenedor. */
function detenerPistasDeVideo(idContenedor: string): void {
  const contenedor = document.getElementById(idContenedor)

  if (contenedor === null) return

  for (const video of contenedor.querySelectorAll('video')) {
    const stream = video.srcObject

    if (stream instanceof MediaStream) {
      for (const pista of stream.getTracks()) pista.stop()
      video.srcObject = null
    }
  }
}

/** Traduce el error del navegador a uno de los motivos que sabemos explicar. */
function clasificarFallo(detalle: string): MotivoFalloCamara {
  if (/NotAllowedError|Permission|denied/i.test(detalle)) return 'permiso'
  if (/NotFoundError|no camera|NotReadableError|device not found/i.test(detalle)) {
    return 'sin-camara'
  }
  // getUserMedia no existe fuera de un contexto seguro.
  if (/secure|https|getUserMedia is not/i.test(detalle)) return 'inseguro'

  return 'desconocido'
}
