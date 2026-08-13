import { supabase } from '@/lib/supabase'
import { desempaquetarLista } from '@/lib/queries/errores'
import type {
  Categoria,
  EstadoPalet,
  Galpon,
  PaletGerencia,
  StockPorProducto,
} from '@/types'

/**
 * Consultas del panel administrativo. Solo lectura.
 *
 * Se apoyan en las vistas `vista_palet_gerencia` y `vista_stock_por_producto`,
 * que resuelven en Postgres los cruces con producto, detalle y movimientos.
 */

/**
 * Preguntas de negocio, no filtros de columna.
 *
 * Cada una responde algo que el jefe se pregunta de verdad, y por eso combina
 * varios criterios que a mano habría que ir armando de a uno.
 */
export type PreguntaDeNegocio =
  /** Todo el depósito, sin recorte. */
  | 'todo'
  /** Agroquímicos con la fecha de vencimiento ya pasada y stock todavía adentro. */
  | 'vencidos'
  /** Vencen dentro de 30 días: hay que colocarlos ya. */
  | 'vence-30'
  /** Vencen dentro de 90 días: entra en la planificación. */
  | 'vence-90'
  /** Más de 60 días sin registrar un solo movimiento. */
  | 'sin-movimiento'
  /** Palets abiertos a medias, candidatos a consolidar. */
  | 'parciales'
  /** Con alguna observación cargada: algo les pasó y hay que enterarse. */
  | 'con-novedades'

/** Días sin movimiento a partir de los cuales un palet se considera quieto. */
export const DIAS_INMOVILIZADO = 60

export interface FiltrosGerencia {
  pregunta: PreguntaDeNegocio
  galpon?: Galpon
  categoria?: Categoria
  estado?: EstadoPalet
  productoId?: number
  /**
   * Dueño de la mercadería. `'propia'` filtra los palets sin cliente, que son
   * los de AIBAR.
   */
  clienteId?: number | 'propia'
  /** Búsqueda por lote. */
  lote?: string
  /** Búsqueda por sector dentro del galpón. */
  sector?: string
}

/**
 * Traduce una pregunta de negocio a criterios sobre la vista.
 *
 * Va como datos y no como una función que encadene sobre el builder: así los
 * criterios se declaran una sola vez y los usan por igual el listado y el
 * contador de las alertas, sin pelear con los tipos genéricos de supabase-js.
 */
interface CriteriosDePregunta {
  /** Estados a incluir. Casi siempre «los que tienen algo adentro». */
  estados?: EstadoPalet[]
  /** Vencimiento ya pasado. */
  vencido?: boolean
  /** Vence dentro de esta cantidad de días (y todavía no venció). */
  venceEnDias?: number
  /** Quieto desde hace al menos estos días. */
  quietoDesdeDias?: number
  /** Con al menos una observación. */
  conObservaciones?: boolean
}

/** Un palet vacío que venció no es un problema: ya salió del depósito. */
const CON_STOCK: EstadoPalet[] = ['activo', 'parcial']

function criteriosDe(pregunta: PreguntaDeNegocio): CriteriosDePregunta {
  switch (pregunta) {
    case 'vencidos':
      return { estados: CON_STOCK, vencido: true }
    case 'vence-30':
      return { estados: CON_STOCK, venceEnDias: 30 }
    case 'vence-90':
      return { estados: CON_STOCK, venceEnDias: 90 }
    case 'sin-movimiento':
      return { estados: CON_STOCK, quietoDesdeDias: DIAS_INMOVILIZADO }
    case 'parciales':
      return { estados: ['parcial'] }
    case 'con-novedades':
      // Sin recorte de estado: una rotura en un palet ya vacío sigue siendo
      // algo que el jefe puede querer leer.
      return { conObservaciones: true }
    case 'todo':
      return {}
  }
}

/**
 * Palets del panel, filtrados.
 *
 * **Todo el filtrado ocurre en la base.** Es lo correcto acá y no una cuestión
 * de gusto: los criterios de vencimiento y antigüedad se calculan sobre columnas
 * de la vista, así que filtrarlos del lado del cliente obligaría a descargar el
 * depósito entero para descartar casi todo. Y `categoria` —que vive en
 * `producto` y no en `palet`— ya está desnormalizada en la vista, así que
 * tampoco necesita el rodeo de resolver ids que hace la búsqueda del operario.
 */
