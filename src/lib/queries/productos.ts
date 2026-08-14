import { supabase } from '@/lib/supabase'
import {
  desempaquetar,
  desempaquetarLista,
  desempaquetarOpcional,
} from '@/lib/queries/errores'
import type { Categoria, Producto, ProductoInsert } from '@/types'

/**
 * Catálogo de productos.
 *
 * El alta es un INSERT directo, a diferencia de la de palets: acá no hay dos
 * tablas que mantener sincronizadas ni stock que proteger, así que la policy
 * `producto_insert_operario` alcanza y no hace falta una función en la base.
 */

/** Todos los productos, alfabéticos. */
export async function listarProductos(): Promise<Producto[]> {
  const respuesta = await supabase.from('producto').select('*').order('nombre')

  return desempaquetarLista(respuesta, 'listar los productos')
}

/** Productos de una categoría. Sirve para acotar el selector al dar de alta un palet. */
export async function listarProductosPorCategoria(
  categoria: Categoria,
): Promise<Producto[]> {
  const respuesta = await supabase
    .from('producto')
    .select('*')
    .eq('categoria', categoria)
    .order('nombre')

  return desempaquetarLista(respuesta, `listar los productos de categoría ${categoria}`)
}

/** Un producto por id. Lanza si no existe o si RLS lo oculta. */
export async function obtenerProducto(id: number): Promise<Producto> {
  const respuesta = await supabase.from('producto').select('*').eq('id', id).single()

  return desempaquetar(respuesta, `obtener el producto ${id}`)
}

/** Datos para dar de alta un producto. */
export interface DatosNuevoProducto {
  nombre: string
  categoria: Categoria
  /**
   * Cómo suele venir el producto. Opcional y solo informativa: la unidad con la
   * que se cuenta el stock la elige cada palet, porque dos partidas de lo mismo
   * pueden venir en unidades distintas.
   */
  unidadMedida?: string | null
  /** Bayer, Syngenta, Nidera… */
  marca?: string | null
  /** Glifosato, atrazina. Solo tiene sentido en agroquímicos. */
  principioActivo?: string | null
  /** 48%, 50 g/l. */
  concentracion?: string | null
  /** Maíz, soja, girasol. Solo tiene sentido en semillas. */
  especie?: string | null
  /**
   * La variedad que define al producto: DK 7210.
   *
   * No se pisa con el híbrido del palet: aquel es el que vino en esa partida,
   * que puede diferir si el proveedor mandó otra con el mismo nombre.
   */
  hibrido?: string | null
}

/** Vacío o solo espacios se guarda como `null`, no como cadena vacía. */
function aTextoONulo(valor: string | null | undefined): string | null {
  const limpio = valor?.trim() ?? ''
  return limpio === '' ? null : limpio
}

/**
 * Da de alta un producto y devuelve el creado, con su id.
 *
 * Solo los operarios pueden: lo impone la policy `producto_insert_operario`. Si
 * lo intenta un jefe, la base rechaza el INSERT y el mensaje llega como
 * `ErrorSupabase` — no hace falta chequear el rol acá.
 *
 * @throws {ErrorSupabase} con el mensaje que devuelve la base.
 */
export async function crearProducto(datos: DatosNuevoProducto): Promise<Producto> {
  const nuevo: ProductoInsert = {
    nombre: datos.nombre.trim(),
    categoria: datos.categoria,
    unidad_medida: aTextoONulo(datos.unidadMedida),
    marca: aTextoONulo(datos.marca),
    principio_activo: aTextoONulo(datos.principioActivo),
    concentracion: aTextoONulo(datos.concentracion),
    especie: aTextoONulo(datos.especie),
    hibrido: aTextoONulo(datos.hibrido),
  }

  const respuesta = await supabase.from('producto').insert(nuevo).select().single()

  return desempaquetar(respuesta, 'crear el producto')
}

/**
 * Busca un producto por nombre exacto, sin distinguir mayúsculas ni acentos de
 * espaciado.
 *
 * Sirve para avisar de un duplicado antes de intentar guardarlo. Ojo: es una
 * comprobación de conveniencia, no una garantía. La columna `nombre` no tiene
 * restricción `UNIQUE`, así que dos operarios cargando el mismo producto al
 * mismo tiempo pueden duplicarlo igual.
 */
export async function buscarProductoPorNombre(nombre: string): Promise<Producto | null> {
  const termino = nombre.trim()

  if (termino === '') return null

  const respuesta = await supabase
    .from('producto')
    .select('*')
    // `ilike` sin comodines compara el texto completo sin distinguir may/min.
    .ilike('nombre', termino)
    .limit(1)
    .maybeSingle()

  return desempaquetarOpcional(respuesta, `buscar el producto "${termino}"`)
}
