import { supabase } from '@/lib/supabase'
import {
  desempaquetar,
  desempaquetarLista,
  ErrorSupabase,
} from '@/lib/queries/errores'
import type {
  EstadoPalet,
  Galpon,
  Palet,
  PaletCompleto,
  PaletConProducto,
  PaletUpdate,
} from '@/types'

/**
 * Consultas y alta de palets.
 *
 * El stock (`cantidad_disponible`, `estado`) nunca se toca desde el front: se
 * mueve exclusivamente por `registrar_movimiento()` / `corregir_movimiento()`.
 * El alta va por la RPC `crear_palet_completo()`, nunca por un insert directo.
 */

/** Columnas del palet más su producto resuelto. */
/** El cliente viene `null` cuando la mercadería es propia de AIBAR. */
const SELECT_CON_PRODUCTO = '*, producto:producto_id(*), cliente:cliente_id(*)'

/** Lo anterior más ambos detalles; solo viene cargado el de la categoría del producto. */
const SELECT_COMPLETO = `${SELECT_CON_PRODUCTO}, detalle_agroquimico(*), detalle_semilla(*)`

export interface FiltrosPalet {
  galpon?: Galpon
  estado?: EstadoPalet
  productoId?: number
}

/**
 * Palets con su producto, del más reciente al más viejo.
 *
 * Los filtros se aplican solo si vienen definidos, así una misma función sirve
 * para el listado general y para las vistas por galpón o por estado.
 */
export async function listarPalets(
  filtros: FiltrosPalet = {},
): Promise<PaletConProducto[]> {
  let consulta = supabase.from('palet').select(SELECT_CON_PRODUCTO)

  if (filtros.galpon !== undefined) {
    consulta = consulta.eq('galpon', filtros.galpon)
  }

  if (filtros.estado !== undefined) {
    consulta = consulta.eq('estado', filtros.estado)
  }

  if (filtros.productoId !== undefined) {
    consulta = consulta.eq('producto_id', filtros.productoId)
  }

  const respuesta = await consulta
    .order('fecha_ingreso', { ascending: false })
    .order('id', { ascending: false })
    .returns<PaletConProducto[]>()

  return desempaquetarLista(respuesta, 'listar los palets')
}

/**
 * Un palet con todo lo necesario para la pantalla de detalle: producto y el
 * detalle específico de su categoría.
 *
 * Es la query que va detrás del escaneo del QR, así que lanza si el palet no
 * existe: un QR que apunta a la nada es un error que hay que mostrarle al operario.
 */
export async function obtenerPalet(id: number): Promise<PaletCompleto> {
  const respuesta = await supabase
    .from('palet')
    .select(SELECT_COMPLETO)
    .eq('id', id)
    .single()
    .returns<PaletCompleto>()

  return desempaquetar(respuesta, `obtener el palet ${id}`)
}

/** Cuántos palets trae cada página del listado. */
export const PALETS_POR_PAGINA = 30

export interface FiltrosBusqueda {
  /** Texto libre: número de palet, lote o nombre de producto. */
  texto?: string
  galpon?: Galpon
  /** `true` deja fuera los vacíos y los dados de baja. */
  soloConStock?: boolean
  /**
   * Ids de los productos cuyo nombre coincide con `texto`.
   *
   * Se resuelven **afuera**, contra el catálogo que ya tiene en caché React
   * Query, porque PostgREST no admite un `or` que mezcle columnas propias con
   * columnas de una tabla embebida: `or=(lote.ilike.*x*,producto.nombre.ilike.*x*)`
   * es un error de sintaxis. Como `producto_id` sí es columna de `palet`, con los
   * ids ya resueltos alcanza una sola consulta, y la paginación sigue siendo del
   * lado del servidor.
   */
  idsDeProducto?: number[]
}

export interface PaginaDePalets {
  palets: PaletConProducto[]
  /** `true` si vino una página completa: puede haber más. */
  hayMas: boolean
}

/**
 * Listado de palets con búsqueda, filtros y paginación.
 *
 * Es la pantalla de respaldo para cuando el QR no se puede escanear —etiqueta
 * despegada, mojada o rota—, así que tiene que poder encontrar un palet con lo
 * que haya a mano: su número, el lote del remito o el producto.
 */