export async function listarPaletsGerencia(
  filtros: FiltrosGerencia,
): Promise<PaletGerencia[]> {
  let consulta = supabase.from('vista_palet_gerencia').select('*')

  const criterios = criteriosDe(filtros.pregunta)

  if (criterios.estados !== undefined) {
    consulta = consulta.in('estado', criterios.estados)
  }

  if (criterios.vencido === true) {
    // `dias_para_vencer` negativo = la fecha ya pasó.
    consulta = consulta.lt('dias_para_vencer', 0)
  }

  if (criterios.venceEnDias !== undefined) {
    consulta = consulta
      .gte('dias_para_vencer', 0)
      .lte('dias_para_vencer', criterios.venceEnDias)
  }

  if (criterios.quietoDesdeDias !== undefined) {
    consulta = consulta.gte('dias_sin_movimiento', criterios.quietoDesdeDias)
  }

  if (criterios.conObservaciones === true) {
    consulta = consulta.gt('cantidad_observaciones', 0)
  }

  if (filtros.galpon !== undefined) {
    consulta = consulta.eq('galpon', filtros.galpon)
  }

  if (filtros.categoria !== undefined) {
    consulta = consulta.eq('producto_categoria', filtros.categoria)
  }

  if (filtros.estado !== undefined) {
    consulta = consulta.eq('estado', filtros.estado)
  }

  if (filtros.productoId !== undefined) {
    consulta = consulta.eq('producto_id', filtros.productoId)
  }

  if (filtros.clienteId === 'propia') {
    consulta = consulta.is('cliente_id', null)
  } else if (filtros.clienteId !== undefined) {
    consulta = consulta.eq('cliente_id', filtros.clienteId)
  }

  const lote = filtros.lote?.trim() ?? ''

  if (lote !== '') {
    consulta = consulta.ilike('lote', `%${lote}%`)
  }

  const sector = filtros.sector?.trim() ?? ''

  if (sector !== '') {
    consulta = consulta.ilike('sector', `%${sector}%`)
  }

  // El orden depende de la pregunta: si se está mirando qué vence, lo urgente
  // va primero; si es qué no se mueve, lo más quieto.
  const respuesta =
    filtros.pregunta === 'vencidos' ||
    filtros.pregunta === 'vence-30' ||
    filtros.pregunta === 'vence-90'
      ? await consulta.order('dias_para_vencer', { ascending: true })
      : filtros.pregunta === 'sin-movimiento'
        ? await consulta.order('dias_sin_movimiento', { ascending: false })
        : filtros.pregunta === 'con-novedades'
          ? await consulta.order('ultima_observacion_fecha', {
              ascending: false,
              nullsFirst: false,
            })
        : await consulta
            .order('fecha_ingreso', { ascending: false })
            .order('id', { ascending: false })

  return desempaquetarLista(respuesta, 'listar los palets del depósito')
}

/** Cuántos palets hay en cada situación, para las tarjetas de alerta. */
export async function contarPorPregunta(pregunta: PreguntaDeNegocio): Promise<number> {
  // `head: true` no trae ninguna fila: solo pide el conteo, que es todo lo que
  // necesita una tarjeta de alerta.
  let consulta = supabase
    .from('vista_palet_gerencia')
    .select('*', { count: 'exact', head: true })

  const criterios = criteriosDe(pregunta)

  if (criterios.estados !== undefined) {
    consulta = consulta.in('estado', criterios.estados)
  }

  if (criterios.vencido === true) {
    consulta = consulta.lt('dias_para_vencer', 0)
  }

  if (criterios.venceEnDias !== undefined) {
    consulta = consulta
      .gte('dias_para_vencer', 0)
      .lte('dias_para_vencer', criterios.venceEnDias)
  }

  if (criterios.quietoDesdeDias !== undefined) {
    consulta = consulta.gte('dias_sin_movimiento', criterios.quietoDesdeDias)
  }

  if (criterios.conObservaciones === true) {
    consulta = consulta.gt('cantidad_observaciones', 0)
  }

  const { count, error } = await consulta

  if (error !== null) {
    console.error('[gerencia] fallo al contar palets', error)
    return 0
  }

  return count ?? 0
}

/** Stock consolidado por producto, de mayor a menor. */
export async function listarStockPorProducto(): Promise<StockPorProducto[]> {
  const respuesta = await supabase
    .from('vista_stock_por_producto')
    .select('*')
    .order('producto_nombre', { ascending: true })

  return desempaquetarLista(respuesta, 'listar el stock por producto')
}

/** Un palet del panel, por id. */
export async function obtenerPaletGerencia(id: number): Promise<PaletGerencia | null> {
  const respuesta = await supabase
    .from('vista_palet_gerencia')
    .select('*')
    .eq('id', id)
    .limit(1)

  const filas = desempaquetarLista(respuesta, `obtener el palet ${id}`)

  return filas[0] ?? null
}
