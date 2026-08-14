# CLAUDE.md — AIBAR Trazabilidad de Palets

Este archivo orienta a Claude (y a cualquier desarrollador) sobre cómo trabajar en este repositorio. Léelo antes de proponer cambios de estructura, dependencias o convenciones.

## Contexto del proyecto

PWA para que los operarios del depósito de AIBAR den de alta palets de agroquímicos y semillas, generen su QR, lo impriman con una NIIMBOT M2-H vía Bluetooth, y registren movimientos de stock escaneando ese QR. La gerencia consulta el estado del depósito en un panel aparte. El backend es Supabase (Postgres + Auth + API REST/RPC automática); no hay servidor propio.

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

# Tests con reporte de cobertura
npm run test:coverage
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
| Lenguaje | TypeScript | 6.x |
| Build tool | Vite | 8.x |
| UI | React | 19.x (con React Compiler) |
| Estilos | Tailwind CSS | 4.x (plugin `@tailwindcss/vite`, config CSS-first) |
| Ruteo | `react-router` | 8.x |
| Formularios | `react-hook-form` + `zod` + `@hookform/resolvers` | 7.x / 4.x / 5.x |
| Backend / DB | Supabase (Postgres) | proyecto gestionado |
| Cliente Supabase | `@supabase/supabase-js` | 2.x |
| Server state / cache | `@tanstack/react-query` | 5.x |
| Generación de QR | `qrcode.react` | última estable |
| Lectura de QR (cámara) | `html5-qrcode` | última estable |
| Impresión Bluetooth | `@mmote/niimbluelib` | `0.0.1-alpha.42` (fijada) |
| Almacenamiento offline | `idb` (wrapper de IndexedDB) | última estable |
| Testing | Vitest + Testing Library | última estable |
| Hosting frontend | Netlify (`netlify.toml`) | — |
| PWA | `vite-plugin-pwa` | última estable |

No se agregan frameworks ni librerías fuera de esta tabla sin discutirlo antes — ver sección "Lo que se debe evitar".

---

## Estructura de directorios

```
.
├── public/                   # Assets estáticos (íconos de la PWA, favicon)
├── src/
│   ├── lib/
│   │   ├── supabase.ts       # Cliente único de Supabase, tipado con <Database>
│   │   └── queries/          # ÚNICA capa que habla con supabase-js
│   │       ├── errores.ts    # ErrorSupabase + helpers de desempaquetado
│   │       ├── sesion.ts     # Supabase Auth + traducción de errores al español
│   │       ├── usuarios.ts
│   │       ├── productos.ts
│   │       ├── palets.ts
│   │       └── movimientos.ts
│   ├── types/
│   │   ├── database.ts       # Espejo del schema SQL, forma `Database`
│   │   └── index.ts          # Alias de dominio en español (Palet, Movimiento, …)
│   ├── auth/
│   │   ├── contexto.ts       # createContext + tipos del contexto de sesión
│   │   └── AuthProvider.tsx  # Estado de sesión y perfil, envuelve toda la app
│   ├── hooks/                # useAuth y, más adelante, los hooks de React Query
│   ├── components/
│   │   ├── ui/               # Primitivos presentacionales (Button, Input, Card…)
│   │   ├── layout/           # Layout, Header y Nav
│   │   ├── RutaProtegida.tsx
│   │   └── EstadoPaletBadge.tsx  # Puente UI ↔ dominio
│   ├── screens/              # Pantallas; no llaman a Supabase, consumen hooks
│   │   ├── operario/
│   │   └── gerencia/
│   ├── offline/              # Cola de acciones en IndexedDB (idb)
│   ├── rutas.tsx             # TODAS las rutas y las direcciones, en un solo archivo
│   ├── main.tsx
│   └── index.css             # Único CSS del proyecto: `@import 'tailwindcss'`
├── supabase/migrations/      # Schema versionado: acá vive la lógica de negocio
├── aibar_schema_completo.sql # Schema de referencia, ya aplicado
└── vite.config.ts
```

Se crean solo los directorios que están en uso: `hooks/`, `components/`, `screens/` y
`offline/` aparecen acá como destino de las fases siguientes, no como carpetas vacías.

Los imports usan el alias `@/` (configurado en `vite.config.ts` y `tsconfig.app.json`):
`import { supabase } from '@/lib/supabase'`, no rutas relativas con `../../`.

