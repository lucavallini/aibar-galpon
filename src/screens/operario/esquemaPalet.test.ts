import { describe, expect, it } from 'vitest'
import {
  aDatosNuevoLote,
  aDatosNuevoPalet,
  esquemaPaletSegunCategoria,
  esUnSoloPalet,
  hoyISO,
  repartirEntrePalets,
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
  categoria: 'agroquimico',
  productoId: '1',
  lote: 'L-2026-0113',
  cantidadInicial: '120',
  unidadMedida: 'bidón',
  // Un palet solo: el reparto en lote tiene sus propios casos más abajo.
  cantidadPalets: '1',
  galpon: '1',
  // Obligatorio desde que un sector admite un solo palet a la vez.
  sectorId: '7',
  fechaIngreso: '2026-08-12',
  fechaElaboracion: '',
  fechaVencimiento: '2027-01-01',
  hibrido: '',
  calibre: '',
  clienteId: '',
  observacion: '',
}

/**
 * Una semilla como llega del formulario: el producto es el cultivo y el híbrido
 * dice qué variedad vino en esta partida.
 */
const SEMILLA: Partial<FormularioPalet> = {
  hibrido: 'DK 7210',
  unidadMedida: 'bolsa',
}

/** Ejecuta la validación y devuelve los mensajes por campo. */
function validar(valores: Partial<FormularioPalet>, categoria: 'agroquimico' | 'semilla' | null) {
  const resultado = esquemaPaletSegunCategoria(categoria).safeParse({
    ...VALIDO,
    ...(categoria === 'semilla' ? SEMILLA : {}),
    // El tipo elegido en el formulario y el que valida son el mismo: el
    // formulario cambia de campos según el tipo.
    categoria: categoria ?? 'agroquimico',
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
    expect(validar({ observacion: 'x'.repeat(501) }, 'agroquimico')).not.toBeNull()
  })
})

