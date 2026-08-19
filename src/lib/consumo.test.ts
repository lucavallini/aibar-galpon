import { describe, expect, it } from 'vitest'
import { porcentajeRestante } from '@/lib/consumo'

describe('porcentajeRestante', () => {
  it('devuelve 100 en un palet entero', () => {
    expect(porcentajeRestante(2000, 2000)).toBe(100)
  })

  it('devuelve 0 en un palet vacío', () => {
    expect(porcentajeRestante(0, 2000)).toBe(0)
  })

  it('redondea al entero más cercano', () => {
    expect(porcentajeRestante(1240, 2000)).toBe(62)
    expect(porcentajeRestante(1, 3)).toBe(33)
  })

  it('no dice 0 % mientras quede algo en el palet', () => {
    // 2 de 1000 es 0,2 %, que redondeado da 0: mostrarlo así sería decir que el
    // palet está vacío cuando todavía hay mercadería para descontar.
    expect(porcentajeRestante(2, 1000)).toBe(1)
  })

  it('no dice 100 % si ya se despachó algo', () => {
    // 999 de 1000 redondea a 100, pero el palet ya no está entero.
    expect(porcentajeRestante(999, 1000)).toBe(99)
  })

  it('acota por arriba si una corrección dejó más de lo que entró', () => {
    expect(porcentajeRestante(2100, 2000)).toBe(100)
  })

  it('no calcula nada sin una cantidad inicial válida', () => {
    expect(porcentajeRestante(10, 0)).toBeNull()
    expect(porcentajeRestante(10, -5)).toBeNull()
    expect(porcentajeRestante(Number.NaN, 100)).toBeNull()
  })
})
