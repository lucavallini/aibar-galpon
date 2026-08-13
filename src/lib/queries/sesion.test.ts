import { describe, expect, it } from 'vitest'
import { aIdentificadorDeCuenta } from '@/lib/queries/sesion'

/**
 * Conversión del DNI al identificador con el que Supabase autentica.
 *
 * Si esta función y la Edge Function que crea las cuentas no coinciden
 * **exactamente**, la persona no puede entrar: el alta guardaría un
 * identificador y el login buscaría otro. Es el punto más frágil del ingreso por
 * DNI, y por eso está probado.
 */

describe('DNI', () => {
  it('lo convierte en el identificador interno', () => {
    expect(aIdentificadorDeCuenta('30123456')).toBe('30123456@aibar.local')
  })

  it('ignora los puntos, que es como se escribe un DNI', () => {
    // La Edge Function limpia igual: los dos lados tienen que llegar al mismo
    // identificador o la cuenta creada no se puede usar.
    expect(aIdentificadorDeCuenta('30.123.456')).toBe('30123456@aibar.local')
  })

  it('ignora los espacios sobrantes', () => {
    expect(aIdentificadorDeCuenta('  30 123 456  ')).toBe('30123456@aibar.local')
  })
})

describe('cuentas anteriores al cambio', () => {
  it('deja pasar un email tal cual', () => {
    // El primer gerente se crea a mano con un correo real: si el login lo
    // tratara como DNI, quedaría afuera de su propio sistema.
    expect(aIdentificadorDeCuenta('jefe@aibar.com.ar')).toBe('jefe@aibar.com.ar')
  })

  it('normaliza las mayúsculas del email', () => {
    expect(aIdentificadorDeCuenta('Jefe@Aibar.com.ar')).toBe('jefe@aibar.com.ar')
  })
})
