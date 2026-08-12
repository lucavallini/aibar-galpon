import { lazy, Suspense, useState } from 'react'
import { useNavigate } from 'react-router'
import type { MotivoFalloCamara } from '@/components/LectorQR'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { extraerIdDePalet } from '@/lib/urlPalet'
import { rutaPalet, RUTAS } from '@/rutas'

// html5-qrcode pesa unos 380 kB y solo hace falta acá. Cargándolo aparte, quien
// entra a la app a dar de alta un palet no lo descarga.
const LectorQR = lazy(() => import('@/components/LectorQR'))

/**
 * Escaneo del QR de un palet.
 *
 * El lector se monta solo mientras esta pantalla está en pantalla: al navegar al
 * detalle, React desmonta el componente y ahí se apaga la cámara.
 */

/** Qué mostrarle al operario según por qué no arrancó la cámara. */
const EXPLICACION_DEL_FALLO: Record<MotivoFalloCamara, { titulo: string; texto: string }> = {
  permiso: {
    titulo: 'Falta el permiso de cámara',
    texto:
      'Para escanear, el navegador necesita permiso para usar la cámara. Tocá el candado 🔒 que está a la izquierda de la dirección, buscá "Cámara" y ponelo en "Permitir". Después volvé a entrar acá.',
  },
  'sin-camara': {
    titulo: 'No se encontró una cámara',
    texto:
      'Este dispositivo no tiene cámara disponible, o hay otra aplicación usándola. Cerrá las otras apps que puedan estar usándola y probá de nuevo.',
  },
  inseguro: {
    titulo: 'La cámara necesita HTTPS',
    texto:
      'Por seguridad, el navegador solo da acceso a la cámara en páginas HTTPS. Abrí la app desde su dirección publicada en vez de por IP.',
  },
  desconocido: {
    titulo: 'No se pudo abrir la cámara',
    texto: 'Probá cerrar y volver a abrir la app. Si sigue igual, reiniciá el navegador.',
  },
}

export function EscanearQR() {
  const navegar = useNavigate()
  const [fallo, setFallo] = useState<MotivoFalloCamara | null>(null)
  const [detalleTecnico, setDetalleTecnico] = useState<string | null>(null)
  const [codigoAjeno, setCodigoAjeno] = useState<string | null>(null)

  /** `true` desde que se lee un QR válido, para no leerlo mil veces mientras navega. */
  const [navegando, setNavegando] = useState(false)

  function manejarLectura(texto: string) {
    const id = extraerIdDePalet(texto)

    if (id === null) {
      // Un QR de otro sistema. Se avisa y se sigue escaneando: el operario
      // simplemente apuntó a la etiqueta equivocada.
      setCodigoAjeno(texto)
      return
    }

    setCodigoAjeno(null)
    setNavegando(true)
    navegar(rutaPalet(id))
  }

  function manejarFallo(motivo: MotivoFalloCamara, detalle: string) {
    setFallo(motivo)
    setDetalleTecnico(detalle)
  }

  if (fallo !== null) {
    const explicacion = EXPLICACION_DEL_FALLO[fallo]

    return (
      <div className="flex flex-col gap-4">
        <ErrorMessage titulo={explicacion.titulo} mensaje={explicacion.texto} />

        {detalleTecnico !== null && (
          <details className="text-sm text-neutral-500">
            <summary className="cursor-pointer">Detalle técnico</summary>
            <p className="mt-1 font-mono text-xs break-all">{detalleTecnico}</p>
          </details>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button anchoCompleto onClick={() => window.location.reload()}>
            Reintentar
          </Button>
          <Button
            variante="secundario"
            anchoCompleto
            onClick={() => navegar(RUTAS.operario)}
          >
            Volver
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-900">Escanear palet</h2>
        <p className="text-base text-neutral-600">
          Apuntá la cámara al código QR pegado en el palet.
        </p>

        <Suspense
          fallback={
            <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-neutral-900 text-white">
              <Spinner etiqueta="Preparando el lector" />
            </div>
          }
        >
          <LectorQR
            onLeer={manejarLectura}
            onFallo={manejarFallo}
            pausado={navegando}
            className="aspect-square w-full"
          />
        </Suspense>

        {codigoAjeno !== null && (
          <ErrorMessage
            titulo="Ese código no es de un palet"
            mensaje="El código que leíste no pertenece a este sistema. Fijate que sea la etiqueta de AIBAR, la que tiene el número de palet impreso al lado del QR."
          />
        )}
      </Card>

      {/* Salida para el caso real de la etiqueta rota o despegada: acá es donde
          el operario se da cuenta de que el QR no va a leer. */}
      <Button
        variante="secundario"
        tamaño="lg"
        anchoCompleto
        onClick={() => navegar(RUTAS.buscarPalets)}
      >
        No puedo escanearlo: buscar por número o lote
      </Button>

      <Button variante="fantasma" anchoCompleto onClick={() => navegar(RUTAS.operario)}>
        Cancelar
      </Button>
    </div>
  )
}
