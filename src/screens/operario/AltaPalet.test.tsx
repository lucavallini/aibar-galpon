import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AltaPalet } from '@/screens/operario/AltaPalet'
import type * as HooksDeSectores from '@/hooks/useSectores'

/**
 * Alta de palet: que lo tipeado llegue de verdad a la capa de queries.
 *
 * El formulario cambia de campos según el tipo de mercadería, y los limpia al
 * cambiar de tipo. Es fácil que un campo quede registrado pero nunca renderizado
 * —o renderizado pero borrado por la limpieza— y que el dato se pierda en
 * silencio: el palet se crea igual, solo que sin ese dato.
 */

const crearPalet = vi.fn(async () => ({ id: 1 }))
const navegar = vi.fn()

vi.mock('react-router', () => ({ useNavigate: () => navegar }))

vi.mock('@/hooks/useProductos', () => ({
  useProductos: () => ({
    data: [
      { id: 1, nombre: 'Glifosato', categoria: 'agroquimico', concentracion: null },
      // El producto es el cultivo: el híbrido de cada partida va en el palet.
      { id: 2, nombre: 'Maíz', categoria: 'semilla', concentracion: null },
    ],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/useClientes', () => ({ useClientes: () => ({ data: [] }) }))

const crearTransportista = vi.fn()

vi.mock('@/hooks/useTransportistas', () => ({
  useTransportistas: () => ({
    data: [{ id: 4, nombre: 'Diego Mateo', empresa: null }],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useEmpresasDeTransporte: () => ({ data: [] }),
  useCrearTransportista: () => ({
    mutateAsync: crearTransportista,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

const crearSector = vi.fn()

vi.mock('@/hooks/useSectores', async (importarOriginal) => ({
  // `sectoresLibres` es una función pura sobre la lista: se usa la de verdad.
  ...(await importarOriginal<typeof HooksDeSectores>()),
  useSectores: () => ({
    data: [
      { id: 7, galpon: 1, nombre: 'A1', activo: true, palet_id: null, palet_lote: null, libre: true },
      { id: 8, galpon: 1, nombre: 'A2', activo: true, palet_id: 3, palet_lote: 'L-3', libre: false },
    ],
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCrearSector: () => ({ mutateAsync: crearSector, isPending: false, isError: false, error: null }),
}))

const crearLote = vi.fn(async () => [{ id: 10 }, { id: 11 }])

vi.mock('@/hooks/useCrearPalet', () => ({
  useCrearPalet: () => ({ mutateAsync: crearPalet, isPending: false, isError: false, error: null }),
  useCrearLoteDePalets: () => ({
    mutateAsync: crearLote,
    isPending: false,
    isError: false,
    error: null,
  }),
}))

/**
 * Completa lo que piden todos los palets, sea del tipo que sea.
 *
 * El lote se busca por dos etiquetas porque es una sola columna con dos nombres
 * según la mercadería: «número de lote» en el agroquímico del remito, «batch» en
 * la bolsa de semilla.
 */
async function completarCamposComunes(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText(/número de lote|^batch/i), 'L-001')
  await usuario.type(screen.getByLabelText(/^cantidad/i), '50')
  // Obligatorio: un sector admite un solo palet, y sin ubicación no hay forma
  // de saber si el lugar está libre.
  await usuario.selectOptions(screen.getByLabelText(/^sector/i), '7')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('palet de semilla', () => {
  it('manda producto, híbrido, batch, calibre y unidad', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.selectOptions(screen.getByLabelText(/tipo de mercadería/i), 'semilla')
    await usuario.selectOptions(screen.getByLabelText(/^producto/i), '2')
    await usuario.type(screen.getByLabelText(/^híbrido/i), 'DK 7210')
    await completarCamposComunes(usuario)
    await usuario.type(screen.getByLabelText(/calibre/i), 'M')
    await usuario.selectOptions(screen.getByLabelText(/unidad de medida/i), 'kilo')

    await usuario.click(screen.getByRole('button', { name: /dar de alta/i }))

    await waitFor(() => {
      expect(crearPalet).toHaveBeenCalledWith(
        expect.objectContaining({
          productoId: 2,
          hibrido: 'DK 7210',
          calibre: 'M',
          lote: 'L-001',
          cantidadInicial: 50,
          // La unidad es del palet: esta misma semilla puede entrar en bolsas
          // la próxima vez.
          unidadMedida: 'kilo',
          sectorId: 7,
        }),
      )
    })
  })

  it('pide el producto y además el híbrido: son dos datos distintos', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.selectOptions(screen.getByLabelText(/tipo de mercadería/i), 'semilla')

    // El producto es el cultivo —Maíz— y se carga una vez; el híbrido es la
    // variedad que vino en este palet y cambia de camión a camión.
    expect(screen.getByLabelText(/^producto/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^híbrido/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^batch/i)).toBeInTheDocument()
  })

  it('solo ofrece semillas en el selector de producto', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.selectOptions(screen.getByLabelText(/tipo de mercadería/i), 'semilla')

    const opciones = Array.from(
      screen.getByLabelText(/^producto/i).querySelectorAll('option'),
    ).map((opcion) => opcion.textContent)

    expect(opciones).toContain('Maíz')
    expect(opciones).not.toContain('Glifosato')
  })

  it('no deja dar de alta sin híbrido', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.selectOptions(screen.getByLabelText(/tipo de mercadería/i), 'semilla')
    await completarCamposComunes(usuario)
    // Sin híbrido a propósito.

    await usuario.click(screen.getByRole('button', { name: /dar de alta/i }))

    expect(await screen.findByText(/híbrido de la semilla/i)).toBeInTheDocument()
    expect(crearPalet).not.toHaveBeenCalled()
  })
})

describe('palet de agroquímico', () => {
  it('manda el producto elegido, el lote y las fechas', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.selectOptions(screen.getByLabelText(/^producto/i), '1')
    await completarCamposComunes(usuario)
    await usuario.type(screen.getByLabelText(/vencimiento/i), '2027-01-01')

    await usuario.click(screen.getByRole('button', { name: /dar de alta/i }))

    await waitFor(() => {
      expect(crearPalet).toHaveBeenCalledWith(
        expect.objectContaining({
          productoId: 1,
          lote: 'L-001',
          fechaVencimiento: '2027-01-01',
          cantidadInicial: 50,
          // La que viene puesta de entrada, sin tocar el select.
          unidadMedida: 'bolsa',
        }),
      )
    })
  })
})

describe('alta de producto', () => {
  it('no se ofrece desde el alta de palet', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    // El acceso vive en la barra de navegación. Acá adentro solo sacaba al
    // operario de un formulario a medio llenar.
    expect(screen.queryByRole('button', { name: /producto/i })).not.toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText(/tipo de mercadería/i), 'semilla')

    expect(screen.queryByRole('button', { name: /producto/i })).not.toBeInTheDocument()
  })
})

describe('sector', () => {
  it('no deja dar de alta sin ubicación', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.selectOptions(screen.getByLabelText(/^producto/i), '1')
    await usuario.type(screen.getByLabelText(/número de lote/i), 'L-001')
    await usuario.type(screen.getByLabelText(/^cantidad/i), '50')
    await usuario.type(screen.getByLabelText(/vencimiento/i), '2027-01-01')
    // Sin sector a propósito.

    await usuario.click(screen.getByRole('button', { name: /dar de alta/i }))

    // Un palet sin ubicación no ocupa ningún lugar para la base, así que dos
    // podrían quedar en el mismo estante sin que nada lo impida.
    expect(await screen.findByText(/elegí en qué sector/i)).toBeInTheDocument()
    expect(crearPalet).not.toHaveBeenCalled()
  })
})

describe('sectores ocupados', () => {
  it('no los ofrece: en un sector entra un palet y no dos', async () => {
    render(<AltaPalet />)

    const opciones = await screen.findAllByRole('option')
    const nombres = opciones.map((opcion) => opcion.textContent)

    // 'A2' está ocupado por el palet 3. Ofrecerlo haría que el operario complete
    // el formulario entero para que la base se lo rechace al guardar.
    expect(nombres).toContain('A1')
    expect(nombres).not.toContain('A2')
  })
})

describe('alta de un lote', () => {
  it('manda el total y en cuántos palets se reparte, sin sector', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.selectOptions(screen.getByLabelText(/^producto/i), '1')
    await usuario.type(screen.getByLabelText(/número de lote|^batch/i), 'L-001')
    await usuario.type(screen.getByLabelText(/^cantidad/i), '10000')
    await usuario.type(screen.getByLabelText(/vencimiento/i), '2027-01-01')

    const cuantos = screen.getByLabelText(/cuántos palets/i)
    await usuario.clear(cuantos)
    await usuario.type(cuantos, '10')

    await usuario.click(screen.getByRole('button', { name: /crear 10 palets/i }))

    await waitFor(() => {
      expect(crearLote).toHaveBeenCalledWith(
        expect.objectContaining({
          productoId: 1,
          // El total viaja entero: el reparto lo hace la base.
          cantidadInicial: 10_000,
          cantidadPalets: 10,
          galpon: 1,
        }),
      )
    })

    // El alta de a uno no se dispara: son caminos distintos.
    expect(crearPalet).not.toHaveBeenCalled()
  })

  it('esconde el selector de sector y avisa que quedan sin ubicar', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    const cuantos = screen.getByLabelText(/cuántos palets/i)
    await usuario.clear(cuantos)
    await usuario.type(cuantos, '10')

    expect(screen.queryByLabelText(/^sector/i)).not.toBeInTheDocument()
    expect(screen.getByText(/sin ubicar/i)).toBeInTheDocument()
  })

  it('muestra cuánto va a quedar en cada palet antes de crearlos', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.type(screen.getByLabelText(/^cantidad/i), '100')

    const cuantos = screen.getByLabelText(/cuántos palets/i)
    await usuario.clear(cuantos)
    await usuario.type(cuantos, '3')

    // Si el total estaba mal, se descubre acá y no con diez etiquetas impresas.
    expect(await screen.findByText(/3 palets de 33\.33/i)).toBeInTheDocument()
    expect(screen.getByText(/el último lleva 33\.34/i)).toBeInTheDocument()
  })

  it('con un solo palet sigue pidiendo el sector, como siempre', async () => {
    render(<AltaPalet />)

    expect(screen.getByLabelText(/^sector/i)).toBeInTheDocument()
  })
})

describe('quién trajo la mercadería', () => {
  it('se manda con el alta cuando se elige', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.selectOptions(screen.getByLabelText(/^producto/i), '1')
    await completarCamposComunes(usuario)
    await usuario.type(screen.getByLabelText(/vencimiento/i), '2027-01-01')
    await usuario.selectOptions(screen.getByLabelText(/qui\u00e9n trajo/i), '4')

    await usuario.click(screen.getByRole('button', { name: /dar de alta/i }))

    await waitFor(() => {
      expect(crearPalet).toHaveBeenCalledWith(
        expect.objectContaining({ transportistaId: 4 }),
      )
    })
  })

  it('no traba el alta si no se sabe quién fue', async () => {
    const usuario = userEvent.setup()
    render(<AltaPalet />)

    await usuario.selectOptions(screen.getByLabelText(/^producto/i), '1')
    await completarCamposComunes(usuario)
    await usuario.type(screen.getByLabelText(/vencimiento/i), '2027-01-01')
    // Sin tocar el selector de chofer.

    await usuario.click(screen.getByRole('button', { name: /dar de alta/i }))

    await waitFor(() => {
      expect(crearPalet).toHaveBeenCalledWith(
        expect.objectContaining({ transportistaId: null }),
      )
    })
  })
})
