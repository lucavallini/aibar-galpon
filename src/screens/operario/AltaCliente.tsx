import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useClientes, useCrearCliente } from '@/hooks/useClientes'
import { Card } from '@/components/ui/Card'
import { Form, FormAcciones } from '@/components/ui/Form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RUTAS } from '@/rutas'

/**
 * Alta de cliente.
 *
 * Los clientes son las empresas cuya mercadería se guarda en el depósito. Un
 * palet sin cliente es mercadería propia de AIBAR.
 */

const esquemaCliente = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Poné el nombre del cliente.')
    .max(150, 'El nombre no puede tener más de 150 caracteres.'),
})

type FormularioCliente = z.infer<typeof esquemaCliente>

export function AltaCliente() {
  const navegar = useNavigate()
  const crear = useCrearCliente()
  const { data: clientes } = useClientes()

  const [creado, setCreado] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormularioCliente>({
    defaultValues: { nombre: '' },
    resolver: zodResolver(esquemaCliente),
  })

  useEffect(() => {
    if (creado === null) return

    const temporizador = setTimeout(() => setCreado(null), 3000)
    return () => clearTimeout(temporizador)
  }, [creado])

  async function guardar(datos: FormularioCliente) {
    // Aviso temprano. La garantía real la da el índice único de la base, que
    // rechaza el duplicado aunque dos operarios lo carguen a la vez.
    const yaExiste = clientes?.some(
      (cliente) =>
        cliente.nombre.trim().toLocaleLowerCase('es') ===
        datos.nombre.trim().toLocaleLowerCase('es'),
    )

    if (yaExiste === true) {
      setError('nombre', { message: 'Ese cliente ya está cargado.' })
      return
    }

    const cliente = await crear.mutateAsync(datos.nombre)
    setCreado(cliente.nombre)
    reset()
  }

  return (
    <Card>
      <h2 className="mb-1 text-xl font-semibold text-piedra-900">Nuevo cliente</h2>
      <p className="mb-5 text-base text-piedra-600">
        Empresas cuya mercadería se guarda en el depósito. Después vas a poder asignarle
        palets.
      </p>

      {creado !== null && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-marca-200 bg-marca-50 px-4 py-3 text-base font-medium text-marca-900"
        >
          «{creado}» quedó cargado.
        </p>
      )}

      <Form onSubmit={(evento) => void handleSubmit(guardar)(evento)}>
        <Field label="Nombre del cliente" error={errors.nombre?.message} requerido>
          {(props) => (
            <Input
              {...props}
              {...register('nombre')}
              invalido={errors.nombre !== undefined}
              placeholder="Ej. Agropecuaria del Sur S.A."
              maxLength={150}
              autoComplete="off"
            />
          )}
        </Field>

        {crear.isError && (
          <ErrorMessage
            titulo="No se pudo guardar el cliente"
            mensaje={crear.error.message}
          />
        )}

        <FormAcciones>
          <Button type="submit" tamaño="lg" cargando={crear.isPending}>
            {crear.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button
            variante="secundario"
            disabled={crear.isPending}
            onClick={() => navegar(RUTAS.operario)}
          >
            Cancelar
          </Button>
        </FormAcciones>
      </Form>
    </Card>
  )
}
