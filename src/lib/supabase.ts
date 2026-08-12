import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

/**
 * Cliente único de Supabase para toda la app.
 *
 * No instanciar `createClient()` en ningún otro lado: dos clientes compiten por
 * la misma sesión y terminan desincronizando el token. Y fuera de
 * `src/lib/queries/` esto no debería importarse: los componentes consumen hooks,
 * los hooks consumen queries, y las queries son las únicas que hablan con supabase-js.
 */

function leerVariableDeEntorno(nombre: keyof ImportMetaEnv): string {
  const valor = import.meta.env[nombre]

  // Falla acá, al arrancar y con un mensaje claro, en vez de dejar que la primera
  // query devuelva un 401 críptico media hora después.
  if (!valor) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Definila en el archivo .env de la raíz del proyecto y reiniciá el servidor de desarrollo.`,
    )
  }

  return valor
}

const url = leerVariableDeEntorno('VITE_SUPABASE_URL')
const anonKey = leerVariableDeEntorno('VITE_SUPABASE_ANON_KEY')

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // El operario escanea palets todo el día: la sesión tiene que sobrevivir a que
    // cierre la PWA y la vuelva a abrir.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
