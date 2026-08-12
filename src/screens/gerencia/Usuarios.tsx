import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  useCambiarActivo,
  useCambiarRol,
  useCrearUsuario,
  useUsuarios,
} from '@/hooks/useUsuariosAdmin'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Dialogo } from '@/components/ui/Dialogo'
import { Form, FormAcciones } from '@/components/ui/Form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cx } from '@/lib/cx'
import type { Usuario } from '@/types'

/**
 * Gestión de usuarios. **La única escritura del panel administrativo.**
 *
 * Es una excepción deliberada a que el panel sea de solo lectura: sin esto, dar
 * de alta a alguien o cambiarle el rol requiere SQL manual contra la base.
 *
 * El registro público está cerrado a propósito. Si cualquiera pudiera crearse
 * una cuenta, bastaría un script para llenar la base de usuarios basura. Acá el
 * alta la hace el gerente, y pasa por una función del servidor que valida su rol
 * antes de crear nada.
 */

const esquemaUsuario = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Poné el nombre de la persona.')
    .max(100, 'El nombre no puede tener más de 100 caracteres.'),
  email: z.string().trim().email('El email no es válido.'),
  password: z
    .string()
    .min(8, 'La contraseña tiene que tener al menos 8 caracteres.')
    .max(72, 'La contraseña es demasiado larga.'),
  rol: z.enum(['operario', 'jefe']),
})

type FormularioUsuario = z.infer<typeof esquemaUsuario>

interface PropsFila {
  usuario: Usuario
  esUnoMismo: boolean
  onCambiarRol: (rol: 'operario' | 'jefe') => void
  onCambiarActivo: (activo: boolean) => void
  ocupado: boolean
}

function FilaUsuario({
  usuario,
  esUnoMismo,
  onCambiarRol,
  onCambiarActivo,
  ocupado,
}: PropsFila) {
  return (
    <Card className={cx(!usuario.activo && 'bg-neutral-50 opacity-75')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">
            {usuario.nombre}
            {esUnoMismo && <span className="ml-2 text-sm text-neutral-500">(vos)</span>}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variante={usuario.rol === 'jefe' ? 'info' : 'neutral'}>
              {usuario.rol === 'jefe' ? 'Gerencia' : 'Operario'}
            </Badge>
            {!usuario.activo && <Badge variante="peligro">Sin acceso</Badge>}
          </div>
        </div>
      </div>

      {/* Nadie puede cambiarse el rol ni desactivarse a sí mismo: un gerente que
          se quita el rol por error deja el sistema sin nadie que se lo devuelva.
          La base lo impide igual, pero acá ni siquiera se ofrece. */}
      {!esUnoMismo && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Select
            aria-label={`Rol de ${usuario.nombre}`}
            value={usuario.rol}
            disabled={ocupado}
            onChange={(evento) =>
              onCambiarRol(evento.target.value as 'operario' | 'jefe')
            }
            className="w-auto"
          >
            <option value="operario">Operario</option>
            <option value="jefe">Gerencia</option>
          </Select>

          <Button
            variante={usuario.activo ? 'secundario' : 'primario'}
            disabled={ocupado}
            onClick={() => onCambiarActivo(!usuario.activo)}
          >
            {usuario.activo ? 'Quitar acceso' : 'Dar acceso'}
          </Button>
        </div>
      )}
    </Card>
  )
}

