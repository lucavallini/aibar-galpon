# AIBAR — Trazabilidad de palets

PWA para el depósito de AIBAR S.R.L. Los operarios dan de alta palets de agroquímicos y
semillas, imprimen su etiqueta con QR desde el celular, y registran los movimientos de stock
escaneándola. La administración consulta el estado del depósito en un panel de solo lectura.

No hay servidor propio: el backend es Supabase (Postgres + Auth + API REST/RPC), y **las
reglas de negocio viven en la base**, no en el frontend.

---

## Puesta en marcha

Hace falta **Node 20 o superior**.

```bash
npm install
cp .env.example .env    # y completar los valores
npm run dev             # http://localhost:5173
```

### Variables de entorno

Todas van en `.env`, que no se versiona. `.env.example` tiene la plantilla.

| Variable | Para qué sirve | Obligatoria |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase | Sí — la app no arranca sin ella |
| `VITE_SUPABASE_ANON_KEY` | Clave pública `anon` | Sí — la app no arranca sin ella |
| `VITE_URL_PUBLICA` | Dominio donde queda publicada la app | Para imprimir etiquetas |

> ⚠️ **Solo la clave `anon`.** Es pública por diseño y viaja al navegador; lo que protege los
> datos son las policies RLS. La `service_role` **nunca** va en el frontend.

> ⚠️ `VITE_URL_PUBLICA` es lo que se codifica en el QR de cada etiqueta. Si queda apuntando a
> `localhost`, los QR impresos no funcionan fuera de esa computadora. La app avisa en pantalla
> cuando detecta que no está configurada.

### Comandos

```bash
npm run dev            # servidor de desarrollo
npm run build          # compila a dist/ (corre tsc antes)
npm run preview        # sirve el build local
npm run lint           # ESLint
npm run test           # tests una vez
npm run test:watch     # tests en modo watch
npm run test:coverage  # tests con reporte de cobertura
```

---

## Base de datos

El schema base está en `aibar_schema_completo.sql`. Todo cambio posterior es una migración
versionada en `supabase/migrations/`, y **se aplican en orden de nombre**:

| Migración | Qué hace |
|---|---|
| `20260811120000_crear_palet_completo` | RPC que crea palet + detalle en una transacción |
| `20260812150000_usuarios_visibles_entre_si` | Permite ver quién registró cada movimiento |
| `20260812180000_producto_nombre_unico` | **Opcional**: impide productos duplicados |
| `20260812200000_vistas_gerencia` | Vistas del panel administrativo |
| `20260812210000_clientes_y_observaciones` | Clientes y bitácora de palets |
| `20260812230000_observaciones_en_panel` | Última observación visible en el panel |
| `20260813100000_baja_producto_y_usuarios` | Baja de palet, producto ampliado, roles administrables |

Se aplican pegándolas en el **SQL Editor** de Supabase. Son idempotentes: si una falla a mitad,
se corrige y se vuelve a correr sin quedar en un estado raro.

### Usuarios y roles

Los usuarios los da de alta **el gerente**, desde **Panel administrativo → Usuarios**. El
registro público está cerrado a propósito: sin control, cualquiera podría crear cuentas y
llenar la base.

Eso requiere desplegar una vez la Edge Function que hace el alta:

```bash
supabase login
supabase link --project-ref TU-PROJECT-REF
supabase functions deploy crear-usuario
```

No hace falta configurar secretos: Supabase le inyecta sola la `service_role`, que **nunca**
sale del servidor. La función verifica que quien llama sea un jefe activo antes de crear nada.

**El primer gerente hay que crearlo a mano**, porque todavía no hay ninguno que pueda hacerlo:
creá el usuario en **Authentication → Users** y después corré

```sql
UPDATE public.usuario SET rol = 'jefe' WHERE id = 'UUID-DEL-USUARIO';
```

Desde ahí, el resto se administra desde la app: cambiar roles y quitar el acceso a quien dejó
de trabajar en el depósito. **Quitar el acceso no borra al usuario**: sus movimientos siguen
figurando a su nombre en el historial.

