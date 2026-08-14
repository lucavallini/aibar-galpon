import { supabase } from '@/lib/supabase'
import {
  desempaquetar,
  desempaquetarLista,
  desempaquetarOpcional,
} from '@/lib/queries/errores'
import type { Movimiento, MovimientoConAutor, TipoMovimientoRegistrable } from '@/types'

/**
 * Historial de movimientos y registro de nuevos.
 *
 * El schema hace REVOKE de INSERT, UPDATE y DELETE sobre `movimiento`, así que
 * no hay —ni puede haber— escritura directa: el único camino es la RPC
 * `registrar_movimiento()`, que descuenta el stock y crea el registro histórico
 * dentro de una misma transacción.
 */

/**
 * Historial completo de un palet, del movimiento más reciente al más viejo,
 * con el nombre de quien registró cada uno.
 *
 * El autor sale de un embed a `usuario`. Que se vea o no depende de la policy
 * `usuario_select`: desde la migración `20260812150000` cualquier usuario activo
 * puede leer el padrón, así que el nombre llega. Si quien consulta estuviera
 * inactivo, `usuario` vendría en `null` y el movimiento igual se lista.
 */
export async function listarMovimientosDePalet(
  paletId: number,
): Promise<MovimientoConAutor[]> {
  const respuesta = await supabase
    .from('movimiento')
    .select(
      '*, usuario:usuario_id(id, nombre, rol), transportista:transportista_id(id, nombre)',
    )
    .eq('palet_id', paletId)
    .order('fecha_hora', { ascending: false })
    .order('id', { ascending: false })
    .returns<MovimientoConAutor[]>()

  return desempaquetarLista(respuesta, `listar los movimientos del palet ${paletId}`)
}

/** Últimos movimientos del depósito, para el panel administrativo. */
export async function listarMovimientosRecientes(limite = 50): Promise<Movimiento[]> {
  const respuesta = await supabase
    .from('movimiento')
    .select('*')
    .order('fecha_hora', { ascending: false })
    .limit(limite)

  return desempaquetarLista(respuesta, 'listar los movimientos recientes')
}

/**
 * Último movimiento de un palet, o `null` si todavía no tiene ninguno.
 *
 * Es el único que `corregir_movimiento()` acepta corregir, y solo dentro de los
 * 30 minutos posteriores a su carga. La decisión final sobre si se puede
 * corregir la toma la base: acá solo se lee para saber qué ofrecer en pantalla.
 */
export async function obtenerUltimoMovimientoDePalet(
  paletId: number,
): Promise<Movimiento | null> {
  const respuesta = await supabase
    .from('movimiento')
    .select('*')
    .eq('palet_id', paletId)
    .order('fecha_hora', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  return desempaquetarOpcional(
    respuesta,
    `obtener el último movimiento del palet ${paletId}`,
  )
}

/** Datos de un movimiento a registrar. */
export interface DatosMovimiento {
  paletId: number
  /**
   * `venta`, `salida` o `ajuste`. Los tres descuentan stock; `correccion` no
   * está en el tipo porque solo puede crearla `corregir_movimiento()`.
   */
  tipo: TipoMovimientoRegistrable
  cantidad: number
  /**
   * Quién se lleva la mercadería.
   *
   * Opcional: si el operario no llegó a preguntarlo, la salida se registra
   * igual. La base lo descarta en los ajustes, donde no hubo ningún camión.
   */
  transportistaId?: number | null
}

/**
 * Registra un movimiento y descuenta el stock del palet.
 *
 * Va por RPC y no por INSERT, y no es una convención: la tabla `movimiento`
 * tiene REVOKE de INSERT, y `palet.cantidad_disponible` y `palet.estado` están
 * protegidos por el trigger `proteger_stock_palet()`. La función es la única
 * autorizada a tocarlos, y hace las dos cosas —descontar y registrar— en una
 * sola transacción.
 *
 * @throws {ErrorSupabase} cuyo `message` es el texto que escribió la base:
 * «Stock insuficiente. Disponible: 80, solicitado: 100», «El palet se encuentra
 * dado de baja», etc. Son mensajes redactados para el operario y hay que
 * mostrarlos tal cual, sin reemplazarlos por un error genérico.
 */
export async function registrarMovimiento(
  datos: DatosMovimiento,
): Promise<Movimiento> {
  const respuesta = await supabase
    .rpc('registrar_movimiento', {
      p_palet_id: datos.paletId,
      p_tipo: datos.tipo,
      p_cantidad: datos.cantidad,
      p_transportista_id: datos.transportistaId ?? null,
    })
    .single()

  return desempaquetar(respuesta, 'registrar el movimiento')
}

/** Cuánto tiempo hay para corregir un movimiento. Lo impone la base. */
export const MINUTOS_PARA_CORREGIR = 30

/** Datos para corregir un movimiento. */
export interface DatosCorreccion {
  movimientoId: number
  /** Obligatorio: queda guardado en el historial y la base lo exige. */
  motivo: string
  /** No lo usa la RPC; sirve para invalidar la caché del palet. */
  paletId: number
}

/**
 * Deshace un movimiento creando uno compensatorio de tipo `correccion`.
 *
 * No edita ni borra el original: el historial queda intacto y auditable. Es la
 * **única** vía que puede sumar stock, y devuelve exactamente la cantidad del
 * movimiento que corrige — no permite elegir un número arbitrario.
 *
 * La base impone sus propias reglas y las verifica ella: solo el último
 * movimiento del palet, dentro de los 30 minutos, nunca una corrección de otra
 * corrección, y con motivo. Lo que calcule el frontend es solo para mostrar u
 * ocultar el botón.
 *
 * @throws {ErrorSupabase} con el texto de la base: «El movimiento ya no puede
 * corregirse (fuera de plazo)», «Solo se puede corregir el último movimiento
 * registrado en el palet», etc. Se muestran tal cual.
 */
export async function corregirMovimiento(datos: DatosCorreccion): Promise<Movimiento> {
  const respuesta = await supabase
    .rpc('corregir_movimiento', {
      p_movimiento_id: datos.movimientoId,
      p_motivo: datos.motivo.trim(),
    })
    .single()

  return desempaquetar(respuesta, 'corregir el movimiento')
}
