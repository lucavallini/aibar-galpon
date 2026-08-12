// Solo tipos: `import type` se borra al compilar, así que niimbluelib no entra
// al bundle por esta línea. Los valores se cargan con `import()` más abajo.
import type { NiimbotBluetoothClient, PrintTaskName } from '@mmote/niimbluelib'

/**
 * Impresión de etiquetas en la NIIMBOT M2-H por Web Bluetooth.
 *
 * Toda la conversación con la impresora vive acá: ni las pantallas ni los hooks
 * saben qué es un GATT, un print task ni un paquete de niimbluelib. Hacia
 * afuera esto expone cuatro operaciones —¿hay soporte?, conectar, imprimir,
 * desconectar— y errores ya redactados en castellano para el operario.
 *
 * ⚠️ `@mmote/niimbluelib` está en alpha (`0.0.1-alpha.42`). Es la librería que
 * mueve a NiimBlue, pero su API puede cambiar entre versiones. Ese riesgo está
 * acotado a este archivo a propósito: si la API cambia, se toca esto y nada más.
 */

// =========================================================
// Características de la impresora y de la etiqueta
// =========================================================

/**
 * NIIMBOT M2-H: 300 dpi y un cabezal de 567 px, o sea 48 mm imprimibles.
 * Los valores salen del catálogo de modelos de la propia librería.
 */
const PUNTOS_POR_MM = 300 / 25.4

/**
 * Redondea hacia abajo al múltiplo de 8 más cercano.
 *
 * El encoder de niimbluelib empaqueta 8 píxeles por byte y rechaza cualquier
 * imagen cuyo lado no sea múltiplo de 8 («Column count must be multiple of 8»).
 * Cuál de los dos lados valida depende del `printDirection` del modelo, así que
 * se ajustan los dos y el layout deja de depender de ese detalle.
 */
function aMultiploDe8(px: number): number {
  return Math.floor(px / 8) * 8
}

/**
 * Ancho imprimible, en píxeles.
 *
 * El cabezal de la M2-H son 567 px, pero se recorta a 560 —el múltiplo de 8
 * inmediato inferior— por el requisito del encoder. Son 0,6 mm menos de papel
 * aprovechado, que no se notan.
 */
const ANCHO_MAXIMO_PX = aMultiploDe8(567)

/**
 * Alto de la etiqueta, en milímetros.
 *
 * La cinta del depósito es de 50 × 30 mm. El ancho lo limita el cabezal —48 mm
 * imprimibles de los 50 del papel—; el alto es este.
 *
 * Es el número que gobierna todo el layout: con 30 mm no entra un QR grande con
 * el texto debajo, así que van uno al lado del otro. Si se cambia el rollo, hay
 * que rehacer las cuentas de `componerEtiqueta`.
 */
const ALTO_ETIQUETA_MM = 30

const ALTO_ETIQUETA_PX = aMultiploDe8(Math.round(ALTO_ETIQUETA_MM * PUNTOS_POR_MM))

/**
 * Margen interno.
 *
 * Ajustado a 1,5 mm para dejarle al QR todo el alto posible: en una etiqueta de
 * 30 mm, cada milímetro de margen es un milímetro menos de código.
 */
const MARGEN_PX = Math.round(1.5 * PUNTOS_POR_MM)

// =========================================================
// Errores
// =========================================================

/** Falla de impresión con un mensaje ya presentable al operario. */
export class ErrorImpresora extends Error {
  /** `true` si volver a intentar tiene sentido. */
  readonly reintentable: boolean

  constructor(mensaje: string, opciones: { reintentable?: boolean; cause?: unknown } = {}) {
    super(mensaje)
    this.name = 'ErrorImpresora'
    this.reintentable = opciones.reintentable ?? true
    this.cause = opciones.cause
  }
}

/**
 * Traduce lo que tira la librería o el navegador a algo que el operario entienda.
 *
 * No se le muestra el error técnico nunca: va al log.
 */
