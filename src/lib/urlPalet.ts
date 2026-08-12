/**
 * URL que se codifica en el QR de cada palet.
 *
 * La etiqueta es física y permanente: un palet etiquetado hoy puede seguir en el
 * galpón dentro de un año. Por eso la dirección tiene que ser corta —menos
 * densidad de QR, más fácil de escanear con el celular— y estable, sin depender
 * de desde dónde se imprimió.
 */

/**
 * Dominio público de la app, tomado de `VITE_URL_PUBLICA`.
 *
 * Si no está configurada se cae al origen del navegador, que sirve para probar
 * pero **no para imprimir de verdad**: etiquetas generadas desde `localhost`
 * quedan inservibles apenas se sale de la computadora donde se imprimieron. Por
 * eso `urlPublicaConfigurada()` existe: la pantalla avisa antes de gastar papel.
 */
function baseUrl(): string {
  const configurada = import.meta.env.VITE_URL_PUBLICA?.trim()

  if (configurada !== undefined && configurada !== '') {
    // Sin barra final, para no terminar con `//p/152`.
    return configurada.replace(/\/+$/, '')
  }

  return typeof window !== 'undefined' ? window.location.origin : ''
}

/** Si el dominio público está definido de verdad y no es un origen local. */
export function urlPublicaConfigurada(): boolean {
  const configurada = import.meta.env.VITE_URL_PUBLICA?.trim()

  if (configurada === undefined || configurada === '') return false

  return !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(configurada)
}

/**
 * URL del palet para el QR: `https://dominio/p/152`.
 *
 * Es la ruta corta y pública a propósito. Se resuelve del lado de la app hacia
 * el detalle que corresponda, así la etiqueta no queda atada a la estructura
 * interna de rutas —que puede cambiar— sino a un identificador que no cambia.
 */
export function urlPalet(id: number): string {
  return `${baseUrl()}/p/${id}`
}

/**
 * Saca el número de palet de lo que devolvió el lector de QR.
 *
 * Devuelve `null` si el código no es de este sistema, que es un caso frecuente:
 * en un depósito hay códigos de barras de proveedores, QR de remitos y etiquetas
 * de otras empresas por todos lados, y el operario los va a apuntar sin querer.
 *
 * A propósito **no valida el dominio**: acepta cualquiera. Si mañana la app
 * cambia de dominio, las etiquetas viejas —que son físicas y no se pueden
 * reimprimir de a miles— tienen que seguir funcionando. El id se resuelve
 * después contra la base, que es la que dice si ese palet existe.
 */
export function extraerIdDePalet(textoEscaneado: string): number | null {
  const texto = textoEscaneado.trim()

  // Formatos aceptados: `…/p/152` (el impreso) y `…/palet/152` (la ruta interna,
  // por si alguien comparte el enlace desde la barra del navegador).
  const coincidencia = /\/(?:p|palet)\/(\d+)\/?$/.exec(texto)

  if (coincidencia === null) return null

  const id = Number(coincidencia[1])

  return Number.isSafeInteger(id) && id > 0 ? id : null
}