### Datos mínimos para empezar

Sin productos cargados no se puede dar de alta ningún palet. Se pueden cargar desde la app
(**Inicio → Agregar producto**) o por SQL:

```sql
INSERT INTO public.producto (nombre, categoria, unidad_medida) VALUES
    ('Glifosato 48%',  'agroquimico', 'litro'),
    ('Maíz DK 7210',   'semilla',     'bolsa');
```

---

## Despliegue

La app está publicada en **Netlify**, y `netlify.toml` ya trae la configuración: build,
directorio de salida y —clave— la redirección de SPA. Sin esa redirección, entrar directo a
`/p/152` (lo que hace escanear un QR) devolvería 404.

1. Conectar el repositorio en Netlify. Toma `netlify.toml` solo.
2. Cargar las tres variables de entorno en **Site settings → Environment variables**. El
   `.env` local no se sube: si faltan, el build sale pero la app no arranca.
3. Desplegar.

> Para desplegar en Vercel en vez de Netlify hay que replicar la redirección de SPA en un
> `vercel.json`; el resto de la configuración es equivalente.

---

## Impresora: primer emparejamiento

La etiqueta se imprime en una **NIIMBOT M2-H** por Web Bluetooth, sin apps intermedias.

### Requisitos

- **Chrome o Edge.** En Android funciona directo.
- **HTTPS o localhost.** Web Bluetooth no funciona sobre HTTP.
- **No funciona en iPhone ni iPad.** iOS no permite Bluetooth desde el navegador, ni siquiera
  con Chrome instalado — todos los navegadores en iOS usan el motor de Safari. La app lo
  detecta y ofrece descargar el QR para imprimirlo por otro medio.
- **En Linux de escritorio**, Chrome trae Web Bluetooth apagado. Se habilita en
  `chrome://flags/#enable-experimental-web-platform-features` y reiniciando el navegador.

### Pasos

1. Encender la impresora y cargarle cinta de **50 × 30 mm**.
2. **Desconectarla de la app oficial de NIIMBOT** si estaba emparejada ahí. Si otro
   dispositivo la tiene tomada, no aparece en el selector de Chrome.
3. En la app, abrir un palet y tocar **«Imprimir etiqueta»**.
4. Chrome abre su propio selector de dispositivos: elegir la impresora y confirmar.
5. Sale la etiqueta. El emparejamiento queda vivo mientras no se cierre la app, así que las
   siguientes salen sin volver a elegir nada.

Si el selector se abre vacío: revisar que la impresora esté encendida, cerca, y que ningún
otro equipo la tenga conectada.

### Probar la impresión sin datos cargados

En desarrollo hay un banco de pruebas en **`/ui` → «Impresión de etiquetas»**. Permite ver una
vista previa exacta de la etiqueta y mandar una de prueba, sin necesidad de tener productos ni
palets. Conviene usar la vista previa antes de gastar cinta.

---

## Cómo está organizado

```
src/
├── lib/queries/    ÚNICA capa que habla con supabase-js
├── types/          Espejo tipado del schema
├── auth/           Sesión y rol
├── offline/        Cola de pendientes y sincronización (IndexedDB)
├── hooks/          React Query sobre las queries
├── components/ui/  Primitivos presentacionales
├── screens/        Pantallas, por rol
└── rutas.tsx       Todas las rutas, en un solo archivo
```

Las convenciones, las decisiones de diseño y —sobre todo— **lo que no hay que hacer** están
en `CLAUDE.md`. Conviene leerlo antes de tocar el código.

Tres reglas que se rompen fácil sin querer:

- **El stock solo se mueve por RPC.** Nunca un `UPDATE` sobre `palet.cantidad_disponible` ni
  un `INSERT` en `movimiento`: están bloqueados por permisos y triggers, y los tipos lo
  vuelven un error de compilación.
- **Nada de `localStorage`.** Todo el almacenamiento local va por IndexedDB.
- **Los mensajes de error de la base se muestran tal cual.** Están escritos para el operario.
