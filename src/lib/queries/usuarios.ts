import { supabase } from '@/lib/supabase'
import { desempaquetarOpcional } from '@/lib/queries/errores'
import type { Usuario } from '@/types'

/**
 * Lecturas de la tabla `usuario`.
 *
 * El perfil no se crea desde acá: lo inserta el trigger `crear_usuario()` cuando
 * se registra la cuenta en `auth.users`, siempre con rol `operario`. Pasar a
 * alguien a `jefe` es una operación manual contra la base.
 */

/**
 * Perfil del usuario, con su rol.
 *
 * Devuelve `null` en vez de lanzar cuando no hay fila, porque es un caso real y
 * distinguible: la cuenta existe en `auth.users` pero le falta el perfil (por
 * ejemplo, se creó antes de que el trigger estuviera instalado). La UI necesita
 * poder mostrar "tu cuenta no está configurada" en lugar de un error genérico.
 *
 * La policy `usuario_select` solo deja leer el perfil propio, salvo que quien
 * consulta sea jefe.
 */
export async function obtenerPerfil(usuarioId: string): Promise<Usuario | null> {
  const respuesta = await supabase
    .from('usuario')
    .select('*')
    .eq('id', usuarioId)
    .maybeSingle()

  return desempaquetarOpcional(respuesta, 'obtener el perfil del usuario')
}
