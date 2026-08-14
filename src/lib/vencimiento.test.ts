import { describe, expect, it } from 'vitest'
import { formatearAnticipacion } from '@/lib/vencimiento'

/**
 * Cómo se muestra cuánto falta para un vencimiento.
 *
 * Con el aviso a 6 meses, la mitad de los carteles del panel pasan por acá: un
 * error de redondeo se lee como margen que no existe.
 */

describe('cerca del vencimiento', () => {
  it('cuenta en días, que es lo que importa ahí', () => {
    expect(formatearAnticipacion(0)).toBe('0 d')
    expect(formatearAnticipacion(12)).toBe('12 d')
    expect(formatearAnticipacion(60)).toBe('60 d')
  })
})

describe('lejos del vencimiento', () => {
  it('cuenta en meses: «174 d» obliga a hacer la cuenta', () => {
    expect(formatearAnticipacion(61)).toBe('2 meses')
    expect(formatearAnticipacion(174)).toBe('5 meses')
    expect(formatearAnticipacion(180)).toBe('6 meses')
  })

  it('redondea hacia abajo, nunca hacia arriba', () => {
    // Faltando 89 días es preferible leer «2 meses» y que sobre tiempo, a leer
    // «3 meses» y confiarse de un margen que no existe.
    expect(formatearAnticipacion(89)).toBe('2 meses')
  })
})

describe('ya vencido', () => {
  it('no dice un plazo que no existe', () => {
    expect(formatearAnticipacion(-1)).toBe('vencido')
    expect(formatearAnticipacion(-200)).toBe('vencido')
  })
})