**Sobre el sistema de componentes**: los primitivos de `src/components/ui/` son
**puramente presentacionales** — no importan nada de `@/lib/queries` ni de `@/types`, no
consultan la sesión y no deciden nada de negocio. Cuando un componente necesita conocer el
dominio (traducir `EstadoPalet` a una etiqueta, por ejemplo) vive en `src/components/`, no
en `ui/`, como hace `EstadoPaletBadge`.

Los nombres de los primitivos van **en inglés** (`Button`, `Input`, `Card`); el español
queda para lo que toca el negocio (`EstadoPaletBadge`, `Palet`, `Movimiento`), igual que en
el schema. Antes de escribir un control nuevo, revisar si ya existe en `ui/`: la idea es
que las pantallas no vuelvan a definir botones ni formularios.

**Contexto de uso, que manda sobre la estética**: la app se opera desde el celular, en el
depósito, muchas veces con guantes. Nada táctil baja de `min-h-toque` (44 px, definido en
`src/index.css`), el texto de los controles es `text-base` — con menos, Safari en iOS hace
zoom al enfocar — y se prioriza la usabilidad por sobre la densidad de información. Los
formularios se arman con `Form` + `Field`, que se encargan del `htmlFor`, el `aria-invalid`
y el `aria-describedby`; no escribir `<label>` sueltos.

Hay un catálogo con todos los componentes y sus estados en **`/ui`**, disponible solo en
desarrollo. Conviene mirarlo ahí antes de inventar una variante nueva.

**Sobre la conectividad inestable**: en el depósito la señal falla por sectores. Toda la
lógica de eso vive en `src/offline/` y **ninguna pantalla pregunta si hay conexión**: usan
`useRegistrarMovimiento()`, que internamente manda o encola, y `useOffline()` para mostrar el
estado. Reglas que no se negocian:

- **Nunca `localStorage` ni `sessionStorage`.** Todo en IndexedDB vía `idb` — incluida la
  caché de React Query, que usa un persister propio (`src/offline/persistencia.ts`) en lugar
  del oficial, que guarda en `localStorage`.
- **Un rechazo de negocio no se encola.** «Stock insuficiente» va a fallar igual cuando
  vuelva la señal: encolarlo sería prometer algo que no va a pasar. Solo se encola cuando el
  pedido no llegó al servidor — la distinción la hace `esFalloDeRed()`.
- **Un movimiento encolado nunca se muestra como registrado.** El diálogo dice explícitamente
  que quedó en el teléfono, y el detalle avisa que el stock en pantalla todavía no lo incluye.
- **Un movimiento rechazado no se descarta solo.** Queda en la cola con el motivo, y el
  operario decide en `/deposito/pendientes` si reintenta o descarta.
- Los movimientos se sincronizan **de a uno y en orden de creación**: dos descuentos del mismo
  palet mandados en paralelo pueden rechazarse mutuamente.

**Sobre clientes y observaciones**: un palet con `cliente_id` en `null` es mercadería propia
de AIBAR — es el caso más común, por eso el campo es opcional. Las observaciones son una
**bitácora inmutable** (`observacion_palet`), no un campo de texto en `palet`: cada nota
queda con su autor y su fecha, y si una está equivocada se agrega otra aclarándolo, igual que
con los movimientos. Se pueden anotar en cualquier momento, incluso sobre un palet vacío o
dado de baja: dejar constancia no toca el stock.

**Sobre el panel administrativo**: es de solo lectura **con una sola excepción, la gestión de
usuarios** (`screens/gerencia/Usuarios.tsx`). Fuera de esa pantalla no hay ni debe haber
mutaciones en `src/screens/gerencia/`, `src/lib/queries/gerencia.ts` ni `useGerencia.ts`.

El **registro público está cerrado a propósito**: si cualquiera pudiera crearse una cuenta,
bastaría un script para llenar la base. El alta la hace el gerente y pasa por la Edge Function
`crear-usuario`, que valida su rol del lado del servidor — crear cuentas necesita la
`service_role`, y esa clave jamás puede estar en el navegador. El detalle de palet del jefe es una pantalla aparte de la del operario, y
no la misma con los botones ocultos: así no hay ninguna ruta de código por la que se le
escape una escritura.

Se apoya en las vistas `vista_palet_gerencia` y `vista_stock_por_producto`, que resuelven en
Postgres los cruces con producto, detalle y movimientos. ⚠️ **Cualquier vista nueva tiene que
declararse `WITH (security_invoker = on)`**: por omisión una vista corre con los permisos de
quien la creó, lo que saltea RLS por completo y expondría el depósito entero a cualquier
usuario autenticado, incluso uno inactivo.

