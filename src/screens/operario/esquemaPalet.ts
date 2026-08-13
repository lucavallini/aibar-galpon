import { z } from 'zod'
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

  productoId: z
    .string()
    .min(1, 'Elegí un producto.'),

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

  galpon: z.enum(['1', '2', '3'], { message: 'Elegí un galpón.' }),

  sector: textoOpcional(50, 'El sector no puede tener más de 50 caracteres.'),

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
  })
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
    galpon: Number(valores.galpon) as 1 | 2 | 3,
    sector: aTextoONulo(valores.sector),
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
    observacion: aTextoONulo(valores.observacion),
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
