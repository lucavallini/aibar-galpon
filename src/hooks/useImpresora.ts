import { useCallback, useEffect, useState } from 'react'
import {
  alDesconectarse,
  conectarImpresora,
  desconectarImpresora,
  estaConectada,
  ErrorImpresora,
  imprimirEtiqueta,
  modeloConectado,
  motivoSinSoporte,
  soportaWebBluetooth,
  type DatosEtiqueta,
} from '@/lib/printer'

/**
 * Estado de la impresora, tal como lo tiene que ver el operario.
 *
 * Cada valor corresponde a algo distinto que mostrarle en pantalla: en un
 * galpón, "no pasa nada" y "está por salir la etiqueta" no pueden verse igual.
 */
export type EstadoImpresora =
  /** El navegador no puede hablar Bluetooth. iOS y Safari caen siempre acá. */
  | 'sin-soporte'
  /** Hay soporte, pero todavía no se emparejó ninguna impresora. */
  | 'desconectada'
  /** Diálogo de emparejamiento abierto o negociando la conexión. */
  | 'conectando'
  /** Emparejada y lista para imprimir. */
  | 'conectada'
  /** Etiqueta en camino. */
  | 'imprimiendo'
  /** Salió la etiqueta. */
  | 'impresa'
  /** Algo falló; el motivo está en `error`. */
  | 'error'

/**
 * Maneja la conexión y la impresión desde la UI.
 *
 * No sabe nada de Bluetooth: todo eso vive en `src/lib/printer.ts`. Acá solo se
 * traduce a estados que una pantalla pueda dibujar.
 */
export function useImpresora() {
  const hayBluetooth = soportaWebBluetooth()

  const [estado, setEstado] = useState<EstadoImpresora>(() => {
    if (!hayBluetooth) return 'sin-soporte'
    return estaConectada() ? 'conectada' : 'desconectada'
  })

  const [error, setError] = useState<string | null>(() =>
    hayBluetooth ? null : motivoSinSoporte(),
  )

  const [modelo, setModelo] = useState<string | null>(() => modeloConectado())

  // Si la impresora se apaga o se va de rango, la pantalla tiene que dejar de
  // decir «Conectada». Sin esto el operario se enteraría recién al fallarle la
  // próxima impresión.
  useEffect(() => {
    return alDesconectarse(() => {
      setModelo(null)
      setEstado((anterior) =>
        // Si ya está mostrando un error, ese mensaje es más informativo que un
        // «desconectada» genérico: no se pisa.
        anterior === 'error' || anterior === 'sin-soporte' ? anterior : 'desconectada',
      )
    })
  }, [])

  const conectar = useCallback(async () => {
    setEstado('conectando')
    setError(null)

    try {
      await conectarImpresora()
      setModelo(modeloConectado())
      setEstado('conectada')
    } catch (fallo: unknown) {
      // `printer.ts` ya devuelve el mensaje redactado para el operario.
      setError(fallo instanceof Error ? fallo.message : 'No se pudo conectar la impresora.')
      setEstado(fallo instanceof ErrorImpresora && !fallo.reintentable ? 'sin-soporte' : 'error')
    }
  }, [])

  const desconectar = useCallback(async () => {
    await desconectarImpresora()
    setModelo(null)
    setError(null)
    setEstado(hayBluetooth ? 'desconectada' : 'sin-soporte')
  }, [hayBluetooth])

  /**
   * Imprime. Si todavía no hay impresora emparejada, primero abre el diálogo de
   * emparejamiento: para el operario es un solo toque, no dos.
   */
  const imprimir = useCallback(async (datos: DatosEtiqueta) => {
    setError(null)

    try {
      if (!estaConectada()) {
        setEstado('conectando')
        await conectarImpresora()
        setModelo(modeloConectado())
      }

      setEstado('imprimiendo')
      await imprimirEtiqueta(datos)
      setEstado('impresa')
    } catch (fallo: unknown) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo imprimir la etiqueta.')
      setEstado('error')
    }
  }, [])

  /** Vuelve del error al estado que corresponda, para poder reintentar. */
  const limpiarError = useCallback(() => {
    setError(null)
    setEstado(estaConectada() ? 'conectada' : 'desconectada')
  }, [])

  return {
    estado,
    error,
    modelo,
    hayBluetooth,
    conectar,
    desconectar,
    imprimir,
    limpiarError,
  }
}
