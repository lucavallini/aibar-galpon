import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useObservaciones } from '@/hooks/useObservaciones'
import {
  descargarComprobanteDeMovimientos,
  type PaletParaPdf,
} from '@/lib/pdfMovimientos'
import type { MovimientoConAutor } from '@/types'

interface Props {
  palet: PaletParaPdf
  movimientos: MovimientoConAutor[]
}

/**
 * Baja el historial del palet como PDF.
 *
 * Trae la bitácora por su cuenta en vez de recibirla: el comprobante lleva las
 * observaciones —son las que explican por qué se descontó lo que se descontó— y
 * pedírselas a cada pantalla obligaría a las dos a cargarlas aunque no las
 * muestren. React Query ya la tiene en caché si la bitácora está en pantalla,
 * así que no es una consulta de más.
 */
export function BotonDescargarMovimientos({ palet, movimientos }: Props) {
  const { data: observaciones, isPending } = useObservaciones(palet.id)

  const [generando, setGenerando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function descargar() {
    setGenerando(true)
    setFallo(null)

    try {
      await descargarComprobanteDeMovimientos({
        palet,
        movimientos,
        observaciones: observaciones ?? [],
      })
    } catch (error) {
      // Sin esto el operario aprieta el botón y no pasa nada: la librería del
      // PDF se descarga en el momento, y en el depósito la señal se corta.
      setFallo(
        error instanceof Error
          ? error.message
          : 'No se pudo generar el PDF. Probá de nuevo con señal.',
      )
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variante="secundario"
        anchoCompleto
        cargando={generando}
        // Mientras la bitácora no esté, el PDF saldría sin observaciones y
        // parecería que el palet no tiene ninguna.
        disabled={isPending || generando}
        onClick={() => void descargar()}
      >
        {generando ? 'Generando PDF…' : 'Descargar movimientos'}
      </Button>

      {fallo !== null && <p className="text-sm text-red-700">{fallo}</p>}
    </div>
  )
}