Los filtros del panel son **preguntas de negocio**, no filtros de columna: «ya vencidos»,
«vencen en 6 meses», «sin movimiento hace más de 60», «abiertos a medias». Cada una combina
varios criterios y define además el orden del listado. Al agregar una, sumarla a
`PreguntaDeNegocio` y a `criteriosDe()`, que las declara como datos y las comparten el
listado y los conteos.

La anticipación con la que se avisa un vencimiento es **6 meses** (`DIAS_VENCIMIENTO_PROXIMO`
en `queries/gerencia.ts`), no 30 días: colocar un agroquímico lleva meses —hay que
encontrarle comprador y sacarlo del galpón—, así que un aviso más corto llegaba cuando ya no
quedaba margen para hacer nada. Ese mismo umbral gobierna el cartel ámbar de cada fila, y por
eso el plazo se muestra con `formatearAnticipacion()`: pasado el par de meses cuenta en meses,
porque «Vence en 174 d» obliga a hacer la cuenta mental.

**Sobre los movimientos de stock**: se registran con `registrarMovimiento()`, que llama a la
RPC. Nunca por `INSERT` en `movimiento` ni `UPDATE` sobre `palet` — está bloqueado por
permisos y triggers, y además los tipos lo vuelven un error de compilación. Los mensajes que
devuelve la función (`Stock insuficiente. Disponible: 80, solicitado: 100`) están escritos
para el operario: se muestran **tal cual**, sin reemplazarlos por un genérico. La validación
del cliente contra el disponible es solo para dar respuesta inmediata; entre que se abre el
formulario y se confirma, otro operario puede haber descontado del mismo palet, y quien
decide es la base, que bloquea la fila mientras calcula.

Toda acción que toque stock real pide **confirmación con resumen** antes de ejecutarse: un
cero de más en la cantidad hay que ir a corregirlo después, con la ventana de 30 minutos
encima.

El historial abre con el **alta del palet** (`+cantidad_inicial`), que **no es una fila de
`movimiento`**: el alta no genera ninguna, porque la cantidad inicial la fija el trigger
`inicializar_palet()`. Se arma en la presentación (`AltaDelPalet` en
`HistorialMovimientos`) y por eso no tiene id ni se puede corregir. Sin ella la lista
empieza restando de un total que no figura en ningún lado. Va **al final**, porque el
historial se lee del más reciente al más viejo.

**Sobre el comprobante en PDF**: `descargarComprobanteDeMovimientos()` en
`lib/pdfMovimientos.ts` es la única forma de sacar la trazabilidad de la app, así que lleva
los movimientos **y las observaciones** —son las que explican un descuento— y la fecha en
que se generó. En el papel los movimientos van del más viejo al más nuevo, al revés que en
pantalla. `jspdf` se importa con `import()` **dentro de la función**, nunca arriba del
archivo: pesa ~400 kB y solo hace falta al apretar el botón, igual que el lector de QR. Si
esa carga falla —en el depósito la señal se corta— hay que mostrarlo: un botón que no hace
nada se lee como que la app se colgó.

**Sobre el escaneo**: el lector (`src/components/LectorQR.tsx`) se carga con `React.lazy`
porque `html5-qrcode` pesa ~380 kB y solo hace falta en esa pantalla. Lo delicado ahí es
apagar la cámara al desmontar: si el stream queda tomado, el led del teléfono sigue
prendido y la próxima vez la cámara aparece ocupada. `extraerIdDePalet()` acepta **cualquier
dominio** a propósito: si la app se muda, las etiquetas ya impresas —que no se pueden
reimprimir de a miles— tienen que seguir funcionando.

**Sobre el QR y la impresión**: el QR de cada palet codifica `VITE_URL_PUBLICA + /p/{id}` —
ver `src/lib/urlPalet.ts`. Es corta a propósito: menos densidad de QR, más fácil de escanear
en una etiqueta chica y con poca luz. La impresora es una **NIIMBOT M2-H**: 300 dpi, cabezal
de 567 px (48 mm útiles), y comparte el algoritmo de impresión de la B1 (`PrintTaskName`
`'B1'`). El alto de etiqueta está en `ALTO_ETIQUETA_MM` de `printer.ts`: la cinta del depósito es de
**50 × 30 mm**. Con ese papel la etiqueta lleva **solo el QR —lo más grande que entra— y el
número de palet al costado**. El lote y el producto se probaron y se sacaron: no entraban
completos, y un dato cortado a la mitad no identifica nada mientras le roba tamaño al código.
El número se queda porque es el seguro contra una etiqueta arruinada: si el QR se raya o se
moja y no hay ningún dato impreso, ese palet no se puede identificar ni buscar. Si cambia el
rollo, rehacer las cuentas de `componerEtiqueta()` y verificarlas antes de imprimir.

