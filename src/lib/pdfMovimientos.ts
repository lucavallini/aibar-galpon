import type { MovimientoConAutor, ObservacionConAutor } from '@/types'

/**
 * Comprobante en PDF de todo lo que le pasó a un palet.
 *
 * Es la única forma de sacar la trazabilidad de la app: se manda por mail, se
 * imprime y se archiva. Por eso incluye las observaciones además de los
 * movimientos —una rotura o un faltante explican un descuento que si no queda
 * sin justificar— y por eso lleva impresa la fecha en que se generó.
 *
 * `jspdf` se carga con `import()` dinámico y no arriba del archivo: pesa más de
 * 100 kB y solo hace falta cuando alguien aprieta el botón, igual que el lector
 * de QR. Al arranque de la app no le cuesta nada.
 */

/** Lo que el PDF necesita saber del palet, venga de donde venga. */
export interface PaletParaPdf {
  id: number
  producto: string
  lote: string
  galpon: number
  /** `null` = sin ubicar. */
  sector: string | null
  unidad: string
  cantidadInicial: number
  cantidadDisponible: number
  estado: string
  /** `null` = mercadería propia de AIBAR. */
  empresa: string | null
  /** Quién trajo el palet. `null` si no se registró. */
  transportista: string | null
  /** `YYYY-MM-DD`. */
  fechaIngreso: string
}

export interface DatosDelComprobante {
  palet: PaletParaPdf
  movimientos: MovimientoConAutor[]
  observaciones: ObservacionConAutor[]
}

/** Márgenes y medidas de la hoja A4, en milímetros. */
const MARGEN = 15
const ANCHO_HOJA = 210
const ALTO_HOJA = 297
const ANCHO_UTIL = ANCHO_HOJA - MARGEN * 2

/** `12/08/2026` a partir de un `YYYY-MM-DD`, sin pasar por `Date`. */
function formatearFecha(iso: string | null): string {
  if (iso === null) return '—'

  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)

  // `new Date('2026-08-12')` se lee como UTC y en Argentina imprime el día
  // anterior. Partida en tres, la fecha no se puede correr.
  return partes === null ? iso : `${partes[3]}/${partes[2]}/${partes[1]}`
}

/** `12/08/2026 14:35` a partir de un timestamptz. */
function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso)

  if (Number.isNaN(fecha.getTime())) return iso

  return fecha.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const ETIQUETA_TIPO: Record<string, string> = {
  venta: 'Venta',
  salida: 'Salida',
  ajuste: 'Ajuste',
  correccion: 'Corrección',
}

/** El signo con el que el movimiento afecta al stock. */
function firmar(tipo: string, cantidad: number): string {
  return `${tipo === 'correccion' ? '+' : '−'}${cantidad}`
}

/** Nombre del archivo: identifica el palet sin tener que abrirlo. */
export function nombreDelArchivo(paletId: number): string {
  return `palet-${paletId}-movimientos.pdf`
}

/**
 * Arma el PDF y lo baja.
 *
 * @throws si `jspdf` no se puede cargar —sin señal, por ejemplo—. Quien llama
 * tiene que mostrar el error: si falla en silencio, el operario aprieta el botón
 * y no pasa nada.
 */
