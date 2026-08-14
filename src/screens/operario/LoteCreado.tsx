import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { QRCodeCanvas } from 'qrcode.react'
import { usePaletsPorIds } from '@/hooks/usePalet'
import { useImpresora } from '@/hooks/useImpresora'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { urlPalet, urlPublicaConfigurada } from '@/lib/urlPalet'
import { rutaPalet, RUTAS } from '@/rutas'

/**
 * Los palets de un lote recién creado, con sus QR listos para imprimir.
 *
 * Existe para resolver el momento siguiente al alta: se acaban de crear diez
 * palets y hay que pegarles diez etiquetas distintas. Sin esta pantalla habría
 * que ir a buscar palet por palet en el listado para imprimir cada una.
 *
 * **Los QR no se fotocopian**: cada palet es una fila distinta y su código
 * apunta a un número propio. Diez palets con el mismo código serían diez bultos
 * con una sola identidad, sin poder ubicarlos ni descontarles stock por
 * separado.
 */

/** Lado del QR que se manda a imprimir. Espeja el de `EtiquetaPalet`. */
const LADO_QR_IMPRESION = 600

export function LoteCreado() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()

  /** Los números vienen en la dirección: recargar no pierde la lista. */
  const ids = (parametros.get('palets') ?? '')
    .split(',')
    .filter((parte) => /^\d+$/.test(parte.trim()))
    .map(Number)

  const { data: palets, isPending, isError, error, refetch } = usePaletsPorIds(ids)

  const { estado, error: errorImpresora, hayBluetooth, imprimir } = useImpresora()

  /**
   * Cuál se está por imprimir.
   *
   * Se renderiza **un solo** QR en alta resolución por vez, y no uno por palet:
   * cincuenta canvas de 600×600 son cincuenta bitmaps en memoria, y esto corre
   * en el celular del depósito.
   */
  const [aImprimir, setAImprimir] = useState<number | null>(null)

  /** Los que ya salieron, para no perder la cuenta a mitad del lote. */
  const [impresos, setImpresos] = useState<number[]>([])

  const refQRImpresion = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (aImprimir === null) return

    const palet = palets?.find((cada) => cada.id === aImprimir)
    const qr = refQRImpresion.current

    if (palet === undefined || qr === null) return

    let cancelado = false

    async function mandarAImprimir() {
      // El canvas ya tiene dibujado el QR de este palet: el efecto corre
      // después del repintado, que es justamente por lo que se espera acá en
      // vez de imprimir dentro del onClick.
      await imprimir({
        qr: qr as HTMLCanvasElement,
        id: palet!.id,
        producto: palet!.producto.nombre,
        lote: palet!.lote,
        cantidad: `${palet!.cantidad_inicial} ${palet!.unidad_medida}`,
      })

      if (cancelado) return

      setImpresos((previos) =>
        previos.includes(palet!.id) ? previos : [...previos, palet!.id],
      )
      setAImprimir(null)
    }

    void mandarAImprimir()

    return () => {
      cancelado = true
    }
  }, [aImprimir, palets, imprimir])

  if (ids.length === 0) {
    return (
      <EmptyState
        titulo="No hay ningún lote para mostrar"
        descripcion="Esta dirección no trae los palets de ningún lote."
        accion={<Button onClick={() => navegar(RUTAS.operario)}>Volver al inicio</Button>}
      />
    )
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-12 text-marca-700">
        <Spinner tamaño="lg" etiqueta="Cargando los palets del lote" />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        titulo="No se pudieron cargar los palets del lote"
        mensaje={error.message}
        onReintentar={() => void refetch()}
      />
    )
  }

  const paletAImprimir = palets.find((palet) => palet.id === aImprimir)
  const imprimiendo = estado === 'conectando' || estado === 'imprimiendo'

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="text-xl font-semibold text-piedra-900">
          Lote creado: {palets.length} palets
        </h2>
        <p className="mt-1 text-base text-piedra-600">
          Cada palet tiene su propio código: <strong>no se pueden fotocopiar</strong>.
          Imprimí una etiqueta por palet y pegala antes de pasar al siguiente.
        </p>

        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-900">
          Quedaron <strong>sin ubicar</strong>. Al dejar cada uno en su lugar,
          escaneá su etiqueta y asignale el sector.
        </p>

        {!urlPublicaConfigurada() && (
          <div className="mt-3">
            <ErrorMessage
              titulo="Falta configurar el dominio"
              mensaje="Los QR apuntan a una dirección local, así que solo funcionan en esta computadora. Antes de imprimir etiquetas de verdad hay que definir VITE_URL_PUBLICA."
            />
          </div>
        )}

        {!hayBluetooth && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">
              No se puede imprimir desde este dispositivo
            </p>
            <p className="mt-1 text-base text-amber-800">{errorImpresora}</p>
            <p className="mt-2 text-base text-amber-800">
              Entrá a cada palet desde la lista de abajo para descargar su QR e
              imprimirlo por otro medio.
            </p>
          </div>
        )}

        <p className="mt-3 text-sm font-medium text-piedra-600">
          Impresas {impresos.length} de {palets.length}
        </p>
      </Card>

      {/* El único QR en alta resolución: se dibuja el del palet que se está por
          imprimir y el efecto de arriba lo manda a la impresora. */}
      <div className="hidden" aria-hidden="true">
        {paletAImprimir !== undefined && (
          <QRCodeCanvas
            ref={refQRImpresion}
            value={urlPalet(paletAImprimir.id)}
            size={LADO_QR_IMPRESION}
            level="M"
            marginSize={2}
          />
        )}
      </div>

      <ol className="flex flex-col gap-3">
        {palets.map((palet) => {
          const yaSalio = impresos.includes(palet.id)

          return (
            <li key={palet.id}>
              <Card className="flex items-center gap-4">
                <div className="shrink-0 rounded border border-piedra-200 bg-white p-1">
                  <QRCodeCanvas
                    value={urlPalet(palet.id)}
                    size={96}
                    level="M"
                    marginSize={1}
                    aria-label={`Código QR del palet ${palet.id}`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="cifra text-lg font-bold text-piedra-900">#{palet.id}</p>
                  <p className="truncate text-sm text-piedra-600">
                    {palet.cantidad_inicial} {palet.unidad_medida}
                  </p>
                  <p className="truncate text-sm text-piedra-500">Lote {palet.lote}</p>

                  {yaSalio && (
                    <div className="mt-1">
                      <Badge variante="exito">Etiqueta impresa</Badge>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  {hayBluetooth && (
                    <Button
                      variante={yaSalio ? 'secundario' : 'primario'}
                      cargando={imprimiendo && aImprimir === palet.id}
                      disabled={imprimiendo}
                      onClick={() => setAImprimir(palet.id)}
                    >
                      {yaSalio ? 'Reimprimir' : 'Imprimir'}
                    </Button>
                  )}

                  <Button variante="fantasma" onClick={() => navegar(rutaPalet(palet.id))}>
                    Abrir
                  </Button>
                </div>
              </Card>
            </li>
          )
        })}
      </ol>

      {estado === 'error' && errorImpresora !== null && (
        <ErrorMessage titulo="No se pudo imprimir" mensaje={errorImpresora} />
      )}

      <Button variante="secundario" anchoCompleto onClick={() => navegar(RUTAS.operario)}>
        Terminé
      </Button>
    </div>
  )
}
