import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { AuthProvider } from '@/auth/AuthProvider'
import { OfflineProvider } from '@/offline/OfflineProvider'
import { queryClient } from '@/lib/queryClient'
import { MAXIMA_EDAD_CACHE, persisterIndexedDB } from '@/offline/persistencia'
import { Rutas } from '@/rutas'
import './index.css'

const contenedor = document.getElementById('root')

if (contenedor === null) {
  throw new Error('No se encontró el elemento #root en index.html.')
}

createRoot(contenedor).render(
  <StrictMode>
    {/* La caché se guarda en IndexedDB para que el operario pueda volver a ver
        un palet ya consultado aunque en ese sector del galpón no haya señal. */}
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: persisterIndexedDB, maxAge: MAXIMA_EDAD_CACHE }}
    >
      <BrowserRouter>
        {/* El provider de sesión va dentro del router para que las pantallas
            puedan redirigir en función de la sesión. */}
        <AuthProvider>
          {/* Offline va adentro para poder invalidar las consultas al
              sincronizar y navegar desde el indicador. */}
          <OfflineProvider>
            <Rutas />
          </OfflineProvider>
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
