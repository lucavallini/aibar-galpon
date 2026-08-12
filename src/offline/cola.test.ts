import { beforeEach, describe, expect, it, vi } from 'vitest'
import { obtenerBase } from '@/offline/db'
import {
  contarFallidos,
  contarPendientes,
  devolverAPendiente,
  encolar,
  listarParaSincronizar,
  listarPendientes,
  marcarFallido,
  marcarSincronizando,
  quitar,
  reintentar,
  tienePendientes,
  alCambiarLaCola,
} from '@/offline/cola'

/**
 * La cola es lo que impide que un movimiento se pierda cuando no hay señal.
 *
 * Lo que se prueba acá no es «que guarde»: es que **nada desaparezca sin que
 * alguien lo decida**. Un movimiento borrado por error es mercadería que salió
 * del depósito y que el sistema nunca va a descontar.
 */

const MOVIMIENTO = {
  paletId: 152,
  tipo: 'venta' as const,
  cantidad: 20,
  paletEtiqueta: 'Palet #152 · Glifosato 48%',
  unidad: 'litro',
}

beforeEach(async () => {
  // Se vacía el almacén en vez de borrar la base: `deleteDB` se queda esperando
  // a que se cierren las conexiones abiertas, y el módulo mantiene una viva a
  // propósito durante toda la vida de la app.
  const base = await obtenerBase()
  await base.clear('movimientos-pendientes')
})

describe('encolar', () => {
  it('guarda el movimiento con estado pendiente y sin intentos', async () => {
    const pendiente = await encolar(MOVIMIENTO)

    expect(pendiente.estado).toBe('pendiente')
    expect(pendiente.intentos).toBe(0)
    expect(pendiente.paletId).toBe(152)
    expect(pendiente.cantidad).toBe(20)
  })

  it('copia los datos del palet para poder identificarlo después', async () => {
    // Si el movimiento falla horas más tarde y sin señal, hay que poder decir
    // de qué palet era sin consultar la base.
    const pendiente = await encolar(MOVIMIENTO)

    expect(pendiente.paletEtiqueta).toBe('Palet #152 · Glifosato 48%')
    expect(pendiente.unidad).toBe('litro')
  })

  it('le da un id propio a cada uno, aunque sean idénticos', async () => {
    const uno = await encolar(MOVIMIENTO)
    const otro = await encolar(MOVIMIENTO)

    // Dos ventas iguales del mismo palet son dos movimientos distintos, no uno
    // repetido: descontar 20 dos veces es descontar 40.
    expect(uno.id).not.toBe(otro.id)
    expect(await contarPendientes()).toBe(2)
  })
})

describe('orden de la cola', () => {
  it('devuelve los movimientos del más viejo al más nuevo', async () => {
    const primero = await encolar({ ...MOVIMIENTO, cantidad: 10 })
    await new Promise((r) => setTimeout(r, 2))
    const segundo = await encolar({ ...MOVIMIENTO, cantidad: 5 })

    const cola = await listarPendientes()

    // El orden importa de verdad: si se mandan al revés, el segundo puede ser
    // rechazado por un stock que el primero todavía no descontó.
    expect(cola.map((m) => m.id)).toEqual([primero.id, segundo.id])
  })
})

describe('sincronización exitosa', () => {
  it('saca el movimiento de la cola', async () => {
    const pendiente = await encolar(MOVIMIENTO)
    await quitar(pendiente.id)

    expect(await listarPendientes()).toHaveLength(0)
  })

  it('marcarlo como sincronizando no lo saca de la cola', async () => {
    // Nada se borra antes de la confirmación de la base, ni siquiera mientras
    // se está mandando: si se corta la señal a mitad, tiene que seguir ahí.
    const pendiente = await encolar(MOVIMIENTO)
    await marcarSincronizando(pendiente.id)

    const cola = await listarPendientes()
    expect(cola).toHaveLength(1)
    expect(cola[0]?.estado).toBe('sincronizando')
  })
})

