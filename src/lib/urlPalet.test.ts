import { describe, expect, it } from 'vitest'
import { extraerIdDePalet } from '@/lib/urlPalet'

/**
 * Interpretación de lo que devuelve el lector de QR.
 *
 * En un depósito hay códigos por todos lados: remitos de proveedores, códigos de
 * barras de producto, etiquetas de otras empresas. El operario los va a apuntar
 * sin querer, y el sistema tiene que distinguir los suyos sin equivocarse en
 * ninguna de las dos direcciones: no rechazar una etiqueta propia, y no aceptar
 * una ajena como si fuera un palet.
 */

describe('códigos propios', () => {
  it('reconoce la URL impresa en la etiqueta', () => {
    expect(extraerIdDePalet('https://aibar-deposito.netlify.app/p/152')).toBe(152)
  })

  it('tolera la barra final y los espacios del lector', () => {
    expect(extraerIdDePalet('https://aibar-deposito.netlify.app/p/152/')).toBe(152)
    expect(extraerIdDePalet('  https://aibar-deposito.netlify.app/p/152  ')).toBe(152)
  })

  it('acepta la ruta interna, por si se comparte el enlace', () => {
    expect(extraerIdDePalet('https://aibar-deposito.netlify.app/palet/152')).toBe(152)
  })

  it('acepta cualquier dominio', () => {
    // Deliberado: las etiquetas son físicas y quedan pegadas al palet durante
    // meses. Si la app cambia de dominio, validar el host convertiría en basura
    // todas las etiquetas ya impresas.
    expect(extraerIdDePalet('https://otro-dominio.com/p/99')).toBe(99)
    expect(extraerIdDePalet('http://localhost:5173/p/1')).toBe(1)
  })
})

describe('códigos ajenos', () => {
  it('rechaza códigos de barras de producto', () => {
    expect(extraerIdDePalet('7790001234567')).toBeNull()
  })

  it('rechaza URLs que no son de un palet', () => {
    expect(extraerIdDePalet('https://www.mercadolibre.com.ar/producto')).toBeNull()
    expect(extraerIdDePalet('https://aibar-deposito.netlify.app/deposito')).toBeNull()
  })

  it('rechaza texto vacío o basura', () => {
    expect(extraerIdDePalet('')).toBeNull()
    expect(extraerIdDePalet('   ')).toBeNull()
  })
})

describe('ids inválidos', () => {
  it('rechaza el cero y los negativos', () => {
    // No existe el palet 0; un id así solo puede venir de un código corrupto.
    expect(extraerIdDePalet('https://x.com/p/0')).toBeNull()
    expect(extraerIdDePalet('https://x.com/p/-5')).toBeNull()
  })

  it('rechaza lo que no es un número entero', () => {
    expect(extraerIdDePalet('https://x.com/p/abc')).toBeNull()
    expect(extraerIdDePalet('https://x.com/p/1.5')).toBeNull()
  })

  it('rechaza un id con parámetros pegados', () => {
    // Preferimos no adivinar: un código así no salió de nuestra impresora.
    expect(extraerIdDePalet('https://x.com/p/152?utm=x')).toBeNull()
  })
})