export async function descargarComprobanteDeMovimientos({
  palet,
  movimientos,
  observaciones,
}: DatosDelComprobante): Promise<void> {
  const { jsPDF } = await import('jspdf')

  const documento = new jsPDF({ unit: 'mm', format: 'a4' })

  /** Dónde va a escribirse la próxima línea. */
  let y = MARGEN

  /** Salta de hoja antes de escribir algo que no entra en lo que queda. */
  function reservar(alto: number): void {
    if (y + alto <= ALTO_HOJA - MARGEN) return

    documento.addPage()
    y = MARGEN
  }

  function titulo(texto: string, tamaño: number): void {
    documento.setFont('helvetica', 'bold')
    documento.setFontSize(tamaño)
    documento.text(texto, MARGEN, y)
    y += tamaño * 0.5
  }

  function linea(texto: string, opciones: { negrita?: boolean; sangria?: number } = {}): void {
    documento.setFont('helvetica', opciones.negrita === true ? 'bold' : 'normal')
    documento.setFontSize(10)

    const x = MARGEN + (opciones.sangria ?? 0)

    // Un motivo largo desborda la hoja: se parte en varias líneas antes de
    // escribirlo, y cada una cuenta para el salto de página.
    for (const parte of documento.splitTextToSize(texto, ANCHO_UTIL - (opciones.sangria ?? 0))) {
      reservar(5)
      documento.text(parte, x, y)
      y += 5
    }
  }

  function separador(): void {
    reservar(4)
    documento.setDrawColor(200)
    documento.line(MARGEN, y, ANCHO_HOJA - MARGEN, y)
    y += 4
  }

  // ----- Encabezado -----
  titulo(`Palet #${palet.id} — ${palet.producto}`, 16)
  y += 2

  documento.setFont('helvetica', 'normal')
  documento.setFontSize(9)
  documento.setTextColor(110)
  documento.text(
    `AIBAR S.R.L · Comprobante generado el ${formatearFechaHora(new Date().toISOString())}`,
    MARGEN,
    y,
  )
  documento.setTextColor(0)
  y += 8

  // ----- Datos del palet -----
  linea(`Lote: ${palet.lote}`)
  linea(`Ubicación: Galpón ${palet.galpon}${palet.sector === null ? ' · sin ubicar' : ` · ${palet.sector}`}`)
  linea(`Empresa: ${palet.empresa ?? 'AIBAR S.R.L (mercadería propia)'}`)
  linea(`Ingreso: ${formatearFecha(palet.fechaIngreso)}`)
  linea(`Lo trajo: ${palet.transportista ?? 'sin registrar'}`)
  linea(`Estado: ${palet.estado}`)
  linea(
    `Cantidad inicial: ${palet.cantidadInicial} ${palet.unidad} · Disponible: ${palet.cantidadDisponible} ${palet.unidad}`,
    { negrita: true },
  )

  y += 4
  separador()

  // ----- Movimientos -----
  reservar(12)
  titulo('Movimientos', 13)
  y += 2

  if (movimientos.length === 0) {
    linea('Sin movimientos registrados.')
  } else {
    // Del más viejo al más nuevo: en papel se lee de arriba hacia abajo
    // siguiendo la historia, al revés que en pantalla.
    const enOrden = [...movimientos].sort((uno, otro) =>
      uno.fecha_hora.localeCompare(otro.fecha_hora),
    )

    for (const movimiento of enOrden) {
      reservar(10)

      linea(
        `${formatearFechaHora(movimiento.fecha_hora)}  ·  ${ETIQUETA_TIPO[movimiento.tipo] ?? movimiento.tipo}  ·  ${firmar(movimiento.tipo, movimiento.cantidad)} ${palet.unidad}`,
        { negrita: true },
      )

      linea(`Registró: ${movimiento.usuario?.nombre ?? 'usuario no disponible'}`, {
        sangria: 4,
      })

      // Solo en las salidas: en un ajuste no hubo ningún camión.
      if (movimiento.transportista != null) {
        linea(`Se la llevó: ${movimiento.transportista.nombre}`, { sangria: 4 })
      }

      if (movimiento.corrige_a !== null) {
        linea(`Deshace el movimiento #${movimiento.corrige_a}`, { sangria: 4 })
      }

      if (movimiento.motivo !== null) {
        linea(`Motivo: ${movimiento.motivo}`, { sangria: 4 })
      }

      y += 2
    }
  }

  y += 2
  separador()

  // ----- Observaciones -----
  reservar(12)
  titulo('Observaciones', 13)
  y += 2

  if (observaciones.length === 0) {
    linea('Sin observaciones cargadas.')
  } else {
    for (const observacion of observaciones) {
      reservar(10)

      linea(
        `${formatearFechaHora(observacion.created_at)}  ·  ${observacion.usuario?.nombre ?? 'usuario no disponible'}`,
        { negrita: true },
      )
      linea(observacion.texto, { sangria: 4 })

      y += 2
    }
  }

  documento.save(nombreDelArchivo(palet.id))
}