describe('rechazo de la base', () => {
  it('conserva el movimiento y guarda el motivo', async () => {
    const pendiente = await encolar(MOVIMIENTO)
    await marcarFallido(pendiente.id, 'Stock insuficiente. Disponible: 5, solicitado: 20')

    const cola = await listarPendientes()

    // Descartar en silencio un movimiento rechazado es perder mercadería que
    // salió del depósito. Tiene que quedar, con el motivo, para que alguien
    // decida.
    expect(cola).toHaveLength(1)
    expect(cola[0]?.estado).toBe('fallido')
    expect(cola[0]?.error).toContain('Stock insuficiente')
  })

  it('cuenta el intento', async () => {
    const pendiente = await encolar(MOVIMIENTO)
    await marcarFallido(pendiente.id, 'error')

    const cola = await listarPendientes()
    expect(cola[0]?.intentos).toBe(1)
  })

  it('no lo incluye entre los que se van a reintentar solos', async () => {
    const pendiente = await encolar(MOVIMIENTO)
    await marcarFallido(pendiente.id, 'Stock insuficiente')

    // Un rechazo de negocio no mejora reintentando: quedaría en un ciclo.
    expect(await listarParaSincronizar()).toHaveLength(0)
    expect(await contarFallidos()).toBe(1)
    expect(await contarPendientes()).toBe(0)
  })

  it('vuelve a la cola si el operario lo reintenta a mano', async () => {
    const pendiente = await encolar(MOVIMIENTO)
    await marcarFallido(pendiente.id, 'Stock insuficiente')
    await reintentar(pendiente.id)

    const cola = await listarPendientes()
    expect(cola[0]?.estado).toBe('pendiente')
    // El motivo viejo se limpia: si vuelve a fallar, será por otra razón.
    expect(cola[0]?.error).toBeUndefined()
    expect(await listarParaSincronizar()).toHaveLength(1)
  })
})

describe('corte de red a mitad de la sincronización', () => {
  it('devuelve el movimiento a pendiente sin contarlo como fallido', async () => {
    const pendiente = await encolar(MOVIMIENTO)
    await marcarSincronizando(pendiente.id)
    await devolverAPendiente(pendiente.id)

    const cola = await listarPendientes()

    // No fue la base la que lo rechazó: no corresponde marcarlo como fallido
    // ni gastarle un intento.
    expect(cola[0]?.estado).toBe('pendiente')
    expect(cola[0]?.intentos).toBe(0)
  })
})

describe('stock que puede cambiar', () => {
  it('avisa si un palet tiene movimientos sin sincronizar', async () => {
    await encolar(MOVIMIENTO)

    // Es lo que hace que la pantalla no muestre el stock como si fuera el real.
    expect(await tienePendientes(152)).toBe(true)
    expect(await tienePendientes(999)).toBe(false)
  })

  it('deja de avisar cuando el movimiento se sincroniza', async () => {
    const pendiente = await encolar(MOVIMIENTO)
    await quitar(pendiente.id)

    expect(await tienePendientes(152)).toBe(false)
  })
})

describe('avisos a la interfaz', () => {
  it('notifica cada cambio de la cola', async () => {
    const oyente = vi.fn()
    const dejarDeEscuchar = alCambiarLaCola(oyente)

    const pendiente = await encolar(MOVIMIENTO)
    expect(oyente).toHaveBeenCalledTimes(1)

    await marcarFallido(pendiente.id, 'error')
    expect(oyente).toHaveBeenCalledTimes(2)

    await quitar(pendiente.id)
    expect(oyente).toHaveBeenCalledTimes(3)

    dejarDeEscuchar()
    await encolar(MOVIMIENTO)
    // Ya no escucha: sin esto, un componente desmontado seguiría reaccionando.
    expect(oyente).toHaveBeenCalledTimes(3)
  })
})
