import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  descargarComprobanteDeMovimientos,
  nombreDelArchivo,
  type PaletParaPdf,
} from '@/lib/pdfMovimientos'
import type { MovimientoConAutor, ObservacionConAutor } from '@/types'

/**
 * El comprobante es la única forma de sacar la trazabilidad de la app: se
 * imprime, se manda y se archiva. Si sale sin las observaciones o sin un
 * movimiento, nadie lo nota hasta que hace falta justificar un faltante.
 *
 * `jspdf` se reemplaza por un doble que junta todo lo que se le pidió escribir,
 * así se puede afirmar qué dice el PDF sin tener que leer un binario.
 */

const textos: string[] = []
const guardadoComo: string[] = []

vi.mock('jspdf', () => ({
  jsPDF: class {
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    line() {}
    addPage() {}
    /** El de verdad parte por ancho; acá alcanza con una línea por texto. */
    splitTextToSize(texto: string) {
      return [texto]
    }
    text(texto: string) {
      textos.push(texto)
    }
    save(nombre: string) {
      guardadoComo.push(nombre)
    }
  },
}))

const PALET: PaletParaPdf = {
  id: 152,
  producto: 'Glifosato 48%',
  lote: 'L-2026-0113',
  galpon: 1,
  sector: 'A7',
  unidad: 'bidón',
  cantidadInicial: 100,
  cantidadDisponible: 80,
  estado: 'parcial',
  empresa: 'Agro del Sur',
  transportista: 'Juan Pérez',
  fechaIngreso: '2026-08-01',
}

const MOVIMIENTOS: MovimientoConAutor[] = [
  {
    id: 2,
    palet_id: 152,
    tipo: 'venta',
    cantidad: 20,
    motivo: 'Pedido 4412',
    fecha_hora: '2026-08-12T14:35:00Z',
    usuario_id: 'u1',
    corrige_a: null,
    transportista_id: 7,
    usuario: { id: 'u1', nombre: 'Ana', rol: 'operario' },
    transportista: { id: 7, nombre: 'Diego Mateo' },
  },
  {
    id: 1,
    palet_id: 152,
    tipo: 'salida',
    cantidad: 5,
    motivo: null,
    fecha_hora: '2026-08-05T09:00:00Z',
    usuario_id: 'u2',
    corrige_a: null,
    transportista_id: null,
    usuario: { id: 'u2', nombre: 'Beto', rol: 'operario' },
    transportista: null,
  },
]

const OBSERVACIONES: ObservacionConAutor[] = [
  {
    id: 9,
    palet_id: 152,
    usuario_id: 'u1',
    texto: '2 bidones pinchados',
    created_at: '2026-08-06T10:00:00Z',
    usuario: { id: 'u1', nombre: 'Ana' },
  },
]

/** Todo el texto del PDF junto, para poder preguntarle si dice algo. */
function contenido(): string {
  return textos.join('\n')
}

beforeEach(() => {
  textos.length = 0
  guardadoComo.length = 0
})

describe('datos del palet', () => {
  it('identifica el palet y su empresa', async () => {
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: MOVIMIENTOS,
      observaciones: OBSERVACIONES,
    })

    expect(contenido()).toContain('Palet #152 — Glifosato 48%')
    expect(contenido()).toContain('L-2026-0113')
    expect(contenido()).toContain('Agro del Sur')
    // La fecha no se corre un día: `new Date('2026-08-01')` es UTC.
    expect(contenido()).toContain('01/08/2026')
  })

  it('dice que la mercadería es propia cuando no hay empresa', async () => {
    await descargarComprobanteDeMovimientos({
      palet: { ...PALET, empresa: null },
      movimientos: [],
      observaciones: [],
    })

    expect(contenido()).toContain('AIBAR S.R.L (mercadería propia)')
  })
})

describe('movimientos', () => {
  it('los incluye a todos con su signo', async () => {
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: MOVIMIENTOS,
      observaciones: OBSERVACIONES,
    })

    expect(contenido()).toContain('−20 bidón')
    expect(contenido()).toContain('−5 bidón')
    expect(contenido()).toContain('Ana')
    expect(contenido()).toContain('Pedido 4412')
  })

  it('los ordena del más viejo al más nuevo', async () => {
    // En pantalla van al revés, pero en papel se lee de arriba hacia abajo
    // siguiendo la historia del palet.
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: MOVIMIENTOS,
      observaciones: [],
    })

    const salidaVieja = textos.findIndex((texto) => texto.includes('−5'))
    const ventaNueva = textos.findIndex((texto) => texto.includes('−20'))

    expect(salidaVieja).toBeLessThan(ventaNueva)
  })

  it('la corrección suma en vez de restar', async () => {
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: [
        { ...MOVIMIENTOS[0], tipo: 'correccion', cantidad: 20, corrige_a: 1 },
      ],
      observaciones: [],
    })

    expect(contenido()).toContain('+20 bidón')
    expect(contenido()).toContain('Deshace el movimiento #1')
  })

  it('lo dice cuando no hubo ninguno, en vez de dejar la sección muda', async () => {
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: [],
      observaciones: [],
    })

    expect(contenido()).toContain('Sin movimientos registrados.')
  })
})

describe('observaciones', () => {
  it('van en el comprobante: son las que explican los descuentos', async () => {
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: MOVIMIENTOS,
      observaciones: OBSERVACIONES,
    })

    expect(contenido()).toContain('2 bidones pinchados')
  })

  it('lo dice cuando no hay ninguna', async () => {
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: [],
      observaciones: [],
    })

    expect(contenido()).toContain('Sin observaciones cargadas.')
  })
})

describe('el archivo', () => {
  it('se llama con el número de palet, para no tener que abrirlo', async () => {
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: [],
      observaciones: [],
    })

    expect(nombreDelArchivo(152)).toBe('palet-152-movimientos.pdf')
    expect(guardadoComo).toEqual(['palet-152-movimientos.pdf'])
  })
})

describe('los transportistas en el comprobante', () => {
  it('dice quién trajo el palet', async () => {
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: [],
      observaciones: [],
    })

    expect(contenido()).toContain('Lo trajo: Juan Pérez')
  })

  it('dice quién se llevó cada salida', async () => {
    await descargarComprobanteDeMovimientos({
      palet: PALET,
      movimientos: MOVIMIENTOS,
      observaciones: [],
    })

    expect(contenido()).toContain('Se la llevó: Diego Mateo')
  })

  it('no inventa un chofer donde no se registró ninguno', async () => {
    // El segundo movimiento del fixture no tiene: en el PDF no puede aparecer
    // una línea de entrega que nadie hizo.
    await descargarComprobanteDeMovimientos({
      palet: { ...PALET, transportista: null },
      movimientos: [MOVIMIENTOS[1]],
      observaciones: [],
    })

    expect(contenido()).toContain('Lo trajo: sin registrar')
    expect(contenido()).not.toContain('Se la llevó')
  })
})
