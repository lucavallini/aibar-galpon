import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  alCambiarLaCola,
  listarPendientes,
  quitar,
  reintentar,
} from '@/offline/cola'
import { sincronizar, type ResultadoSincronizacion } from '@/offline/sincronizador'
import { contextoOffline, type ContextoOffline } from '@/offline/contexto'
import { claves } from '@/lib/queries/claves'
import type { MovimientoPendiente } from '@/offline/db'

/**
 * Mantiene al día el estado de conexión y de la cola.
 *
 * Sincroniza sola cuando vuelve la señal, que es el caso normal en el depósito:
 * el operario camina hasta un sector con cobertura y la cola se vacía sin que
 * tenga que acordarse de tocar nada.
 */

interface Props {
  children: ReactNode
}

export function OfflineProvider({ children }: Props) {
  const clienteDeQueries = useQueryClient()

  const [enLinea, setEnLinea] = useState(
    () => typeof navigator === 'undefined' || navigator.onLine,
  )
  const [cola, setCola] = useState<MovimientoPendiente[]>([])
  const [sincronizando, setSincronizando] = useState(false)

  const refrescarCola = useCallback(async () => {
    try {
      setCola(await listarPendientes())
    } catch (error: unknown) {
      // Sin IndexedDB —modo privado de algunos navegadores— la app tiene que
      // seguir funcionando en línea, aunque sin red de contención.
      console.error('[offline] no se pudo leer la cola local', error)
      setCola([])
    }
  }, [])

  const sincronizarAhora = useCallback(async (): Promise<ResultadoSincronizacion> => {
    setSincronizando(true)

    try {
      const resultado = await sincronizar()

      if (resultado.sincronizados > 0) {
        // El stock de la base cambió: lo que se esté mostrando quedó viejo.
        void clienteDeQueries.invalidateQueries({ queryKey: claves.palets.todos })
        void clienteDeQueries.invalidateQueries({ queryKey: claves.movimientos.todos })
        void clienteDeQueries.invalidateQueries({ queryKey: ['gerencia'] })
      }

      return resultado
    } finally {
      setSincronizando(false)
      await refrescarCola()
    }
  }, [clienteDeQueries, refrescarCola])

  // Carga inicial y suscripción a los cambios de la cola.
  //
  // La lectura va diferida con `queueMicrotask` para no encadenar un render
  // desde el cuerpo del efecto: leer IndexedDB es hablar con un sistema
  // externo, y su resultado tiene que entrar como una actualización más, no
  // como parte del montaje.
  useEffect(() => {
    queueMicrotask(() => {
      void refrescarCola()
    })

    return alCambiarLaCola(() => {
      void refrescarCola()
    })
  }, [refrescarCola])

  // Conexión: el navegador avisa cuando entra y cuando se va.
  useEffect(() => {
    function alVolver() {
      setEnLinea(true)
      // Apenas hay señal se intenta vaciar la cola, sin esperar al operario.
      void sincronizarAhora()
    }

    function alCortarse() {
      setEnLinea(false)
    }

    window.addEventListener('online', alVolver)
    window.addEventListener('offline', alCortarse)

    return () => {
      window.removeEventListener('online', alVolver)
      window.removeEventListener('offline', alCortarse)
    }
  }, [sincronizarAhora])

  // Al abrir la app puede haber quedado algo de la sesión anterior: el operario
  // cerró el navegador sin señal y lo vuelve a abrir con cobertura.
  useEffect(() => {
    let vigente = true

    queueMicrotask(() => {
      if (!vigente) return
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        void sincronizarAhora()
      }
    })

    return () => {
      vigente = false
    }
  }, [sincronizarAhora])

  const pendientes = cola.filter(
    (movimiento) => movimiento.estado !== 'fallido',
  ).length
  const fallidos = cola.filter((movimiento) => movimiento.estado === 'fallido').length

  const paletTienePendientes = useCallback(
    (paletId: number) => cola.some((movimiento) => movimiento.paletId === paletId),
    [cola],
  )

  const reintentarUno = useCallback(
    async (id: string) => {
      await reintentar(id)
      await sincronizarAhora()
    },
    [sincronizarAhora],
  )

  const descartarUno = useCallback(async (id: string) => {
    await quitar(id)
  }, [])

  const valor = useMemo<ContextoOffline>(
    () => ({
      enLinea,
      pendientes,
      fallidos,
      cola,
      sincronizando,
      sincronizarAhora,
      reintentarUno,
      descartarUno,
      paletTienePendientes,
    }),
    [
      enLinea,
      pendientes,
      fallidos,
      cola,
      sincronizando,
      sincronizarAhora,
      reintentarUno,
      descartarUno,
      paletTienePendientes,
    ],
  )

  return <contextoOffline.Provider value={valor}>{children}</contextoOffline.Provider>
}