export function Usuarios() {
  const { usuario: usuarioActual } = useAuth()
  const { data: usuarios, isPending, isError, error, refetch } = useUsuarios()

  const cambiarRol = useCambiarRol()
  const cambiarActivo = useCambiarActivo()
  const crear = useCrearUsuario()

  const [creando, setCreando] = useState(false)
  const [creado, setCreado] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormularioUsuario>({
    defaultValues: { nombre: '', email: '', password: '', rol: 'operario' },
    resolver: zodResolver(esquemaUsuario),
  })

  async function guardar(datos: FormularioUsuario) {
    await crear.mutateAsync(datos)

    setCreado(datos.nombre)
    setCreando(false)
    reset()
  }

  function cerrarAlta() {
    setCreando(false)
    setTimeout(() => {
      reset()
      crear.reset()
    }, 150)
  }

  const ocupado = cambiarRol.isPending || cambiarActivo.isPending

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Usuarios</h2>
          <p className="text-sm text-neutral-500">
            Quién puede entrar al sistema y con qué permisos.
          </p>
        </div>
        <Button onClick={() => setCreando(true)}>Agregar usuario</Button>
      </div>

      {creado !== null && (
        <p
          role="status"
          className="rounded-lg border border-marca-200 bg-marca-50 px-4 py-3 text-base font-medium text-marca-900"
        >
          «{creado}» ya puede entrar con el email y la contraseña que cargaste. Decile que
          la cambie la primera vez.
        </p>
      )}

      {(cambiarRol.isError || cambiarActivo.isError) && (
        <ErrorMessage
          titulo="No se pudo aplicar el cambio"
          mensaje={(cambiarRol.error ?? cambiarActivo.error)?.message ?? ''}
        />
      )}

      {isPending ? (
        <div className="flex justify-center py-12 text-marca-700">
          <Spinner tamaño="lg" etiqueta="Cargando usuarios" />
        </div>
      ) : isError ? (
        <ErrorMessage
          titulo="No se pudieron cargar los usuarios"
          mensaje={error.message}
          onReintentar={() => void refetch()}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {usuarios.map((usuario) => (
            <FilaUsuario
              key={usuario.id}
              usuario={usuario}
              esUnoMismo={usuario.id === usuarioActual?.id}
              ocupado={ocupado}
              onCambiarRol={(rol) =>
                cambiarRol.mutate({ usuarioId: usuario.id, rol })
              }
              onCambiarActivo={(activo) =>
                cambiarActivo.mutate({ usuarioId: usuario.id, activo })
              }
            />
          ))}
        </div>
      )}

      <Dialogo
        abierto={creando}
        onCerrar={cerrarAlta}
        bloqueado={crear.isPending}
        titulo="Nuevo usuario"
      >
        <Form onSubmit={(evento) => void handleSubmit(guardar)(evento)}>
          <Field label="Nombre" error={errors.nombre?.message} requerido>
            {(props) => (
              <Input
                {...props}
                {...register('nombre')}
                invalido={errors.nombre !== undefined}
                placeholder="Ej. Juan Pérez"
                autoComplete="off"
              />
            )}
          </Field>

          <Field
            label="Email"
            error={errors.email?.message}
            ayuda="Con este email va a iniciar sesión."
            requerido
          >
            {(props) => (
              <Input
                {...props}
                {...register('email')}
                invalido={errors.email !== undefined}
                type="email"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
              />
            )}
          </Field>

          <Field
            label="Contraseña inicial"
            error={errors.password?.message}
            ayuda="Mínimo 8 caracteres. Pasásela a la persona y pedile que la cambie."
            requerido
          >
            {(props) => (
              <Input
                {...props}
                {...register('password')}
                invalido={errors.password !== undefined}
                type="text"
                autoComplete="off"
              />
            )}
          </Field>

          <Field label="Rol" error={errors.rol?.message} requerido>
            {(props) => (
              <Select {...props} {...register('rol')}>
                <option value="operario">Operario — carga palets y movimientos</option>
                <option value="jefe">Gerencia — solo consulta</option>
              </Select>
            )}
          </Field>

          {crear.isError && (
            <ErrorMessage titulo="No se pudo crear" mensaje={crear.error.message} />
          )}

          <FormAcciones>
            <Button type="submit" tamaño="lg" cargando={crear.isPending}>
              {crear.isPending ? 'Creando…' : 'Crear usuario'}
            </Button>
            <Button variante="secundario" disabled={crear.isPending} onClick={cerrarAlta}>
              Cancelar
            </Button>
          </FormAcciones>
        </Form>
      </Dialogo>
    </div>
  )
}
