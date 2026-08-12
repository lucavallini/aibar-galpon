import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PostgrestError } from '@supabase/supabase-js'
import { ErrorSupabase } from '@/lib/queries/errores'

/**
 * El sincronizador decide qué pasa con cada movimiento encolado.
 *
 * Toda su lógica se apoya en una distinción: **falló la red** o **la base lo
 * rechazó**. Confundirlas es lo que hace que un movimiento se pierda —si un
 * corte de red se trata como rechazo, queda marcado como fallido para siempre—
 * o que quede dando vueltas para siempre —si un «Stock insuficiente» se trata
 * como corte, se reintenta eternamente—.
 */

const { mockRegistrar } = vi.hoisted(() => ({ mockRegistrar: vi.fn() }))

vi.mock('@/lib/queries/movimientos', () => ({
  registrarMovimiento: mockRegistrar,
}))

const { encolar, listarPendientes, contarFallidos, contarPendientes } = await import(
  '@/offline/cola'
)
const { sincronizar } = await import('@/offline/sincronizador')
const { obtenerBase } = await import('@/offline/db')

const MOVIMIENTO = {
  paletId: 152,
  tipo: 'venta' as const,
  cantidad: 20,
  paletEtiqueta: 'Palet #152 · Glifosato',
  unidad: 'litro',
}

function errorDeNegocio(mensaje: string): ErrorSupabase {
  const postgrest = {
    message: mensaje,
    code: 'P0001',
    details: '',
    hint: '',
    name: 'PostgrestError',
  } as PostgrestError

  return new ErrorSupabase('registrar el movimiento', postgrest)
}

beforeEach(async () => {
  const base = await obtenerBase()
  await base.clear('movimientos-pendientes')
  mockRegistrar.mockReset()
  vi.stubGlobal('navigator', { onLine: true })
})

describe('cuando la base acepta', () => {
  it('saca los movimientos de la cola', async () => {
    await encolar(MOVIMIENTO)
    await encolar({ ...MOVIMIENTO, cantidad: 5 })
    mockRegistrar.mockResolvedValue({ id: 1 })

    const resultado = await sincronizar()

    expect(resultado.sincronizados).toBe(2)
    expect(await listarPendientes()).toHaveLength(0)
  })

  it('los manda de a uno y en orden de creación', async () => {
    await encolar({ ...MOVIMIENTO, cantidad: 10 })
    await new Promise((r) => setTimeout(r, 2))
    await encolar({ ...MOVIMIENTO, cantidad: 3 })
    mockRegistrar.mockResolvedValue({ id: 1 })

    await sincronizar()

    // Si se mandaran en paralelo o desordenados, el segundo podría rechazarse
    // por un stock que el primero todavía no descontó.
    expect(mockRegistrar.mock.calls[0]?.[0]).toMatchObject({ cantidad: 10 })
    expect(mockRegistrar.mock.calls[1]?.[0]).toMatchObject({ cantidad: 3 })
  })
})

describe('cuando la base rechaza', () => {
  it('marca el movimiento como fallido y guarda el motivo', async () => {
    await encolar(MOVIMIENTO)
    mockRegistrar.mockRejectedValue(
      errorDeNegocio('Stock insuficiente. Disponible: 5, solicitado: 20'),
    )

    const resultado = await sincronizar()

    expect(resultado.fallidos).toBe(1)
    expect(resultado.sincronizados).toBe(0)

    const cola = await listarPendientes()
    expect(cola[0]?.estado).toBe('fallido')
    expect(cola[0]?.error).toContain('Stock insuficiente')
  })

  it('nunca lo descarta', async () => {
    await encolar(MOVIMIENTO)
    mockRegistrar.mockRejectedValue(errorDeNegocio('El palet se encuentra dado de baja'))

    await sincronizar()

    // Ese movimiento representa mercadería que salió del depósito: si se
    // borrara solo, el stock del sistema quedaría más alto que el real y nadie
    // se enteraría.
    expect(await listarPendientes()).toHaveLength(1)
  })

  it('sigue con los demás en vez de frenar', async () => {
    await encolar(MOVIMIENTO)
    await new Promise((r) => setTimeout(r, 2))
    await encolar({ ...MOVIMIENTO, paletId: 200 })

    mockRegistrar
      .mockRejectedValueOnce(errorDeNegocio('Stock insuficiente'))
      .mockResolvedValueOnce({ id: 2 })

    const resultado = await sincronizar()

    // Un rechazo es problema de ese movimiento, no de la cola: los otros no
    // tienen por qué quedarse esperando.
    expect(resultado.fallidos).toBe(1)
    expect(resultado.sincronizados).toBe(1)
  })
})

describe('cuando se corta la red', () => {
  it('devuelve el movimiento a la cola sin marcarlo como fallido', async () => {
    await encolar(MOVIMIENTO)
    mockRegistrar.mockRejectedValue(new TypeError('Failed to fetch'))

    const resultado = await sincronizar()

    expect(resultado.fallidos).toBe(0)
    expect(await contarFallidos()).toBe(0)
    expect(await contarPendientes()).toBe(1)

    // No gasta un intento: no fue culpa del movimiento.
    const cola = await listarPendientes()
    expect(cola[0]?.intentos).toBe(0)
  })

  it('frena el recorrido para no romper el orden', async () => {
    await encolar(MOVIMIENTO)
    await new Promise((r) => setTimeout(r, 2))
    await encolar({ ...MOVIMIENTO, cantidad: 5 })

    mockRegistrar.mockRejectedValue(new TypeError('Failed to fetch'))

    await sincronizar()

    // Si el primero no entró por falta de red, el segundo tampoco va a entrar:
    // seguir intentando solo desordena la cola.
    expect(mockRegistrar).toHaveBeenCalledTimes(1)
    expect(await contarPendientes()).toBe(2)
  })

  it('reconoce el corte aunque venga envuelto en un ErrorSupabase', async () => {
    await encolar(MOVIMIENTO)

    // supabase-js mete el fallo del fetch dentro de su propio error, sin código.
    const sinCodigo = {
      message: 'TypeError: Failed to fetch',
      code: '',
      details: '',
      hint: '',
      name: 'PostgrestError',
    } as PostgrestError
    mockRegistrar.mockRejectedValue(new ErrorSupabase('registrar', sinCodigo))

    await sincronizar()

    expect(await contarFallidos()).toBe(0)
    expect(await contarPendientes()).toBe(1)
  })

  it('no intenta nada si el navegador ya sabe que no hay señal', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    await encolar(MOVIMIENTO)

    const resultado = await sincronizar()

    expect(mockRegistrar).not.toHaveBeenCalled()
    expect(resultado.pospuestos).toBe(1)
  })
})

describe('llamadas simultáneas', () => {
  it('no manda el mismo movimiento dos veces', async () => {
    await encolar(MOVIMIENTO)
    mockRegistrar.mockImplementation(
      () => new Promise((r) => setTimeout(() => r({ id: 1 }), 20)),
    )

    // El botón «sincronizar ahora» y el evento `online` pueden dispararse
    // juntos: descontar dos veces el mismo stock sería un faltante inventado.
    const [uno, otro] = await Promise.all([sincronizar(), sincronizar()])

    expect(mockRegistrar).toHaveBeenCalledTimes(1)
    expect(uno.sincronizados + otro.sincronizados).toBe(1)
  })
})