export async function buscarPalets(
  filtros: FiltrosBusqueda = {},
  pagina = 0,
): Promise<PaginaDePalets> {
  let consulta = supabase.from('palet').select(SELECT_CON_PRODUCTO)

  if (filtros.soloConStock === true) {
    consulta = consulta.in('estado', ['activo', 'parcial'])
  }

  if (filtros.galpon !== undefined) {
    consulta = consulta.eq('galpon', filtros.galpon)
  }

  const texto = filtros.texto?.trim() ?? ''

  if (texto !== '') {
    const condiciones = [`lote.ilike.%${escaparParaFiltro(texto)}%`]

    // Si escribió un número, puede estar buscando el palet por su id.
    if (/^\d+$/.test(texto)) {
      condiciones.push(`id.eq.${texto}`)
    }

    if (filtros.idsDeProducto !== undefined && filtros.idsDeProducto.length > 0) {
      condiciones.push(`producto_id.in.(${filtros.idsDeProducto.join(',')})`)
    }

    consulta = consulta.or(condiciones.join(','))
  }

  const desde = pagina * PALETS_POR_PAGINA

  const respuesta = await consulta
    .order('fecha_ingreso', { ascending: false })
    .order('id', { ascending: false })
    .range(desde, desde + PALETS_POR_PAGINA - 1)
    .returns<PaletConProducto[]>()

  const palets = desempaquetarLista(respuesta, 'buscar palets')

  return { palets, hayMas: palets.length === PALETS_POR_PAGINA }
}

/**
 * Neutraliza los caracteres que romperían el filtro.
 *
 * Las comas y los paréntesis separan condiciones dentro de un `or` de PostgREST,
 * así que un lote que los contenga partiría la consulta al medio.
 */
function escaparParaFiltro(texto: string): string {
  return texto.replace(/[,()]/g, ' ')
}

/** Búsqueda por lote, parcial y sin distinguir mayúsculas. */
export async function buscarPaletsPorLote(lote: string): Promise<PaletConProducto[]> {
  const termino = lote.trim()

  if (termino === '') {
    return []
  }

  const respuesta = await supabase
    .from('palet')
    .select(SELECT_CON_PRODUCTO)
    .ilike('lote', `%${termino}%`)
    .order('fecha_ingreso', { ascending: false })
    .returns<PaletConProducto[]>()

  return desempaquetarLista(respuesta, `buscar palets con el lote "${termino}"`)
}

/**
 * Palets con stock disponible en un galpón, para la vista de depósito.
 * Excluye los vacíos y los dados de baja.
 */
export async function listarPaletsConStock(galpon?: Galpon): Promise<PaletConProducto[]> {
  let consulta = supabase
    .from('palet')
    .select(SELECT_CON_PRODUCTO)
    .in('estado', ['activo', 'parcial'])

  if (galpon !== undefined) {
    consulta = consulta.eq('galpon', galpon)
  }

  const respuesta = await consulta
    .order('fecha_ingreso', { ascending: false })
    .returns<PaletConProducto[]>()

  return desempaquetarLista(respuesta, 'listar los palets con stock')
}

/** Palet sin relaciones, cuando solo hacen falta sus propias columnas. */
export async function obtenerPaletSimple(id: number): Promise<Palet> {
  const respuesta = await supabase.from('palet').select('*').eq('id', id).single()

  return desempaquetar(respuesta, `obtener el palet ${id}`)
}

/**
 * Datos para dar de alta un palet.
 *
 * Los campos específicos son opcionales acá porque cuáles corresponden depende
 * de la categoría del producto, que resuelve la base. Los que no aplican se
 * ignoran.
 */
export interface DatosNuevoPalet {
  productoId: number
  lote: string
  cantidadInicial: number
  galpon: Galpon
  sector?: string | null
  /** `YYYY-MM-DD`. Si se omite, la base usa la fecha de hoy. */
  fechaIngreso?: string | null
  /** Agroquímico. */
  fechaElaboracion?: string | null
  /** Agroquímico. */
  fechaVencimiento?: string | null
  /** Semilla. */
  hibrido?: string | null
  /** Semilla. */
  calibre?: string | null
  /** `null` = mercadería propia de AIBAR. */
  clienteId?: number | null
  /** Primera nota de la bitácora. Opcional. */
  observacion?: string | null
}

/**
 * Da de alta un palet junto con su detalle.
 *
 * Va por RPC y no por dos inserts porque PostgREST no puede envolver dos
 * requests en una transacción: si el detalle fallara, el palet quedaría
 * huérfano. La función de la base hace ambos inserts o ninguno.
 *
 * No manda `cantidad_disponible` ni `estado`: los fija el trigger
 * `inicializar_palet()`.
 *
 * @throws {ErrorSupabase} con el mensaje de la base — ahí viajan las
 * validaciones de negocio que hay que mostrarle al operario.
 */