describe('el tipo recorta el catálogo', () => {
  it('es obligatorio elegirlo', () => {
    const resultado = esquemaPaletSegunCategoria('agroquimico').safeParse({
      ...VALIDO,
      categoria: undefined,
    })

    expect(resultado.success).toBe(false)
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

  it('exige el híbrido en semillas', () => {
    // Es lo que identifica a la variedad y con lo que la base resuelve o crea
    // el producto: sin híbrido el palet no tiene a qué asociarse.
    const errores = validar({ hibrido: '' }, 'semilla')

    expect(errores?.some((e) => e.campo === 'hibrido')).toBe(true)
  })

  it('pide el producto en las dos categorías', () => {
    // Es lo que dice qué cosa es: un agroquímico del catálogo, o el cultivo de
    // la semilla. Sin él el palet no se puede sumar a ningún stock.
    for (const categoria of ['agroquimico', 'semilla'] as const) {
      const errores = validar({ productoId: '' }, categoria)

      expect(errores?.some((e) => e.campo === 'productoId')).toBe(true)
    }
  })

  it('rechaza una unidad que no está en la lista', () => {
    // Texto libre traía «kg», «Kg» y «kilos» conviviendo como tres unidades
    // distintas, y el stock de un producto quedaba partido en tres líneas.
    const resultado = esquemaPaletSegunCategoria('agroquimico').safeParse({
      ...VALIDO,
      unidadMedida: 'kg',
    })

    expect(resultado.success).toBe(false)
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
    // La base distingue: '' se guardaría como una observación en blanco.
    const datos = aDatosNuevoPalet({ ...VALIDO, observacion: '   ' }, 'agroquimico')

    expect(datos.observacion).toBeNull()
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

  it('manda el producto elegido en las dos categorías', () => {
    expect(aDatosNuevoPalet(VALIDO, 'agroquimico').productoId).toBe(1)
    expect(aDatosNuevoPalet(VALIDO, 'semilla').productoId).toBe(1)
  })

  it('manda la unidad elegida, que es del palet y no del producto', () => {
    // Dos partidas del mismo producto pueden venir en unidades distintas: una
    // en bolsas y otra a granel en kilos.
    const datos = aDatosNuevoPalet({ ...VALIDO, unidadMedida: 'kilo' }, 'semilla')

    expect(datos.unidadMedida).toBe('kilo')
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

  it('convierte la cantidad a número', () => {
    const datos = aDatosNuevoPalet({ ...VALIDO, cantidadInicial: '10,5' }, 'semilla')

    expect(datos.cantidadInicial).toBe(10.5)
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

describe('sector', () => {
  it('es obligatorio: sin él, la regla de un palet por lugar no se puede aplicar', () => {
    expect(validar({ sectorId: '' }, 'agroquimico')).toContainEqual({
      campo: 'sectorId',
      mensaje: 'Elegí en qué sector queda el palet.',
    })
  })

  it('lo convierte al id que espera la base', () => {
    // Llega del `<select>` como string y la RPC lo quiere numérico.
    const datos = aDatosNuevoPalet({ ...VALIDO, sectorId: '12' }, 'agroquimico')

    expect(datos.sectorId).toBe(12)
  })
})

describe('reparto de un lote entre sus palets', () => {
  it('divide parejo cuando da exacto', () => {
    expect(repartirEntrePalets(10_000, 10)).toEqual({
      porPalet: 1000,
      ultimo: 1000,
      cantidadPalets: 10,
    })
  })

  it('le da el resto al último, para que la suma cierre', () => {
    // 33,33 × 3 = 99,99: sin el resto se evaporaría un centavo del stock.
    const reparto = repartirEntrePalets(100, 3)

    expect(reparto).toEqual({ porPalet: 33.33, ultimo: 33.34, cantidadPalets: 3 })
    expect(reparto!.porPalet * 2 + reparto!.ultimo).toBeCloseTo(100, 2)
  })

  it('nunca se pasa de dos decimales, que es lo que aguanta la columna', () => {
    const reparto = repartirEntrePalets(10, 3)

    expect(reparto!.porPalet).toBe(3.33)
    // Trunca en vez de redondear: 3,34 × 3 daría más de lo que entró.
    expect(reparto!.ultimo).toBe(3.34)
  })

  it('mantiene la suma exacta también con decimales incómodos', () => {
    const reparto = repartirEntrePalets(0.3, 3)

    expect(reparto!.porPalet * 2 + reparto!.ultimo).toBeCloseTo(0.3, 2)
  })

  it('no calcula nada si los datos todavía no sirven', () => {
    expect(repartirEntrePalets(Number.NaN, 3)).toBeNull()
    expect(repartirEntrePalets(0, 3)).toBeNull()
    expect(repartirEntrePalets(-100, 3)).toBeNull()
    expect(repartirEntrePalets(100, 0)).toBeNull()
    expect(repartirEntrePalets(100, 1.5)).toBeNull()
  })
})

describe('cuándo es un lote y cuándo un palet solo', () => {
  it('uno, vacío o inválido es un palet solo', () => {
    expect(esUnSoloPalet('1')).toBe(true)
    expect(esUnSoloPalet('')).toBe(true)
    expect(esUnSoloPalet(undefined)).toBe(true)
    expect(esUnSoloPalet('dos')).toBe(true)
  })

  it('más de uno es un lote', () => {
    expect(esUnSoloPalet('2')).toBe(false)
    expect(esUnSoloPalet('10')).toBe(false)
  })
})

describe('validación del lote', () => {
  it('no exige sector: los palets del lote nacen sin ubicar', () => {
    // Elegir diez lugares antes de tener los palets delante obliga a decidirlos
    // de memoria; se ubican al descargarlos.
    expect(validar({ cantidadPalets: '10', sectorId: '' }, 'agroquimico')).toBeNull()
  })

  it('sí lo exige cuando es un palet solo', () => {
    const errores = validar({ cantidadPalets: '1', sectorId: '' }, 'agroquimico')

    expect(errores?.some((e) => e.campo === 'sectorId')).toBe(true)
  })

  it('rechaza más palets que el tope', () => {
    expect(validar({ cantidadPalets: '51' }, 'agroquimico')).not.toBeNull()
    expect(validar({ cantidadPalets: '50', sectorId: '' }, 'agroquimico')).toBeNull()
  })

  it('rechaza cero, negativos y decimales', () => {
    expect(validar({ cantidadPalets: '0' }, 'agroquimico')).not.toBeNull()
    expect(validar({ cantidadPalets: '-3' }, 'agroquimico')).not.toBeNull()
    expect(validar({ cantidadPalets: '2,5' }, 'agroquimico')).not.toBeNull()
  })

  it('avisa si el total no alcanza para tantos palets', () => {
    // 10 en 3000 le tocaría menos de un centavo a cada uno, y la base lo
    // rechaza: mejor decirlo antes de mandar el formulario entero.
    const errores = validar(
      { cantidadPalets: '3000', cantidadInicial: '10', sectorId: '' },
      'agroquimico',
    )

    expect(errores).not.toBeNull()
  })
})

describe('traducción del lote a lo que espera la base', () => {
  it('manda el total y en cuántos palets se reparte, con el galpón', () => {
    const datos = aDatosNuevoLote(
      { ...VALIDO, cantidadPalets: '10', cantidadInicial: '10000', galpon: '2' },
      'agroquimico',
    )

    // El total viaja entero: el reparto lo hace la base, que es la que manda.
    expect(datos.cantidadInicial).toBe(10_000)
    expect(datos.cantidadPalets).toBe(10)
    expect(datos.galpon).toBe(2)
  })

  it('no manda sector: en el lote no existe', () => {
    const datos = aDatosNuevoLote({ ...VALIDO, cantidadPalets: '10' }, 'agroquimico')

    expect('sectorId' in datos).toBe(false)
  })
})
