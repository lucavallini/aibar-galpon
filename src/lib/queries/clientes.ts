import { supabase } from '@/lib/supabase'
import { desempaquetar, desempaquetarLista } from '@/lib/queries/errores'
import type { Cliente, ClienteInsert } from '@/types'

/**
 * Clientes: las empresas cuya mercadería se guarda en el depósito.
 *
 * Un palet sin cliente es mercadería propia de AIBAR, que es el caso más común.
 */

/** Todos los clientes, alfabéticos. */
export async function listarClientes(): Promise<Cliente[]> {
  const respuesta = await supabase.from('cliente').select('*').order('nombre')

  return desempaquetarLista(respuesta, 'listar los clientes')
}

/**
 * Da de alta un cliente.
 *
 * La base tiene un índice único sobre el nombre normalizado, así que un
 * duplicado es rechazado ahí aunque dos operarios lo carguen a la vez.
 *
 * @throws {ErrorSupabase} con el mensaje de la base.
 */
export async function crearCliente(nombre: string): Promise<Cliente> {
  const nuevo: ClienteInsert = { nombre: nombre.trim() }

  const respuesta = await supabase.from('cliente').insert(nuevo).select().single()

  return desempaquetar(respuesta, 'crear el cliente')
}