export async function crearPalet(datos: DatosNuevoPalet): Promise<Palet> {
  const respuesta = await supabase
    .rpc('crear_palet_completo', {
      p_producto_id: datos.productoId,
      p_lote: datos.lote,
      p_cantidad_inicial: datos.cantidadInicial,
      p_galpon: datos.galpon,
      p_sector: datos.sector ?? null,
      p_fecha_ingreso: datos.fechaIngreso ?? null,
      p_fecha_elaboracion: datos.fechaElaboracion ?? null,
      p_fecha_vencimiento: datos.fechaVencimiento ?? null,
      p_hibrido: datos.hibrido ?? null,
      p_calibre: datos.calibre ?? null,
      p_cliente_id: datos.clienteId ?? null,
      p_observacion: datos.observacion ?? null,
    })
    .single()

  return desempaquetar(respuesta, 'dar de alta el palet')
}

/**
 * Datos editables de un palet.
 *
 * Son exactamente las columnas del `GRANT UPDATE`: `cantidad_inicial` es
 * inmutable y el stock solo se mueve por RPC. Lo que sí puede corregirse es la
 * identificación —un lote mal tipeado, un galpón equivocado— que hasta ahora
 * obligaba a rehacer el palet.
 */
export interface DatosEdicionPalet {
  productoId?: number
  lote?: string
  galpon?: Galpon
  sector?: string | null
  fechaIngreso?: string
  clienteId?: number | null
}

/**
 * Corrige los datos de un palet.
 *
 * La base impide cambiar producto o lote si el palet ya tuvo movimientos
 * (trigger `proteger_identidad_palet`): a esa altura la etiqueta impresa y el
 * historial ya dicen otra cosa. Su mensaje llega tal cual.
 *
 * @throws {ErrorSupabase} con el mensaje de la base.
 */
export async function editarPalet(
  paletId: number,
  datos: DatosEdicionPalet,
): Promise<void> {
  // Tipado como `PaletUpdate` y no como un objeto suelto: así los tipos siguen
  // impidiendo colar `cantidad_disponible` o `estado`, que es lo que protege el
  // schema.
  const cambios: PaletUpdate = {}

  if (datos.productoId !== undefined) cambios.producto_id = datos.productoId
  if (datos.lote !== undefined) cambios.lote = datos.lote.trim()
  if (datos.galpon !== undefined) cambios.galpon = datos.galpon
  if (datos.sector !== undefined) {
    const limpio = datos.sector?.trim() ?? ''
    cambios.sector = limpio === '' ? null : limpio
  }
  if (datos.fechaIngreso !== undefined) cambios.fecha_ingreso = datos.fechaIngreso
  if (datos.clienteId !== undefined) cambios.cliente_id = datos.clienteId

  if (Object.keys(cambios).length === 0) return

  const { error } = await supabase.from('palet').update(cambios).eq('id', paletId)

  if (error !== null) {
    throw new ErrorSupabase(`editar el palet ${paletId}`, error)
  }
}

/**
 * Saca un palet de circulación.
 *
 * Va por RPC y no por UPDATE porque el trigger `proteger_stock_palet()` bloquea
 * cualquier cambio de `estado` que venga del cliente. La función corre como
 * `SECURITY DEFINER` justamente para poder hacerlo, y de paso deja el motivo en
 * la bitácora: dar de baja mercadería es sacarla del stock, y después alguien
 * va a preguntar por qué.
 *
 * El stock **no** se pone en cero: el palet se congela como estaba, así queda
 * registrado cuánto había cuando se descartó.
 *
 * @throws {ErrorSupabase} con el mensaje de la base.
 */
export async function darDeBajaPalet(paletId: number, motivo: string): Promise<Palet> {
  const respuesta = await supabase
    .rpc('dar_de_baja_palet', { p_palet_id: paletId, p_motivo: motivo.trim() })
    .single()

  return desempaquetar(respuesta, `dar de baja el palet ${paletId}`)
}

/**
 * Cambia el dueño de un palet.
 *
 * `null` lo pasa a mercadería propia. Es un UPDATE directo porque `cliente_id`
 * está en el `GRANT UPDATE` de la tabla: no toca stock ni estado.
 */
export async function cambiarClienteDePalet(
  paletId: number,
  clienteId: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('palet')
    .update({ cliente_id: clienteId })
    .eq('id', paletId)

  if (error !== null) {
    throw new ErrorSupabase(`cambiar el cliente del palet ${paletId}`, error)
  }
}
