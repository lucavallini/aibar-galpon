import { fileURLToPath } from 'node:url'
// `defineConfig` de vitest y no de vite: es el que acepta la clave `test`.
import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Apagado en desarrollo a propósito. Con el service worker activo en
      // `npm run dev`, el shell queda precacheado y un cambio de estilos no se
      // ve hasta cerrar todas las pestañas del origen: el mecanismo que hace
      // que la app abra sin señal en el galpón tapa los cambios mientras se
      // trabaja. En el build de producción sigue intacto, que es donde importa.
      devOptions: { enabled: false },
      workbox: {
        // El shell entero queda precacheado: la app abre sin señal.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Cualquier ruta cae en index.html, que es lo que necesita una SPA
        // para que `/palet/152` funcione estando sin conexión.
        navigateFallback: 'index.html',
        // Sin esto, un chunk viejo queda servido para siempre tras un deploy.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Los datos NO se cachean acá: de eso se ocupa React Query con su
            // persistencia en IndexedDB, que sabe cuándo un dato quedó viejo.
            // Cachear respuestas de Supabase en el service worker haría que la
            // app muestre stock desactualizado creyendo que es fresco.
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'AIBAR — Trazabilidad de Palets',
        short_name: 'AIBAR',
        description:
          'Alta de palets, impresión de QR y registro de movimientos de stock del depósito de AIBAR.',
        lang: 'es-AR',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        background_color: '#ffffff',
        theme_color: '#007a63',
        icons: [
          {
            src: '/icono-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icono-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icono-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // El service worker y el catálogo de componentes no se testean.
    exclude: ['node_modules', 'dist', 'dev-dist'],
  },
})