**Sobre los sectores**: un sector es un **lugar físico** y ahí entra un palet y no dos.
Son filas de la tabla `sector` (una por galpón, nombre único sin distinguir mayúsculas ni
espacios) y **no texto libre**: cuando se escribían a mano, `A7`, `a7` y `A-7` eran tres
lugares distintos para la base y el mismo estante en el galpón. El palet apunta con
`sector_id`; `palet.galpon` y `palet.sector` se conservan pero son **copias de lectura**
que mantiene el trigger `sincronizar_ubicacion_palet()` —por eso salieron del `GRANT
UPDATE`: escribirlas desde el cliente es un error de permisos, y mover un palet es
cambiarle `sector_id`.

La exclusión la garantiza el índice único parcial `palet_sector_ocupado_unico` sobre
`sector_id` donde el estado es `activo` o `parcial`, y no un chequeo en el cliente: dos
operarios dando de alta al mismo tiempo desde dos teléfonos se colarían por la ventana que
deja cualquier «consultar y después insertar». El trigger `verificar_sector_libre()` existe
solo para dar el mensaje que nombra al palet que ocupa el lugar. Cuando un palet se termina
o se da de baja sale del índice solo y el sector queda libre sin que nadie haga nada, que es
para lo que está el `WHERE` por estado — y por eso toda mutación que toque el estado de un
palet tiene que invalidar `claves.sectores.todos`.

`sector_id` admite `null` y significa **«está en algún lado que no se registró»**: es como
quedan los palets que compartían lugar al migrar y los que nacen de un **alta en lote**. El
alta de a uno **sigue exigiendo ubicación** —`crear_palet_completo()` la pide—: la única
puerta para crear sin sector es `crear_palets_en_lote()`, y es deliberada. La app los
muestra marcados en ámbar y el buscador tiene el filtro **«sin ubicar»**, que es la lista
de lo que falta terminar.

⚠️ El aviso de «sin ubicar» **no es una observación, es un estado**: se deduce de
`sector_id IS NULL` en cada pantalla que lo muestra. Así aparece solo al crear el palet y
desaparece solo al asignarle el sector, sin que nadie escriba ni borre una nota. Se
descartó escribirlo en la bitácora porque para «sacarlo» después haría falta permitir
borrar observaciones, y ese permiso vale para todas: también para las de roturas y
faltantes, que son justamente las que tienen que ser imborrables. El `SelectorDeSector` ofrece **solo los libres**, y trae adentro el alta de
un sector nuevo porque el momento en que se descubre que falta es ese: el operario está en
el galpón, con el palet en la mano.

**Sobre qué es un producto y qué es un palet**: el producto es **qué cosa es**, y se carga
una sola vez desde `AltaProducto` — una semilla es un nombre (Soja, Maíz); un agroquímico
es un nombre y su `concentracion`, que es lo que separa dos envases que dicen lo mismo. Todo
lo que cambia de partida en partida vive en el palet: el lote, el vencimiento, la cantidad,
la unidad, y en semillas el `detalle_semilla.hibrido` y el `calibre`. Por eso el alta de
producto **no pide** marca, principio activo, especie ni híbrido aunque las columnas sigan
existiendo: cargarlos ahí obligaba a crear un producto nuevo por cada camión.

El formulario de palet nombra al lote como el depósito: **«número de lote»** en agroquímicos
—es lo que dice el remito— y **«batch»** en semillas —es lo que dice la bolsa—. Es la misma
columna, `palet.lote`.