function traducirError(error: unknown, contexto: 'conexion' | 'impresion'): ErrorImpresora {
  console.error(`[impresora] fallo de ${contexto}`, error)

  const mensaje = error instanceof Error ? error.message : String(error)

  // El usuario cerró el diálogo de emparejamiento del navegador.
  if (mensaje.includes('User cancelled') || mensaje.includes('cancelled')) {
    return new ErrorImpresora(
      'Cancelaste la búsqueda de impresoras. Tocá "Conectar impresora" para intentar de nuevo.',
    )
  }

  if (mensaje.includes('No Services matching') || mensaje.includes('not found')) {
    return new ErrorImpresora(
      'No se encontró la impresora. Fijate que esté encendida y cerca del celular.',
    )
  }

  if (mensaje.includes('GATT') || mensaje.includes('disconnect')) {
    return new ErrorImpresora(
      'Se perdió la conexión con la impresora. Encendela de nuevo y volvé a conectar.',
    )
  }

  if (mensaje.includes('timeout') || mensaje.includes('Timeout')) {
    return new ErrorImpresora(
      'La impresora no respondió a tiempo. Fijate que tenga batería y papel cargado.',
    )
  }

  return contexto === 'conexion'
    ? new ErrorImpresora('No se pudo conectar con la impresora. Probá de nuevo.')
    : new ErrorImpresora('No se pudo imprimir la etiqueta. Probá de nuevo.')
}

// =========================================================
// Soporte del navegador
// =========================================================

/**
 * Si este navegador puede hablar Bluetooth.
 *
 * Da `false` en iOS y en Safari, que no implementan Web Bluetooth y no tienen
 * previsto hacerlo. No es un problema que se pueda sortear desde el código: hay
 * que ofrecerle otra salida al operario, nunca fallar en silencio.
 */
export function soportaWebBluetooth(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

/**
 * Por qué no hay soporte, para poder explicarlo con precisión.
 *
 * Los tres motivos por los que `navigator.bluetooth` puede faltar son muy
 * distintos entre sí y tienen soluciones distintas, así que no alcanza con un
 * mensaje genérico: hay que decirle a cada quien qué hacer.
 */
export function motivoSinSoporte(): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'La impresión por Bluetooth necesita que la página esté en HTTPS. Abrila desde el dominio publicado, o desde localhost si estás probando.'
  }

  const agente = typeof navigator !== 'undefined' ? navigator.userAgent : ''

  // iOS no implementa Web Bluetooth y no está previsto que lo haga. Safari
  // tampoco, en ninguna plataforma. Ojo: en iPhone todos los navegadores usan
  // el motor de Safari, así que instalar Chrome ahí no cambia nada.
  if (/iPhone|iPad|iPod/.test(agente)) {
    return 'Desde iPhone o iPad no se puede imprimir: iOS no permite que el navegador use Bluetooth, ni siquiera con Chrome instalado. Usá un teléfono Android con Chrome, o descargá el QR para imprimirlo por otro medio.'
  }

  // En Linux, Chrome trae Web Bluetooth apagado: su implementación sobre BlueZ
  // sigue marcada como experimental. En Android, Windows y macOS viene activa.
  if (/Linux/.test(agente) && !/Android/.test(agente)) {
    return 'En Linux, Chrome trae Web Bluetooth desactivado por defecto. Para habilitarlo entrá a chrome://flags/#enable-experimental-web-platform-features, ponelo en "Enabled" y reiniciá el navegador.'
  }

  return 'Este navegador no puede conectarse por Bluetooth. Para imprimir, abrí la app con Chrome o Edge: en Android funciona directo. Desde un iPhone o iPad no es posible.'
}

// =========================================================
// Cliente
// =========================================================

/**
 * Cliente único.
 *
 * La conexión sobrevive a la navegación entre pantallas: el operario empareja
 * una vez y sigue imprimiendo etiqueta tras etiqueta sin volver a hacerlo.
 */
let cliente: NiimbotBluetoothClient | null = null

/**
 * Carga niimbluelib recién cuando hace falta.
 *
 * Son unos 140 kB que solo necesita quien va a imprimir, en un navegador que
 * además soporte Bluetooth. Con la señal que hay en el depósito, no conviene
 * hacérselos descargar a todo el mundo al abrir la app.
 */
async function cargarLibreria() {
  return await import('@mmote/niimbluelib')
}

/** A quién avisarle cuando la impresora se cae por su cuenta. */
const oyentesDeDesconexion = new Set<() => void>()

/**
 * Avisa cuando se pierde la conexión sin que la app la haya cortado: la
 * impresora se apagó, se quedó sin batería o se fue de rango.
 *
 * Sin esto la pantalla seguiría mostrando «Conectada» sobre una conexión muerta,
 * y el operario se enteraría recién al fallarle una impresión.
 *
 * @returns función para dejar de escuchar.
 */
export function alDesconectarse(callback: () => void): () => void {
  oyentesDeDesconexion.add(callback)

  return () => {
    oyentesDeDesconexion.delete(callback)
  }
}

async function obtenerCliente(): Promise<NiimbotBluetoothClient> {
  if (cliente === null) {
    const { NiimbotBluetoothClient } = await cargarLibreria()
    const nuevo = new NiimbotBluetoothClient()

    // La librería emite esto desde el listener de `gattserverdisconnected`, así
    // que cubre tanto la desconexión pedida como la inesperada.
    nuevo.on('disconnect', () => {
      for (const oyente of oyentesDeDesconexion) oyente()
    })

    cliente = nuevo
  }

  return cliente
}

