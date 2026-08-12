import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Field } from '@/components/ui/Field'
import { Form, FormAcciones } from '@/components/ui/Form'
import { EstadoPaletBadge } from '@/components/EstadoPaletBadge'
import { PruebaImpresion } from '@/components/PruebaImpresion'
import { Icono, type NombreIcono } from '@/components/ui/Icono'
import type { EstadoPalet } from '@/types'

/**
 * Catálogo de componentes.
 *
 * Solo se monta en desarrollo (ver `src/rutas.tsx`): no entra al build de
 * producción. Sirve para revisar todos los primitivos y sus estados en una sola
 * pantalla, con el teléfono en la mano, sin depender de las pantallas de negocio.
 */

interface PropsSeccion {
  titulo: string
  children: ReactNode
}

function Seccion({ titulo, children }: PropsSeccion) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="rotulo border-b border-piedra-200 pb-1">{titulo}</h2>
      {children}
    </section>
  )
}

const ESTADOS: EstadoPalet[] = ['activo', 'parcial', 'vacio', 'baja']

const ICONOS: NombreIcono[] = [
  'inicio',
  'escanear',
  'buscar',
  'palet',
  'producto',
  'cliente',
  'panel',
  'usuarios',
  'pendientes',
  'salir',
]

export function CatalogoUI() {
  const [texto, setTexto] = useState('')
  const [conError, setConError] = useState(false)

  return (
    <main className="mx-auto flex h-full max-w-3xl flex-col gap-8 overflow-y-auto bg-piedra-100 p-4">
      <header>
        <h1 className="text-2xl font-bold text-marca-800">Catálogo de componentes</h1>
        <p className="text-base text-piedra-600">
          Solo visible en desarrollo. Todos los controles miden 44&nbsp;px de alto como
          mínimo.
        </p>
      </header>

      <Seccion titulo="Impresión de etiquetas">
        <PruebaImpresion />
      </Seccion>

      <Seccion titulo="Iconos">
        <div className="flex flex-wrap gap-4 text-piedra-700">
          {ICONOS.map((nombre) => (
            <div key={nombre} className="flex w-16 flex-col items-center gap-1">
              <Icono nombre={nombre} tamaño={24} />
              <span className="text-[0.625rem] text-piedra-500">{nombre}</span>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Cifras">
        <div className="flex flex-wrap items-baseline gap-6">
          <p className="cifra text-5xl font-bold text-marca-700">1.240</p>
          <p className="cifra text-3xl font-bold text-piedra-900">88</p>
          <p className="cifra text-xl font-semibold text-piedra-700">#152</p>
        </div>
        <p className="text-sm text-piedra-500">
          Números tabulares: en una columna de cantidades quedan alineados por la coma.
        </p>
      </Seccion>

      <Seccion titulo="Botones">
        <div className="flex flex-wrap gap-3">
          <Button variante="primario">Primario</Button>
          <Button variante="secundario">Secundario</Button>
          <Button variante="peligro">Peligro</Button>
          <Button variante="fantasma">Fantasma</Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button tamaño="lg">Grande</Button>
          <Button cargando>Cargando</Button>
          <Button disabled>Deshabilitado</Button>
          <Button iconoSolo aria-label="Agregar palet">
            +
          </Button>
        </div>

        <Button anchoCompleto tamaño="lg">
          Ancho completo
        </Button>
      </Seccion>

      <Seccion titulo="Formulario">
        <Card>
          <Form onSubmit={(evento) => evento.preventDefault()}>
            <Field label="Lote" ayuda="Como figura en el remito" requerido>
              {(props) => (
                <Input
                  {...props}
                  value={texto}
                  onChange={(evento) => setTexto(evento.target.value)}
                  placeholder="Ej. L-2024-113"
                />
              )}
            </Field>

            <Field
              label="Cantidad"
              error={conError ? 'La cantidad tiene que ser mayor que cero.' : undefined}
              requerido
            >
              {(props) => <Input {...props} type="number" inputMode="decimal" />}
            </Field>

            <Field label="Galpón" requerido>
              {(props) => (
                <Select {...props} placeholder="Elegí un galpón">
                  <option value="1">Galpón 1</option>
                  <option value="2">Galpón 2</option>
                  <option value="3">Galpón 3</option>
                </Select>
              )}
            </Field>

            <Field label="Campo deshabilitado">
              {(props) => <Input {...props} disabled value="No editable" readOnly />}
            </Field>

            <FormAcciones>
              <Button type="submit">Guardar</Button>
              <Button variante="secundario" onClick={() => setConError(!conError)}>
                {conError ? 'Quitar error' : 'Simular error'}
              </Button>
            </FormAcciones>
          </Form>
        </Card>
      </Seccion>

      <Seccion titulo="Estados de palet">
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((estado) => (
            <EstadoPaletBadge key={estado} estado={estado} />
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Badges genéricos">
        <div className="flex flex-wrap gap-2">
          <Badge variante="neutral">Neutral</Badge>
          <Badge variante="exito">Éxito</Badge>
          <Badge variante="advertencia">Advertencia</Badge>
          <Badge variante="peligro">Peligro</Badge>
          <Badge variante="info">Info</Badge>
        </div>
      </Seccion>

      <Seccion titulo="Tarjetas">
        <Card>
          <p className="text-base text-piedra-700">Tarjeta estática.</p>
        </Card>

        <Card comoBoton onClick={() => undefined}>
          <p className="text-base font-medium text-piedra-900">Tarjeta clickeable</p>
          <p className="text-sm text-piedra-500">
            Se enfoca con el teclado porque es un &lt;button&gt; de verdad.
          </p>
        </Card>
      </Seccion>

      <Seccion titulo="Spinners">
        <div className="flex items-center gap-4 text-marca-700">
          <Spinner tamaño="sm" />
          <Spinner tamaño="md" />
          <Spinner tamaño="lg" />
        </div>
      </Seccion>

      <Seccion titulo="Errores">
        <ErrorMessage mensaje="Email o contraseña incorrectos." />
        <ErrorMessage
          titulo="No se pudo cargar el depósito"
          mensaje="Stock insuficiente. Disponible: 12, solicitado: 20"
          onReintentar={() => undefined}
        />
      </Seccion>

      <Seccion titulo="Sin contenido">
        <Card sinPadding>
          <EmptyState
            titulo="No hay palets en este galpón"
            descripcion="Cuando des de alta un palet, va a aparecer acá."
            accion={<Button>Dar de alta un palet</Button>}
          />
        </Card>
      </Seccion>
    </main>
  )
}
