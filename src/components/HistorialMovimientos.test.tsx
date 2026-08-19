import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HistorialMovimientos } from '@/components/HistorialMovimientos'
import type { MovimientoConAutor } from '@/types'

/**
 * El historial tiene que cerrar solo: cuánto entró, qué salió y cuánto queda.
 *
 * Sin el alta arriba de todo, la lista empieza con un «−20» sobre un total que
 * no figura en ningún lado, y no hay forma de verificar el stock leyéndola.
 */

const MOVIMIENTO: MovimientoConAutor = {
  id: 3,
  palet_id: 1,
  tipo: 'venta',
  cantidad: 20,
  motivo: null,
  fecha_hora: '2026-08-12T14:35:00Z',
  usuario_id: 'u1',
  corrige_a: null,
  transportista_id: null,
  usuario: { id: 'u1', nombre: 'Ana', rol: 'operario' },
  transportista: null,
}

const ALTA = { fecha: '2026-08-01', cantidad: 100 }

describe('el alta del palet', () => {
  it('aparece con el total que ingresó', () => {
    render(<HistorialMovimientos movimientos={[MOVIMIENTO]} alta={ALTA} unidad="bolsa" />)

    expect(screen.getByText('Alta del palet')).toBeInTheDocument()
    expect(screen.getByText('+100 bolsa')).toBeInTheDocument()
  })

  it('va al final, porque el historial va del más reciente al más viejo', () => {
    render(<HistorialMovimientos movimientos={[MOVIMIENTO]} alta={ALTA} unidad="bolsa" />)

    const filas = screen.getAllByRole('listitem')

    expect(filas).toHaveLength(2)
    expect(filas[1]).toHaveTextContent('Alta del palet')
  })

  it('se muestra también en un palet sin ninguna salida', () => {
    // Es el punto de partida del stock: verlo confirma con cuánto entró.
    render(<HistorialMovimientos movimientos={[]} alta={ALTA} unidad="bolsa" />)

    expect(screen.getByText('Alta del palet')).toBeInTheDocument()
    expect(screen.getByText('+100 bolsa')).toBeInTheDocument()
  })

  it('muestra la fecha sin correrla un día', () => {
    // `new Date('2026-08-01')` se interpreta en UTC y en Argentina imprime el
    // 31/07: el palet aparecería ingresado el día anterior al que se cargó.
    render(<HistorialMovimientos movimientos={[]} alta={ALTA} unidad="bolsa" />)

    expect(screen.getByText(/01\/08\/2026/)).toBeInTheDocument()
  })

  it('no se inventa un alta si la pantalla no la pasa', () => {
    render(<HistorialMovimientos movimientos={[MOVIMIENTO]} unidad="bolsa" />)

    expect(screen.queryByText('Alta del palet')).not.toBeInTheDocument()
  })
})

describe('quién se llevó la mercadería', () => {
  it('lo muestra en la salida', () => {
    render(
      <HistorialMovimientos
        movimientos={[
          {
            ...MOVIMIENTO,
            transportista_id: 4,
            transportista: { id: 4, nombre: 'Diego Mateo' },
          },
        ]}
        unidad="bolsa"
      />,
    )

    expect(screen.getByText(/se lo llev\u00f3 diego mateo/i)).toBeInTheDocument()
  })

  it('no dice nada cuando no se registró', () => {
    render(<HistorialMovimientos movimientos={[MOVIMIENTO]} unidad="bolsa" />)

    expect(screen.queryByText(/se lo llev\u00f3/i)).not.toBeInTheDocument()
  })
})

describe('quién trajo el palet', () => {
  it('lo muestra en el alta', () => {
    render(
      <HistorialMovimientos
        movimientos={[]}
        alta={{ fecha: '2026-08-04', cantidad: 200, transportista: 'Julio Recalde' }}
        unidad="bolsa"
      />,
    )

    expect(screen.getByText(/lo trajo julio recalde/i)).toBeInTheDocument()
  })

  it('no dice nada cuando el palet entró sin transportista', () => {
    render(
      <HistorialMovimientos
        movimientos={[]}
        alta={{ fecha: '2026-08-04', cantidad: 200, transportista: null }}
        unidad="bolsa"
      />,
    )

    expect(screen.queryByText(/lo trajo/i)).not.toBeInTheDocument()
  })
})