/** Si hay una impresora emparejada y viva en este momento. */
export function estaConectada(): boolean {
  return cliente?.isConnected() ?? false
}

/** Modelo que reportó la impresora al conectarse, para mostrarlo en pantalla. */
export function modeloConectado(): string | null {
  if (cliente === null || !cliente.isConnected()) return null

  return cliente.getModelMetadata()?.model ?? 'Impresora NIIMBOT'
}

/**
 * Abre el diálogo de emparejamiento del navegador y se conecta.
 *
 * Tiene que llamarse desde un gesto del usuario —un click—, porque el navegador
 * no deja abrir el selector de dispositivos de otra forma.
 *
 * @throws {ErrorImpresora} con el motivo en castellano.
 */
export async function conectarImpresora(): Promise<void> {
  if (!soportaWebBluetooth()) {
    throw new ErrorImpresora(motivoSinSoporte(), { reintentable: false })
  }

  try {
    const c = await obtenerCliente()

    // `connect()` ya hace por dentro la negociación inicial y el
    // `fetchPrinterInfo()`, y tolera que ese último falle. Volver a pedirlo
    // desde acá no agrega nada y sí rompe: si el GATT se cayó entre medio,
    // convierte un dato opcional —el modelo, que solo se muestra en pantalla—
    // en un fallo de conexión completo.
    await c.connect()
  } catch (error: unknown) {
    // Un intento fallido puede dejar el cliente en un estado raro; se descarta
    // para que el próximo arranque limpio, con sus listeners de cero.
    cliente = null
    throw traducirError(error, 'conexion')
  }
}

/** Corta la conexión. No falla si ya estaba desconectada. */
export async function desconectarImpresora(): Promise<void> {
  if (cliente === null) return

  try {
    await cliente.disconnect()
  } catch (error: unknown) {
    console.error('[impresora] fallo al desconectar', error)
  } finally {
    cliente = null
  }
}

// =========================================================
// Composición de la etiqueta
// =========================================================

/** Lo que va impreso en la etiqueta de un palet. */
export interface DatosEtiqueta {
  /** El QR ya dibujado. Lo genera la pantalla con `qrcode.react`. */
  qr: HTMLCanvasElement
  /** Número de palet, el dato más buscado de lejos. */
  id: number
  producto: string
  lote: string
  /** Cantidad con su unidad, ya formateada. Ej. `120 litro`. */
  cantidad: string
}

/**
 * El QR ocupa todo el alto útil de la etiqueta.
 *
 * Se probó poner también lote y producto al costado, pero con 30 mm de papel al
 * texto le quedaban 16 mm de ancho y un lote como «L-2026-0113» se cortaba al
 * medio: un dato truncado no sirve para identificar nada y encima le robaba
 * tamaño al código. Ahora el QR es lo más grande que permite el papel.
 */
const LADO_QR_PX = ALTO_ETIQUETA_PX - MARGEN_PX * 2

/**
 * Ajusta el cuerpo de la tipografía para que el texto entre en el ancho dado.
 *
 * Evita el recorte por completo: en lugar de cortar el número de palet, lo
 * dibuja más chico. Con ids de tres o cuatro dígitos el ajuste casi nunca se
 * activa, pero el día que el depósito llegue al palet 10.000 la etiqueta sigue
 * saliendo bien.
 */
function cuerpoQueEntra(
  ctx: CanvasRenderingContext2D,
  texto: string,
  anchoMaximo: number,
  cuerpoIdeal: number,
): number {
  let cuerpo = cuerpoIdeal

  while (cuerpo > 12) {
    ctx.font = `bold ${Math.round(cuerpo)}px sans-serif`

    if (ctx.measureText(texto).width <= anchoMaximo) break

    cuerpo -= 4
  }

  return Math.round(cuerpo)
}

/**
 * Dibuja la etiqueta completa en un canvas en blanco y negro.
 *
 * **QR lo más grande que permita el papel, y el número de palet al lado.** El
 * lote y el producto quedaron afuera: con 30 mm de alto no entraban completos, y
 * un lote cortado a la mitad no identifica nada mientras le come tamaño al
 * código.
 *
 * El número sí se queda, y no es un adorno: es el seguro contra una etiqueta
 * arruinada. En un depósito las etiquetas se rayan, se mojan y se despegan a
 * medias; si el QR deja de leerse y no hay ningún dato impreso, ese palet no se
 * puede identificar ni buscar en el sistema. Tres dígitos nunca se cortan.
 *
 * Se exporta para poder mirar la etiqueta en pantalla antes de gastar papel.
 */
