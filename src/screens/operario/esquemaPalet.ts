import { z } from 'zod'
import { UNIDADES_DE_MEDIDA } from '@/lib/unidades'
import type { Categoria } from '@/types'

/**
 * Validación del formulario de alta de palet.
 *
 * Esto es **feedback inmediato, no seguridad**: la validación que cuenta es la
 * de la base (CHECK, RLS y triggers). Acá se replican sus reglas para que el
 * operario se entere del problema antes de mandar el formulario, no después.
 *
 * Es un único esquema con `superRefine` y no una unión discriminada por
 * categoría: React Hook Form trabaja mucho mejor con un tipo de formulario
 * estable, donde los campos no aparecen y desaparecen del tipo según la rama.
 * Los campos específicos son opcionales, y las reglas condicionales se agregan
 * abajo según el tipo de mercadería elegido.
 *
 * Todos los campos son `string` porque vienen de inputs. La conversión a número
 * y a `null` la hace `aDatosNuevoPalet()`.
 */

/** Tope de `NUMERIC(10,2)`: 8 dígitos enteros más 2 decimales. */
const MAXIMO_CANTIDAD = 99_999_999.99

/**
 * Cuántos palets admite un lote.
 *
 * Existe para que un cero de más no cree mil palets que después hay que dar de
 * baja de a uno. Espeja el tope de `crear_palets_en_lote()`: si se cambia acá,
 * hay que cambiarlo también en la base, que es la que manda.
 */
export const MAXIMO_PALETS_POR_LOTE = 50

/**
 * Lee un número escrito por una persona.
 *
 * `Number('10,5')` da `NaN`, y la coma es el separador decimal del castellano:
 * es lo que ofrece el teclado del celular y lo que el operario va a tipear.
 */
function aNumero(valor: string): number {
  return Number(valor.trim().replace(',', '.'))
}

const textoOpcional = (maximo: number, mensaje: string) =>
  z
    .string()
    .trim()
    .max(maximo, mensaje)
    .optional()

const fechaOpcional = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Poné una fecha válida.')
  .optional()
  .or(z.literal(''))

export const esquemaPalet = z.object({
  /**
   * Se elige antes que el producto y recorta la lista a los de su tipo.
   *
   * Antes se derivaba del producto ya elegido, pero eso obligaba al operario a
   * buscar entre todo el catálogo mezclado. Ahora contesta primero «¿qué llegó,
   * agroquímico o semilla?», que es lo que sabe de entrada, y el selector queda
   * con la mitad de las opciones.
   */
  categoria: z.enum(['agroquimico', 'semilla'], {
    message: 'Elegí si es agroquímico o semilla.',
  }),

  /**
   * Qué cosa es, elegido del catálogo. Lo llevan las dos categorías.
   *
   * En la semilla el producto es el cultivo —Soja, Maíz— y el híbrido de la
   * partida va aparte, en el palet: dos camiones de maíz con híbridos distintos
   * son el mismo producto y no dos entradas del catálogo.
   */
  productoId: z.string().min(1, 'Elegí un producto.'),

  /**
   * Lo que en el remito de un agroquímico es el «número de lote» y en la bolsa
   * de una semilla es el «batch»: el mismo dato con dos nombres según de qué
   * mercadería se trate. La etiqueta la pone la pantalla; la columna es una
   * sola, `palet.lote`.
   */
  lote: z
    .string()
    .trim()
    .min(1, 'El lote es obligatorio.')
    .max(50, 'El lote no puede tener más de 50 caracteres.'),

  cantidadInicial: z
    .string()
    .min(1, 'La cantidad es obligatoria.')
    // El teclado decimal en castellano escribe coma, y `Number('10,5')` es NaN:
    // sin normalizar, el formulario rechazaba una cantidad perfectamente válida.
    .refine((valor) => !Number.isNaN(aNumero(valor)), 'Poné un número.')
    .refine((valor) => aNumero(valor) > 0, 'La cantidad tiene que ser mayor que cero.')
    .refine(
      (valor) => aNumero(valor) <= MAXIMO_CANTIDAD,
      'La cantidad es demasiado grande.',
    )
    .refine(
      // NUMERIC(10,2): más de dos decimales se redondearían en silencio.
      (valor) => /^\d+([.,]\d{1,2})?$/.test(valor.trim()),
      'Como máximo dos decimales.',
    ),

  /**
   * En qué se cuenta lo que entró.
   *
   * Lista cerrada y no texto libre: escrita a mano terminaban conviviendo «kg»,
   * «Kg» y «kilos» como tres unidades distintas.
   */
  unidadMedida: z.enum(UNIDADES_DE_MEDIDA, { message: 'Elegí la unidad.' }),

  /**
   * En cuántos palets viene el lote.
   *
   * Con `1` —lo normal— el alta funciona como siempre. Con más, la cantidad
   * pasa a ser el total del lote, la base lo reparte y los palets nacen sin
   * sector, porque elegir diez lugares de memoria antes de descargar no es algo
   * que el operario pueda hacer.
   */
  cantidadPalets: z
    .string()
    .min(1, 'Poné cuántos palets trae el lote.')
    .refine((valor) => /^\d+$/.test(valor.trim()), 'Poné un número entero.')
    .refine((valor) => Number(valor) >= 1, 'Tiene que ser al menos 1.')
    .refine(
      (valor) => Number(valor) <= MAXIMO_PALETS_POR_LOTE,
      `Un lote no puede tener más de ${MAXIMO_PALETS_POR_LOTE} palets.`,
    ),

  galpon: z.enum(['1', '2', '3'], { message: 'Elegí un galpón.' }),

  /**
   * Id del sector, elegido de la lista de libres.
   *
   * Obligatorio: un sector es un lugar físico y admite un palet a la vez. Sin
   * ubicación no hay forma de saber si un lugar está libre, y el palet termina
   * habiendo que buscarlo a ojo por el galpón.
   */
  sectorId: z.string(),

  fechaIngreso: z
    .string()
    .min(1, 'La fecha de ingreso es obligatoria.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Poné una fecha válida.'),

  // Agroquímico
  fechaElaboracion: fechaOpcional,
  fechaVencimiento: fechaOpcional,

  // Semilla
  hibrido: textoOpcional(100, 'El híbrido no puede tener más de 100 caracteres.'),
  calibre: textoOpcional(50, 'El calibre no puede tener más de 50 caracteres.'),

  /** Vacío = mercadería de AIBAR S.R.L. */
  clienteId: z.string().optional(),

  /**
   * Quién trajo la mercadería. Vacío = no se registró.
   *
   * Siempre opcional: trabar el alta por un dato que el operario no siempre
   * tiene a mano terminaría en palets sin cargar, que es peor que un palet sin
   * chofer.
   */
  transportistaId: z.string().optional(),

  /** Primera nota de la bitácora. */
  observacion: textoOpcional(500, 'La observación no puede tener más de 500 caracteres.'),
})

