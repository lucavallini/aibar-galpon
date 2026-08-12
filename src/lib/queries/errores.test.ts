import { describe, expect, it } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'
import {
  desempaquetar,
  desempaquetarLista,
  desempaquetarOpcional,
  ErrorSupabase,
} from '@/lib/queries/errores'

/**
 * Esta capa decide qué le llega al operario cuando algo falla.
 *
 * Los dos extremos importan por igual: un mensaje de negocio que se pierda deja
 * al operario sin saber por qué no pudo trabajar, y un mensaje técnico que se
 * escape no le dice nada y encima lo asusta.
 */

/**
 * Construye el error tal como lo devuelve supabase-js.
 *
 * Va con un cast porque `PostgrestError` exige un `toJSON` que estos tests no
 * ejercitan: replicarlo entero solo agregaría ruido.
 */
function errorDePostgres(mensaje: string, codigo = 'P0001'): PostgrestError {
  return {
    message: mensaje,
    code: codigo,
    details: '',
    hint: '',
    name: 'PostgrestError',
  } as PostgrestError
}

describe('mensajes que ve el operario', () => {
  it('deja pasar los mensajes de negocio tal cual', () => {
    // Los escribe la base con RAISE EXCEPTION y están redactados para el
    // operario: reemplazarlos por un genérico sería perder la única
    // explicación de por qué no pudo registrar el movimiento.
    const error = new ErrorSupabase(
      'registrar el movimiento',
      errorDePostgres('Stock insuficiente. Disponible: 80, solicitado: 100'),
    )

    expect(error.message).toBe('Stock insuficiente. Disponible: 80, solicitado: 100')
  })

  it('conserva el resto de los mensajes de negocio del schema', () => {
    const casos = [
      'El palet se encuentra dado de baja',
      'El movimiento ya no puede corregirse (fuera de plazo)',
      'Solo se puede corregir el último movimiento registrado en el palet',
      'No se puede corregir una corrección',
      'Solo los operarios pueden dar de alta palets',
    ]

    for (const mensaje of casos) {
      expect(new ErrorSupabase('x', errorDePostgres(mensaje)).message).toBe(mensaje)
    }
  })

  it('traduce los fallos de red, que son jerga en inglés', () => {
    // supabase-js mete el error del fetch dentro de PostgrestError.message.
    for (const crudo of [
      'TypeError: Failed to fetch',
      'NetworkError when attempting to fetch resource',
      'Load failed',
      'net::ERR_INTERNET_DISCONNECTED',
    ]) {
      const error = new ErrorSupabase('listar palets', errorDePostgres(crudo, ''))

      expect(error.message).not.toContain('fetch')
      expect(error.message).toContain('conectar con el servidor')
    }
  })

  it('usa el contexto cuando la base no dice nada', () => {
    const error = new ErrorSupabase('obtener el palet 42', null)

    expect(error.message).toBe('No se pudo obtener el palet 42.')
  })

  it('guarda el código para poder distinguir casos después', () => {
    // `PGRST116` es lo que permite mostrar «no existe el palet» en lugar del
    // error crudo de Postgres.
    const error = new ErrorSupabase('obtener', errorDePostgres('no rows', 'PGRST116'))

    expect(error.codigo).toBe('PGRST116')
  })
})

describe('desempaquetar', () => {
  it('devuelve el dato cuando salió todo bien', () => {
    expect(desempaquetar({ data: { id: 1 }, error: null }, 'x')).toEqual({ id: 1 })
  })

  it('lanza cuando la base devolvió error', () => {
    expect(() =>
      desempaquetar({ data: null, error: errorDePostgres('Stock insuficiente') }, 'x'),
    ).toThrow(ErrorSupabase)
  })

  it('lanza si no vino dato ni error', () => {
    // Un `null` inesperado no puede pasar como éxito: la pantalla lo trataría
    // como datos vacíos en lugar de como una falla.
    expect(() => desempaquetar({ data: null, error: null }, 'obtener el palet')).toThrow()
  })
})

describe('desempaquetarLista', () => {
  it('devuelve la lista', () => {
    expect(desempaquetarLista({ data: [1, 2], error: null }, 'x')).toEqual([1, 2])
  })

  it('trata la ausencia de filas como lista vacía, no como error', () => {
    // Un depósito sin palets todavía no es una falla.
    expect(desempaquetarLista({ data: null, error: null }, 'x')).toEqual([])
  })

  it('lanza si la base devolvió error', () => {
    expect(() =>
      desempaquetarLista({ data: null, error: errorDePostgres('permiso denegado') }, 'x'),
    ).toThrow(ErrorSupabase)
  })
})

describe('desempaquetarOpcional', () => {
  it('devuelve null cuando no se encontró la fila', () => {
    // PGRST116 es «no hay filas»: buscar y no encontrar es un resultado válido,
    // no una falla.
    const respuesta = { data: null, error: errorDePostgres('no rows', 'PGRST116') }

    expect(desempaquetarOpcional(respuesta, 'x')).toBeNull()
  })

  it('lanza con cualquier otro error', () => {
    const respuesta = { data: null, error: errorDePostgres('permiso denegado', '42501') }

    expect(() => desempaquetarOpcional(respuesta, 'x')).toThrow(ErrorSupabase)
  })
})