export function componerEtiqueta(datos: DatosEtiqueta): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = ANCHO_MAXIMO_PX
  canvas.height = ALTO_ETIQUETA_PX

  const ctx = canvas.getContext('2d')

  if (ctx === null) {
    throw new ErrorImpresora('El navegador no pudo preparar la etiqueta.', {
      reintentable: false,
    })
  }

  // La impresora es térmica: todo lo que no sea blanco, sale negro.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'

  // --- QR: todo el alto disponible, pegado a la izquierda ---
  ctx.drawImage(datos.qr, MARGEN_PX, MARGEN_PX, LADO_QR_PX, LADO_QR_PX)

  // --- Número de palet, parado en la franja que sobra ---
  //
  // Girado 90°, el número se escribe a lo largo de los 30 mm de alto en vez de
  // los 16 de ancho que quedan al costado del QR: casi el doble de espacio, y
  // por lo tanto casi el doble de tamaño para el dato que se lee de lejos.
  const xNumero = MARGEN_PX * 2 + LADO_QR_PX
  const anchoFranja = ANCHO_MAXIMO_PX - xNumero - MARGEN_PX
  const texto = `#${datos.id}`

  // Al estar girado, el texto se extiende sobre el alto de la etiqueta y su
  // cuerpo se limita con el ancho de la franja. Los dos ejes se intercambian.
  const largoDisponible = ALTO_ETIQUETA_PX - MARGEN_PX * 2
  const cuerpo = Math.min(
    cuerpoQueEntra(ctx, texto, largoDisponible, 14 * PUNTOS_POR_MM),
    anchoFranja,
  )

  ctx.save()
  // El origen pasa al centro de la franja, y desde ahí se gira: así el texto
  // queda centrado en los dos ejes sin tener que calcular su caja.
  ctx.translate(xNumero + anchoFranja / 2, ALTO_ETIQUETA_PX / 2)
  // −90° deja el número legible de abajo hacia arriba, que es como se lee un
  // texto vertical cuando la etiqueta está pegada al palet.
  ctx.rotate(-Math.PI / 2)

  ctx.font = `bold ${cuerpo}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(texto, 0, 0)

  ctx.restore()

  return canvas
}

// =========================================================
// Impresión
// =========================================================

/**
 * Valores por omisión para la M2-H, que se usan si la impresora no llegó a
 * informar sus capacidades.
 *
 * `connect()` intenta leerlas pero tolera no conseguirlas, así que hay que tener
 * un plan B razonable en vez de uno genérico: con la dirección equivocada la
 * etiqueta sale rotada.
 */
const TAREA_POR_OMISION: PrintTaskName = 'B1'
const DIRECCION_POR_OMISION = 'top' as const
const DENSIDAD_POR_OMISION = 3

/**
 * Imprime una etiqueta.
 *
 * Requiere haber llamado antes a `conectarImpresora()`.
 *
 * @throws {ErrorImpresora} con el motivo en castellano.
 */
export async function imprimirEtiqueta(datos: DatosEtiqueta): Promise<void> {
  const c = cliente

  if (c === null || !c.isConnected()) {
    throw new ErrorImpresora('La impresora no está conectada.', { reintentable: false })
  }

  const etiqueta = componerEtiqueta(datos)
  const modelo = c.getModelMetadata()

  try {
    // Ya está en caché: para llegar acá hubo que conectarse primero.
    const { ImageEncoder, LabelType } = await cargarLibreria()

    const imagen = ImageEncoder.encodeCanvas(
      etiqueta,
      modelo?.printDirection ?? DIRECCION_POR_OMISION,
    )

    // Si la impresora es una que la librería conoce, usa su algoritmo; si no,
    // el de la B1, que es el que corresponde a la familia M2-H.
    const tarea = c.getPrintTaskType() ?? TAREA_POR_OMISION

    const trabajo = c.abstraction.newPrintTask(tarea, {
      totalPages: 1,
      labelType: LabelType.WithGaps,
      density: modelo?.densityDefault ?? DENSIDAD_POR_OMISION,
    })

    try {
      await trabajo.printInit()
      await trabajo.printPage(imagen, 1)
      await trabajo.waitForFinished()
    } finally {
      // Cierra el trabajo pase lo que pase: si no, la impresora queda esperando
      // y el siguiente intento falla sin motivo aparente.
      await c.abstraction.printEnd()
    }
  } catch (error: unknown) {
    throw traducirError(error, 'impresion')
  }
}
