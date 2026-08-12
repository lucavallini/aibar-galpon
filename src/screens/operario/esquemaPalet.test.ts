import { describe, expect, it } from 'vitest'
import {
  aDatosNuevoPalet,
  esquemaPaletSegunCategoria,
  hoyISO,
  type FormularioPalet,
} from '@/screens/operario/esquemaPalet'

/**
 * Validación del alta de palet.
 *
 * Estas reglas son de UX —la que manda es la base— pero definen qué llega a
 * `crear_palet_completo()`. Un error acá es un palet mal cargado que después hay
 * que corregir contra la base, porque `cantidad_inicial` es inmutable.
 */

const VALIDO: FormularioPalet = {
  productoId: '1',
  lote: 'L-2026-0113',
  cantidadInicial: '120',
  galpon: '1',
  sector: '',
  fechaIngreso: '2026-08-12',
  fechaElaboracion: '',
  fechaVencimiento: '2027-01-01',
  hibrido: '',
  calibre: '',
  clienteId: '',
  observacion: '',
}

/** Ejecuta la validación y devuelve los mensajes por campo. */
function validar(valores: Partial<FormularioPalet>, categoria: 'agroquimico' | 'semilla' | null) {
  const resultado = esquemaPaletSegunCategoria(categoria).safeParse({
    ...VALIDO,
    ...valores,
  })

  if (resultado.success) return null

  return resultado.error.issues.map((i) => ({
    campo: i.path.join('.'),
    mensaje: i.message,
  }))
}

describe('cantidad inicial', () => {
  it('rechaza cero y negativos', () => {
    // La base tiene CHECK (cantidad_inicial > 0): sin esto el operario llena
    // todo el formulario para que se lo rechacen al final.
    expect(validar({ cantidadInicial: '0' }, 'agroquimico')).not.toBeNull()
    expect(validar({ cantidadInicial: '-5' }, 'agroquimico')).not.toBeNull()
  })

  it('rechaza más de dos decimales', () => {
    // NUMERIC(10,2): un tercer decimal se redondearía en silencio y el stock
    // quedaría distinto del que cargó el operario.
    expect(validar({ cantidadInicial: '10.123' }, 'agroquimico')).not.toBeNull()
    expect(validar({ cantidadInicial: '10.12' }, 'agroquimico')).toBeNull()
  })

  it('acepta coma decimal, que es lo que tipea el operario', () => {
    expect(validar({ cantidadInicial: '10,5' }, 'agroquimico')).toBeNull()
  })

  it('rechaza lo que no es un número', () => {
    expect(validar({ cantidadInicial: 'diez' }, 'agroquimico')).not.toBeNull()
  })

  it('rechaza lo que se pasa del tope de la columna', () => {
    expect(validar({ cantidadInicial: '999999999' }, 'agroquimico')).not.toBeNull()
  })
})

describe('campos obligatorios', () => {
  it('exige producto, lote y fecha de ingreso', () => {
    expect(validar({ productoId: '' }, 'agroquimico')).not.toBeNull()
    expect(validar({ lote: '' }, 'agroquimico')).not.toBeNull()
    expect(validar({ fechaIngreso: '' }, 'agroquimico')).not.toBeNull()
  })

  it('respeta el largo de las columnas', () => {
    expect(validar({ lote: 'x'.repeat(51) }, 'agroquimico')).not.toBeNull()
    expect(validar({ sector: 'x'.repeat(51) }, 'agroquimico')).not.toBeNull()
    expect(validar({ observacion: 'x'.repeat(501) }, 'agroquimico')).not.toBeNull()
  })
})

describe('reglas por categoría', () => {
  it('exige vencimiento en agroquímicos', () => {
    // Es un depósito de agroquímicos: sin vencimiento no se puede controlar el
    // stock vencido, que es la alerta principal del panel administrativo.
    const errores = validar({ fechaVencimiento: '' }, 'agroquimico')

    expect(errores?.some((e) => e.campo === 'fechaVencimiento')).toBe(true)
  })

  it('no lo exige en semillas', () => {
    expect(validar({ fechaVencimiento: '' }, 'semilla')).toBeNull()
  })

  it('rechaza un vencimiento anterior a la elaboración', () => {
    // Espeja el CHECK del schema, para avisar antes de mandar.
    const errores = validar(
      { fechaElaboracion: '2027-01-01', fechaVencimiento: '2026-01-01' },
      'agroquimico',
    )

    expect(errores?.some((e) => e.campo === 'fechaVencimiento')).toBe(true)
  })

  it('acepta que sean iguales', () => {
    expect(
      validar(
        { fechaElaboracion: '2026-08-12', fechaVencimiento: '2026-08-12' },
        'agroquimico',
      ),
    ).toBeNull()
  })
})

describe('traducción a lo que espera la base', () => {
  it('convierte los vacíos en null, no en cadenas vacías', () => {
    // La base distingue: '' pasaría el NOT NULL de sector y guardaría basura.
    const datos = aDatosNuevoPalet({ ...VALIDO, sector: '   ' }, 'agroquimico')

    expect(datos.sector).toBeNull()
  })

  it('manda null en los campos de la otra categoría', () => {
    const datos = aDatosNuevoPalet(
      { ...VALIDO, hibrido: 'DK 7210', calibre: 'M' },
      'agroquimico',
    )

    // El palet es agroquímico: los datos de semilla no corresponden aunque el
    // formulario los tuviera cargados de antes.
    expect(datos.hibrido).toBeNull()
    expect(datos.calibre).toBeNull()
    expect(datos.fechaVencimiento).toBe('2027-01-01')
  })

  it('descarta las fechas de agroquímico si el producto es semilla', () => {
    const datos = aDatosNuevoPalet(VALIDO, 'semilla')

    expect(datos.fechaVencimiento).toBeNull()
    expect(datos.fechaElaboracion).toBeNull()
  })

  it('normaliza la coma decimal a número', () => {
    const datos = aDatosNuevoPalet({ ...VALIDO, cantidadInicial: '10,5' }, 'semilla')

    expect(datos.cantidadInicial).toBe(10.5)
  })

  it('sin cliente elegido, la mercadería es de AIBAR', () => {
    expect(aDatosNuevoPalet(VALIDO, 'semilla').clienteId).toBeNull()
    expect(aDatosNuevoPalet({ ...VALIDO, clienteId: '7' }, 'semilla').clienteId).toBe(7)
  })

  it('convierte el galpón a número', () => {
    const datos = aDatosNuevoPalet({ ...VALIDO, galpon: '3' }, 'semilla')

    expect(datos.galpon).toBe(3)
  })
})

describe('hoyISO', () => {
  it('devuelve la fecha local, no la UTC', () => {
    // `toISOString()` pasa a UTC: a la tarde en Argentina la fecha se adelanta
    // un día y el palet quedaría ingresado mañana.
    const hoy = new Date()
    const esperado = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`

    expect(hoyISO()).toBe(esperado)
  })
})
