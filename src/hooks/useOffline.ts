import { use } from 'react'
import { contextoOffline, type ContextoOffline } from '@/offline/contexto'

/**
 * Estado de conexión y de la cola de pendientes.
 *
 * Es la única forma en que una pantalla se entera de si hay señal. La decisión
 * de mandar o encolar no se toma acá: eso vive en `src/offline/`.
 */
export function useOffline(): ContextoOffline {
  const contexto = use(contextoOffline)

  if (contexto === null) {
    throw new Error('useOffline necesita estar dentro de <OfflineProvider>.')
  }

  return contexto
}