export type FormularioPalet = z.infer<typeof esquemaPalet>

/**
 * Agrega las reglas que dependen del tipo de mercadería.
 *
 * Se pasa por fuera del esquema aunque `categoria` sea un campo del formulario:
 * el resolver se arma dentro de `useForm`, antes de que exista el `watch` que
 * dice qué tipo está elegido, así que la pantalla lo alimenta con un ref.
 */
export function esquemaPaletSegunCategoria(categoria: Categoria | null) {
  return esquemaPalet.superRefine((valores, contexto) => {
    // Un palet solo se ubica al darlo de alta; los de un lote nacen sin sector
    // y se ubican al descargarlos, así que ahí el campo ni se muestra.
    if (esUnSoloPalet(valores.cantidadPalets) && valores.sectorId.trim() === '') {
      contexto.addIssue({
        code: 'custom',
        path: ['sectorId'],
        message: 'Elegí en qué sector queda el palet.',
      })
    }

    // Repartir 10 kg en 300 palets deja a cada uno en cero, y la base lo
    // rechaza. Se avisa antes de mandar el formulario entero.
    if (!esUnSoloPalet(valores.cantidadPalets)) {
      const reparto = repartirEntrePalets(
        aNumero(valores.cantidadInicial),
        Number(valores.cantidadPalets),
      )

      if (reparto !== null && reparto.porPalet <= 0) {
        contexto.addIssue({
          code: 'custom',
          path: ['cantidadInicial'],
          message: 'No alcanza para tantos palets: a cada uno le tocaría menos de 0,01.',
        })
      }
    }

    if (categoria === 'agroquimico') {
      // Es un depósito de agroquímicos: sin vencimiento no se puede controlar
      // el stock vencido. La base lo acepta nulo, nosotros no.
      if (valores.fechaVencimiento === undefined || valores.fechaVencimiento === '') {
        contexto.addIssue({
          code: 'custom',
          path: ['fechaVencimiento'],
          message: 'La fecha de vencimiento es obligatoria en agroquímicos.',
        })
      }

      // Espeja el CHECK del schema.
      const hayAmbas =
        valores.fechaElaboracion !== undefined &&
        valores.fechaElaboracion !== '' &&
        valores.fechaVencimiento !== undefined &&
        valores.fechaVencimiento !== ''

      if (hayAmbas && valores.fechaVencimiento! < valores.fechaElaboracion!) {
        contexto.addIssue({
          code: 'custom',
          path: ['fechaVencimiento'],
          message: 'El vencimiento no puede ser anterior a la elaboración.',
        })
      }
    }

    if (categoria === 'semilla') {
      // El producto dice el cultivo —Maíz— y el híbrido dice cuál: sin él, dos
      // partidas distintas quedan indistinguibles en el listado, y es el dato
      // que el operario tiene delante impreso en la bolsa.
      if (valores.hibrido === undefined || valores.hibrido.trim() === '') {
        contexto.addIssue({
          code: 'custom',
          path: ['hibrido'],
          message: 'Poné el híbrido de la semilla.',
        })
      }
    }
  })
}