**Sobre la unidad de medida**: es del **palet**, no del producto (`palet.unidad_medida`). De
la misma semilla entra una partida en bolsas y otra a granel en kilos, y del mismo
agroquímico entran bidones y tambores. Se elige en el alta con `CampoCantidad`, de la lista
cerrada de `src/lib/unidades.ts` — texto libre traía «kg», «Kg» y «kilos» conviviendo como
tres unidades distintas. No está en el `GRANT UPDATE` de `palet`: como `cantidad_inicial`,
se fija al dar de alta y no se cambia después. `producto.unidad_medida` se conserva como
referencia y es nullable; **ninguna pantalla debe volver a leer de ahí la unidad de un
palet**. Consecuencia en el panel: `vista_stock_por_producto` devuelve **una fila por
producto y unidad**, porque sumar 120 bolsas con 400 kilos daría 520 de nada.

**Sobre el ingreso por DNI**: en el depósito nadie tiene correo de la empresa, así que se
entra con el DNI. Supabase Auth solo autentica por email, de modo que el DNI se convierte en
uno interno —`30123456@aibar.local`— con `aIdentificadorDeCuenta()` en `queries/sesion.ts`.
Ese correo no existe, no recibe nada y **no se muestra nunca en pantalla**: donde antes iba
el email va el nombre de la persona, y donde hace falta identificarla, el DNI. La misma
conversión está en la Edge Function `crear-usuario`; si las dos dejan de coincidir —por
ejemplo, si una limpia los puntos y la otra no— la cuenta creada no puede iniciar sesión,
y por eso está cubierta por tests. La función deja pasar tal cual cualquier cosa que tenga
`@`, así siguen entrando las cuentas creadas a mano antes del cambio.

**Sobre autenticación y rutas**: el estado de sesión vive solo en `AuthProvider` y se lee
con `useAuth()`; ningún componente llama a `supabase.auth` por su cuenta. Las rutas se
declaran todas en `src/rutas.tsx` — no se definen rutas sueltas dentro de las pantallas — y
`RutaProtegida` decide qué mostrar según el rol. Eso es **solo UX**: la seguridad real son
las policies RLS y las funciones `SECURITY DEFINER` de la base, que no confían en el
navegador. No duplicar reglas de permisos en el cliente más allá de mostrar u ocultar UI.

**Sobre los formularios**: se arman con React Hook Form + Zod (`zodResolver`) sobre los
primitivos `Form` / `Field` / `Input`. El esquema de Zod vive en un archivo aparte junto a
su pantalla, y ahí también van las funciones que traducen los valores del formulario —todos
`string`— a los tipos que espera la capa de queries. Para leer un campo usar `useWatch`, no
`watch()`: el segundo devuelve una función que el React Compiler no puede memoizar y hace
que saltee la optimización del componente entero.

**Sobre el alta de palet**: va por la RPC `crear_palet_completo()`, nunca por dos inserts.
PostgREST no puede envolver dos requests HTTP en una transacción, así que insertar el palet
y su detalle por separado dejaría el palet incompleto si el segundo falla. La misma regla
aplica a cualquier operación futura que tenga que tocar dos tablas a la vez: se resuelve con
una función en la base, no encadenando llamadas desde el cliente.

**Sobre los transportistas**: el chofer se registra en **dos lugares distintos y no
intercambiables**. `palet.transportista_id` es **quién lo trajo** —dato del ingreso, no
cambia— y `movimiento.transportista_id` es **quién se lo llevó** en esa salida. Va en el
movimiento y no en el palet porque un palet sale de a partes, cada una en un camión
distinto: en el palet solo se podría guardar el último y se perderían los anteriores.

Los dos son **siempre opcionales**: trabar una carga por un dato que el operario no
siempre tiene a mano termina en movimientos sin registrar, que es peor que un movimiento
sin chofer. En los **ajustes no se guarda** aunque venga —lo descarta
`registrar_movimiento()`—: una rotura o un recuento que no cuadra no tuvieron ningún
camión, y anotar uno sería inventar una entrega. El chofer viaja también en la **cola
offline** (`MovimientoPendiente.transportistaId`); si se agrega otro dato al movimiento hay
que sumarlo ahí o se pierde en los que se sincronizan tarde.

Los 43 choferes y sus 9 empresas se importaron de la base de viajes que ya usa AIBAR. Como
los sectores, `transportista` y `empresa_transporte` son **tablas con nombre único sin
distinguir mayúsculas ni espacios**, no texto libre. Se dan de baja con `activo`, nunca
borrando: los palets que trajeron y los movimientos que hicieron los siguen nombrando.

