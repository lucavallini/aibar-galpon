import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client'
import { obtenerBase } from '@/offline/db'

/**
 * Guarda la caché de React Query en IndexedDB.
 *
 * Es lo que permite que el operario abra un palet que ya había consultado
 * aunque en ese sector del galpón no haya señal. Sin esto, la cola de
 * movimientos casi no serviría: no se puede decidir cuánto descontar sin ver
 * cuánto hay.
 *
 * Se escribe a mano en vez de usar el persister que trae React Query porque ese
 * guarda en `localStorage`, que este proyecto no usa: es síncrono —bloquea la
 * interfaz mientras serializa— y tiene un límite de pocos megas.
 */

const CLAVE = 'react-query'

export const persisterIndexedDB: Persister = {
  async persistClient(cliente: PersistedClient) {
    try {
      const base = await obtenerBase()
      await base.put('cache-consultas', cliente, CLAVE)
    } catch (error: unknown) {
      // Quedarse sin espacio o sin IndexedDB no puede romper la app: se pierde
      // la posibilidad de consultar sin señal, nada más.
      console.error('[offline] no se pudo guardar la caché de consultas', error)
    }
  },

  async restoreClient() {
    try {
      const base = await obtenerBase()
      return (await base.get('cache-consultas', CLAVE)) as PersistedClient | undefined
    } catch (error: unknown) {
      console.error('[offline] no se pudo recuperar la caché de consultas', error)
      return undefined
    }
  },

  async removeClient() {
    try {
      const base = await obtenerBase()
      await base.delete('cache-consultas', CLAVE)
    } catch (error: unknown) {
      console.error('[offline] no se pudo borrar la caché de consultas', error)
    }
  },
}

/**
 * Cuánto tiempo sirve la caché guardada.
 *
 * Una semana: pasado eso, los datos del depósito están tan viejos que es mejor
 * no mostrarlos que arriesgar una decisión sobre stock inexistente.
 */
export const MAXIMA_EDAD_CACHE = 7 * 24 * 60 * 60 * 1000
