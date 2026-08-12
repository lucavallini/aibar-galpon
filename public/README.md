# Assets estáticos

Faltan los íconos de la PWA, declarados en el `manifest` de `vite.config.ts`. Hasta que
estén, la app instalada muestra un ícono genérico (no rompe el build ni el service worker).

Generar a partir del logo de AIBAR y dejarlos en esta carpeta:

| Archivo | Tamaño | Notas |
|---|---|---|
| `icono-192.png` | 192×192 | Ícono base |
| `icono-512.png` | 512×512 | Splash screen y stores |
| `icono-512-maskable.png` | 512×512 | Con margen de seguridad del 20% alrededor del logo, para el recorte adaptativo de Android |
| `favicon.svg` | — | Referenciado desde `index.html`, todavía no existe |