**Sobre el alta en lote**: un lote de semilla no llega en un palet — llegan 10.000 kg del
mismo híbrido y el mismo batch repartidos en diez. `crear_palets_en_lote()` recibe el
**total** y en cuántos palets viene, y crea los N con su detalle en una sola transacción,
con un tope de 50. **El reparto lo hace la base**: trunca a dos decimales y le suma la
diferencia al último, para que la suma dé exactamente lo que entró —repartir 100 en 3 da
33,33 + 33,33 + 33,34, no 99,99 con un kilo evaporado—. `repartirEntrePalets()` en
`esquemaPalet.ts` **espeja ese cálculo** solo para mostrarlo antes de crear: si se cambia
uno hay que cambiar el otro, o la pantalla promete un número y la base guarda otro.

⚠️ **Los QR de un lote no se fotocopian.** Cada palet es una fila con su propio número y su
código apunta a él: diez palets con el mismo código serían diez bultos con una sola
identidad, sin poder ubicarlos ni descontarles stock por separado. Por eso existe
`LoteCreado`, que deja los N QR listos para imprimir uno atrás del otro. Esa pantalla
renderiza **un solo** QR en alta resolución por vez, el del palet que se está imprimiendo:
cincuenta canvas de 600×600 son cincuenta bitmaps en la memoria del celular del depósito.

**Sobre `src/types/database.ts`**: está escrito a mano pero con la misma forma que emite
`supabase gen types typescript`. Si el schema cambia, se actualiza este archivo — o se
reemplaza directamente por el generado por el CLI, sin tocar el resto del código. Los
tipos reflejan también los permisos, no solo las columnas: `movimiento` tiene
`Insert: never` porque el schema hace REVOKE, y `palet.Update` expone exactamente las
cinco columnas del `GRANT UPDATE`. Lo que la base prohíbe no compila.

⚠️ **Todo en ese archivo tiene que declararse con `type`, nunca con `interface`.**
supabase-js exige que `Database['public']` satisfaga su `GenericSchema`, que está definido
con índices `Record<string, …>`. TypeScript le da index signature implícita a los alias de
tipo pero no a las interfaces, así que basta con que una sola fila sea `interface` para que
el `Schema` del cliente colapse en silencio a `never` y toda llamada `.rpc()` con argumentos
deje de compilar, con un error que no señala la causa real.

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
- **No dar de baja un palet con un `UPDATE`.** El trigger `proteger_stock_palet()` bloquea
  cualquier cambio de `estado` que venga del cliente: la única vía es `dar_de_baja_palet()`,
  que además exige un motivo y lo deja en la bitácora.
- **No poner la `service_role` en el frontend, ni siquiera para "una cosita".** Esa clave
  saltea RLS por completo. Lo que la necesite va en una Edge Function.
- **No hacer `INSERT` directo sobre `movimiento`.** Es una tabla de solo lectura desde el cliente; todo movimiento se crea a través de las funciones RPC correspondientes.
- **No guardar contraseñas, tokens ni claves de Supabase (`service_role`) en el código del frontend.** Solo la `anon key` pública va en el cliente. Cualquier operación que requiera privilegios elevados se resuelve con una función `SECURITY DEFINER` en la base, no exponiendo una key privada.
- **No proponer bibliotecas de impresión distintas de `@mmote/niimbluelib`** sin verificar antes que sean compatibles con Web Bluetooth — ya se evaluó esta opción específicamente para este hardware. Ojo: **`niimblue` no es una librería**, es la aplicación web [NiimBlue](https://github.com/MultiMote/NiimBlue) del mismo autor; el paquete de npm es `@mmote/niimbluelib`. La única alternativa publicada, `niimbot-web-bluetooth`, se descartó porque su build no exporta nada.
- **No asumir que Web Bluetooth funciona en iOS/Safari.** Cualquier función de impresión debe degradar con un mensaje claro en vez de fallar en silencio si el navegador no soporta Web Bluetooth.
- **No tocar `src/lib/printer.ts` desde componentes.** Las pantallas usan `useImpresora()` y no saben qué es un GATT ni un print task. `@mmote/niimbluelib` está en alpha y su API puede cambiar: ese riesgo está contenido en ese único archivo, y ahí se queda.
- **No cambiar la ruta `/p/:id`.** Es la dirección que va impresa en los QR de las etiquetas, que son físicas y quedan pegadas al palet durante meses. Cambiarla invalida todas las etiquetas ya impresas.
- **No mezclar lógica de negocio (cálculo de stock, reglas de quién puede hacer qué) dentro de componentes de React.** Esa lógica ya vive en la base de datos; el frontend solo la invoca y muestra el resultado.