/** `'1'`, vacío o cualquier cosa que no sea un número mayor a uno. */
export function esUnSoloPalet(cantidadPalets: string | undefined): boolean {
  const cantidad = Number((cantidadPalets ?? '1').trim())

  return !Number.isInteger(cantidad) || cantidad <= 1
}

export interface RepartoDelLote {
  /** Lo que le toca a cada palet menos al último. */
  porPalet: number
  /** El último se queda con el resto, para que la suma dé el total exacto. */
  ultimo: number
  cantidadPalets: number
}

/**
 * Cómo se reparte el total entre los palets del lote.
 *
 * **Espeja el cálculo de `crear_palets_en_lote()`**, que es el que manda: acá
 * se replica solo para poder mostrarle al operario cuánto va a quedar en cada
 * palet antes de crearlos. Si se cambia el reparto en la base, hay que cambiarlo
 * también acá o la pantalla va a prometer un número y la base guardar otro.
 *
 * Trunca a dos decimales —lo que aguanta `NUMERIC(10,2)`— y le suma la
 * diferencia al último: repartir 100 en 3 da 33,33 + 33,33 + 33,34, y no 99,99
 * con un kilo evaporado.
 *
 * @returns `null` si los datos todavía no sirven para calcular nada.
 */
export function repartirEntrePalets(
  total: number,
  cantidadPalets: number,
): RepartoDelLote | null {
  if (!Number.isFinite(total) || total <= 0) return null
  if (!Number.isInteger(cantidadPalets) || cantidadPalets < 1) return null

  const porPalet = Math.trunc((total / cantidadPalets) * 100) / 100

  // Las dos vueltas por centavos evitan que 0.1 + 0.2 = 0.30000000000000004 se
  // filtre a la cantidad que se muestra.
  const ultimo =
    Math.round(total * 100 - porPalet * 100 * (cantidadPalets - 1)) / 100

  return { porPalet, ultimo, cantidadPalets }
}

/** Convierte un texto de formulario a lo que espera la base: texto o `null`. */
function aTextoONulo(valor: string | undefined): string | null {
  const limpio = valor?.trim() ?? ''
  return limpio === '' ? null : limpio
}

/**
 * Traduce los valores del formulario —todos `string`— a los tipos que espera la
 * capa de queries.
 *
 * Los campos de la categoría que no corresponde se mandan en `null`: la base los
 * ignora igual, pero mandarlos vacíos deja el intento explícito.
 */
export function aDatosNuevoPalet(valores: FormularioPalet, categoria: Categoria | null) {
  const esAgroquimico = categoria === 'agroquimico'
  const esSemilla = categoria === 'semilla'

  return {
    productoId: Number(valores.productoId),
    lote: valores.lote.trim(),
    cantidadInicial: aNumero(valores.cantidadInicial),
    unidadMedida: valores.unidadMedida,
    sectorId: Number(valores.sectorId),
    fechaIngreso: valores.fechaIngreso,
    fechaElaboracion: esAgroquimico ? aTextoONulo(valores.fechaElaboracion) : null,
    fechaVencimiento: esAgroquimico ? aTextoONulo(valores.fechaVencimiento) : null,
    hibrido: esSemilla ? aTextoONulo(valores.hibrido) : null,
    calibre: esSemilla ? aTextoONulo(valores.calibre) : null,
    // Sin cliente elegido, la mercadería es de AIBAR S.R.L.
    clienteId:
      valores.clienteId === undefined || valores.clienteId === ''
        ? null
        : Number(valores.clienteId),
    transportistaId:
      valores.transportistaId === undefined || valores.transportistaId === ''
        ? null
        : Number(valores.transportistaId),
    observacion: aTextoONulo(valores.observacion),
  }
}

/**
 * Lo mismo que `aDatosNuevoPalet()`, para un lote repartido en varios palets.
 *
 * `cantidadInicial` viaja como **el total del lote**: el reparto lo hace la
 * base. En lugar del sector va el galpón, porque estos palets nacen sin ubicar.
 */
export function aDatosNuevoLote(valores: FormularioPalet, categoria: Categoria | null) {
  const { sectorId: _sectorId, ...comunes } = aDatosNuevoPalet(valores, categoria)

  return {
    ...comunes,
    cantidadPalets: Number(valores.cantidadPalets),
    galpon: Number(valores.galpon),
  }
}

/** Fecha de hoy en `YYYY-MM-DD`, en la zona horaria del dispositivo. */
export function hoyISO(): string {
  const ahora = new Date()
  const desfase = ahora.getTimezoneOffset() * 60_000

  // `toISOString()` pasa a UTC: sin corregir el desfase, a la tarde en
  // Argentina la fecha se adelanta un día.
  return new Date(ahora.getTime() - desfase).toISOString().slice(0, 10)
}
