import { supabase } from '@/lib/supabase'
import { desempaquetar, desempaquetarLista } from '@/lib/queries/errores'
import type {
  EmpresaTransporte,
  EmpresaTransporteInsert,
  Transportista,
  TransportistaConEmpresa,
  TransportistaInsert,
} from '@/types'

/**
 * Los choferes que traen y se llevan mercadería.
 *
 * Se cargaron desde la base de viajes que ya usa AIBAR, y el operario puede
 * sumar los que falten: siempre aparece un camión con un chofer nuevo, y sin
 * poder darlo de alta en el momento el movimiento quedaría sin registrar quién
 * se llevó la carga.
 */

/** El chofer con el nombre de su transporte ya resuelto. */
const SELECT_CON_EMPRESA = '*, empresa:empresa_transporte_id(*)'

/**
 * Los choferes en actividad, alfabéticos.
 *
 * Los inactivos quedan fuera: siguen nombrados en los palets que trajeron, pero
 * no tienen por qué seguir apareciendo en una lista que se elige con el pulgar.
 */
export async function listarTransportistas(): Promise<TransportistaConEmpresa[]> {
  const respuesta = await supabase
    .from('transportista')
    .select(SELECT_CON_EMPRESA)
    .eq('activo', true)
    .order('nombre')
    .returns<TransportistaConEmpresa[]>()

  return desempaquetarLista(respuesta, 'listar los transportistas')
}

/** Las empresas de transporte, alfabéticas. */
export async function listarEmpresasDeTransporte(): Promise<EmpresaTransporte[]> {
  const respuesta = await supabase.from('empresa_transporte').select('*').order('nombre')

  return desempaquetarLista(respuesta, 'listar las empresas de transporte')
}

export interface DatosNuevoTransportista {
  nombre: string
  /** `null` = fletero por su cuenta. */
  empresaTransporteId?: number | null
  telefono?: string | null
}

/** Vacío o solo espacios se guarda como `null`, no como cadena vacía. */
function aTextoONulo(valor: string | null | undefined): string | null {
  const limpio = valor?.trim() ?? ''
  return limpio === '' ? null : limpio
}

/**
 * Da de alta un chofer.
 *
 * La base tiene un índice único sobre el nombre normalizado: dos operarios
 * cargando al mismo Juan Pérez a la vez no lo duplican, el segundo recibe el
 * rechazo.
 *
 * @throws {ErrorSupabase} con el mensaje de la base.
 */
export async function crearTransportista(
  datos: DatosNuevoTransportista,
): Promise<Transportista> {
  const nuevo: TransportistaInsert = {
    nombre: datos.nombre.trim(),
    empresa_transporte_id: datos.empresaTransporteId ?? null,
    telefono: aTextoONulo(datos.telefono),
  }

  const respuesta = await supabase.from('transportista').insert(nuevo).select().single()

  return desempaquetar(respuesta, 'crear el transportista')
}

/** Da de alta una empresa de transporte y devuelve la creada. */
export async function crearEmpresaDeTransporte(
  nombre: string,
): Promise<EmpresaTransporte> {
  const nueva: EmpresaTransporteInsert = { nombre: nombre.trim() }

  const respuesta = await supabase
    .from('empresa_transporte')
    .insert(nueva)
    .select()
    .single()

  return desempaquetar(respuesta, 'crear la empresa de transporte')
}
