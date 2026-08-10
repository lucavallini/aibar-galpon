# CLAUDE.md — AIBAR Trazabilidad de Palets

Este archivo orienta a Claude (y a cualquier desarrollador) sobre cómo trabajar en este repositorio. Léelo antes de proponer cambios de estructura, dependencias o convenciones.

## Contexto del proyecto

PWA para que los operarios del depósito de AIBAR den de alta palets de agroquímicos y semillas, generen su QR, lo impriman con una NIIMBOT B1 vía Bluetooth, y registren movimientos de stock escaneando ese QR. La gerencia consulta el estado del depósito en un panel aparte. El backend es Supabase (Postgres + Auth + API REST/RPC automática); no hay servidor propio.

---

## Comandos esenciales

```bash
# Instalar dependencias
npm install

# Levantar entorno de desarrollo local (http://localhost:5173)
npm run dev

# Compilar para producción
npm run build

# Previsualizar el build de producción localmente
npm run preview

# Correr tests
npm run test

# Correr tests en modo watch
npm run test:watch

# Lint
npm run lint

# Formatear código
npm run format
```

### Supabase (CLI)

```bash
# Levantar Supabase local (Postgres + Auth + API) en Docker
supabase start

# Aplicar el schema / nuevas migraciones a la base local
supabase db reset

# Crear una migración nueva a partir de un cambio hecho en local
supabase db diff -f nombre_de_la_migracion

# Aplicar migraciones al proyecto remoto (producción)
supabase db push

# Detener Supabase local
supabase stop
```

No se edita el schema a mano contra producción desde el panel de Supabase salvo emergencia. Todo cambio de base va como migración versionada en `supabase/migrations/`.

---

## Stack tecnológico

| Capa | Tecnología | Versión objetivo |
|---|---|---|
| Lenguaje | TypeScript | 5.x |
| Build tool | Vite | 5.x |
| UI | React | 18.x |
| Estilos | Tailwind CSS | 3.x |
| Backend / DB | Supabase (Postgres) | proyecto gestionado |
| Cliente Supabase | `@supabase/supabase-js` | 2.x |
| Server state / cache | `@tanstack/react-query` | 5.x |
| Generación de QR | `qrcode.react` | última estable |
| Lectura de QR (cámara) | `html5-qrcode` | última estable |
| Impresión Bluetooth | `niimblue` | última estable |
| Almacenamiento offline | `idb` (wrapper de IndexedDB) | última estable |
| Testing | Vitest + Testing Library | última estable |
| Hosting frontend | Vercel | — |
| PWA | `vite-plugin-pwa` | última estable |

No se agregan frameworks ni librerías fuera de esta tabla sin discutirlo antes — ver sección "Lo que se debe evitar".

---



**Dónde vive la lógica de negocio importante:**
- Las reglas de stock (qué puede sumar, qué resta, quién puede hacer qué) **viven en la base de datos** (`supabase/migrations/`), no en el frontend. El frontend solo llama a `registrar_movimiento()` / `corregir_movimiento()` vía RPC.
- `src/lib/queries/` es la única capa que debe hablar directo con `supabase-js`. Los componentes de `screens/` no llaman a Supabase directamente: consumen hooks que usan esas queries.
- `src/offline/` es la única capa que decide si una acción se ejecuta contra Supabase o se encola localmente.

---

## Convenciones de código y estilo

- **Nombres de entidades de negocio en español**, igual que en la base de datos: `palet`, `movimiento`, `producto`, `galpon`, no traducir a `pallet`/`product`. El código y el dominio deben hablar el mismo idioma que el schema SQL.
- **Componentes React**: `PascalCase` (`DetallePalet.tsx`). **Hooks**: `camelCase` con prefijo `use` (`usePalet.ts`). **Funciones y variables**: `camelCase`. **Tipos e interfaces**: `PascalCase`, sin prefijo `I`.
- **Un componente por archivo**, y el archivo se llama igual que el componente.
- **Componentes funcionales únicamente**, con hooks. Nada de componentes de clase.
- **Props tipadas explícitamente** con `interface Props { ... }` arriba del componente, nunca `any`.
- **Tailwind para todo el estilado**. No se escriben archivos `.css` sueltos salvo casos puntuales imposibles de resolver con utilidades (documentarlo en un comentario si pasa).
- **Un solo cliente de Supabase** (`src/lib/supabase.ts`), importado donde se necesite. No instanciar `createClient()` en otros lugares.
- **Manejo de errores de Supabase**: siempre desestructurar `{ data, error }` y chequear `error` explícitamente antes de usar `data`. Nunca ignorar el `error` de un `.rpc()` — ahí viajan los mensajes de validación de negocio (stock insuficiente, fuera de plazo para corregir, etc.) y son justamente los que hay que mostrarle al operario.
- **Formularios**: validar en el cliente para dar feedback rápido, pero recordar que la validación real y definitiva es la de la base de datos (RLS + `CHECK` + funciones). El frontend valida por UX, no por seguridad.
- Commits en español, en imperativo: `agrega pantalla de alta de palet`, no `Agregando...` ni en inglés.

---

## Lo que se debe evitar

- **No usar Next.js.** Esta es una PWA interna sin necesidad de SSR ni SEO. Si se sugiere Next.js en algún momento, es una señal de que se está sobrecomplicando algo que no lo necesita.
- **No usar Angular ni otro framework de UI** distinto de React. Ya se evaluó y descartado para este proyecto.
- **No usar Redux ni otras librerías de estado global pesadas.** El estado del servidor lo maneja React Query; el estado local de UI, `useState`/`useReducer` alcanza. Si en algún punto parece necesitarse Redux, es señal de repensar el diseño del componente antes de sumar la librería.
- **No usar `localStorage` ni `sessionStorage`** para la cola offline ni para datos de sesión sensibles — usar `idb` (IndexedDB) como está definido en `src/offline/`.
- **No hacer `UPDATE` directo sobre `palet.cantidad_disponible` ni `palet.estado`** desde el frontend, ni sugerir hacerlo. Estos campos están bloqueados a propósito por RLS y trigger a nivel de base de datos; la única vía es `registrar_movimiento()` / `corregir_movimiento()` vía RPC. Si algo parece requerir saltarse esto, el problema es el diseño de la función SQL, no el frontend.
- **No hacer `INSERT` directo sobre `movimiento`.** Es una tabla de solo lectura desde el cliente; todo movimiento se crea a través de las funciones RPC correspondientes.
- **No guardar contraseñas, tokens ni claves de Supabase (`service_role`) en el código del frontend.** Solo la `anon key` pública va en el cliente. Cualquier operación que requiera privilegios elevados se resuelve con una función `SECURITY DEFINER` en la base, no exponiendo una key privada.
- **No proponer bibliotecas de impresión distintas de `niimblue`** para la NIIMBOT B1 sin verificar antes que sean compatibles con Web Bluetooth — ya se evaluó esta opción específicamente para este hardware.
- **No asumir que Web Bluetooth funciona en iOS/Safari.** Cualquier función de impresión debe degradar con un mensaje claro en vez de fallar en silencio si el navegador no soporta Web Bluetooth.
- **No mezclar lógica de negocio (cálculo de stock, reglas de quién puede hacer qué) dentro de componentes de React.** Esa lógica ya vive en la base de datos; el frontend solo la invoca y muestra el resultado.