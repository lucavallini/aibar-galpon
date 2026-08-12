/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** URL del proyecto de Supabase. */
  readonly VITE_SUPABASE_URL: string
  /** Clave pública `anon`. Nunca la `service_role`: esto viaja al navegador. */
  readonly VITE_SUPABASE_ANON_KEY: string
  /**
   * Dominio público de la app, el que se imprime en el QR de cada etiqueta.
   * Opcional en desarrollo; imprescindible para imprimir etiquetas de verdad.
   */
  readonly VITE_URL_PUBLICA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
