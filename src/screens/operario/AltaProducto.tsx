import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCrearProducto } from '@/hooks/useCrearProducto'
import { useProductos } from '@/hooks/useProductos'
import { Card } from '@/components/ui/Card'
import { Form, FormAcciones } from '@/components/ui/Form'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { RUTAS } from '@/rutas'

/**
 * Alta de producto.
 *
 * Un producto es **qué cosa es**, y nada más. Una semilla es un nombre —Soja,
 * Maíz—; un agroquímico es un nombre y su concentración, que es lo que separa
 * dos frascos que dicen lo mismo en la etiqueta.
 *
 * Todo lo demás cambia de partida en partida y por eso vive en el palet: el
 * lote, el híbrido, el calibre, el vencimiento, la cantidad y la unidad en que
 * vino. Cargarlo acá obligaría a crear un producto nuevo por cada camión.
 *
 * El catálogo lo carga el propio operario: hasta que existió esta pantalla
 * había que entrar al panel de Supabase, y eso frenaba el alta de un palet
 * cuando llegaba mercadería de algo que todavía no estaba cargado.
 */

const esquemaProducto = z.object({
  categoria: z.enum(['agroquimico', 'semilla'], {
    message: 'Elegí si es agroquímico o semilla.',
  }),

  nombre: z
    .string()
    .trim()
    .min(1, 'Poné el nombre del producto.')
    .max(150, 'El nombre no puede tener más de 150 caracteres.'),

  concentracion: z
    .string()
    .trim()
    .max(50, 'La concentración no puede tener más de 50 caracteres.'),
})

/** Datos del formulario de alta de producto. */
export type ProductoFormData = z.infer<typeof esquemaProducto>

export function AltaProducto() {
  const navegar = useNavigate()
  const crear = useCrearProducto()
  const { data: productos } = useProductos()

  const [creado, setCreado] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors },
  } = useForm<ProductoFormData>({
    defaultValues: {
      categoria: 'agroquimico',
      nombre: '',
      concentracion: '',
    },
    resolver: zodResolver(esquemaProducto),
  })

  // `useWatch` y no `watch()`: el segundo devuelve una función que el React
  // Compiler no puede memoizar.
  const categoria = useWatch({ control, name: 'categoria' })
  const esAgroquimico = categoria === 'agroquimico'

  // El aviso de éxito se va solo: es una confirmación, no algo que haya que
  // leer y descartar.
  useEffect(() => {
    if (creado === null) return

    const temporizador = setTimeout(() => setCreado(null), 3000)
    return () => clearTimeout(temporizador)
  }, [creado])

  async function guardar(datos: ProductoFormData) {
    // Aviso de duplicado antes de gastar un viaje a la base. No es una garantía:
    // `producto.nombre` no tiene UNIQUE, así que dos operarios cargando lo mismo
    // a la vez pueden duplicarlo igual.
    const yaExiste = productos?.some(
      (producto) =>
        producto.nombre.trim().toLocaleLowerCase('es') ===
        datos.nombre.trim().toLocaleLowerCase('es'),
    )

    if (yaExiste === true) {
      setError('nombre', {
        message: 'Ya hay un producto con ese nombre. Fijate en la lista antes de cargarlo.',
      })
      return
    }

    const producto = await crear.mutateAsync({
      nombre: datos.nombre,
      categoria: datos.categoria,
      // La concentración es de agroquímicos: una semilla no tiene.
      concentracion: esAgroquimico ? datos.concentracion : null,
    })

    setCreado(producto.nombre)
    // Se limpia para poder encadenar varias altas, que es como se carga un
    // catálogo nuevo: uno atrás de otro.
    reset()
  }

  return (
    <Card>
      <h2 className="mb-1 text-xl font-semibold text-piedra-900">Nuevo producto</h2>
      <p className="mb-5 text-base text-piedra-600">
        Cargá el producto una sola vez. Después vas a poder crear todos los palets que
        quieras de él, cada uno con su lote y su cantidad.
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
        {/* La categoría va primero: es lo que decide qué se pregunta abajo. */}
        <Field
          label="Categoría"
          error={errors.categoria?.message}
          ayuda="Define qué datos se piden."
          requerido
        >
          {(props) => (
            <Select {...props} {...register('categoria')}>
              <option value="agroquimico">Agroquímico</option>
              <option value="semilla">Semilla</option>
            </Select>
          )}
        </Field>

        <Field
          label={esAgroquimico ? 'Nombre del producto' : 'Nombre de la semilla'}
          error={errors.nombre?.message}
          ayuda={
            esAgroquimico
              ? 'El nombre comercial, tal como figura en el envase.'
              : 'El cultivo: soja, maíz, girasol. El híbrido va después, en cada palet.'
          }
          requerido
        >
          {(props) => (
            <Input
              {...props}
              {...register('nombre')}
              invalido={errors.nombre !== undefined}
              placeholder={esAgroquimico ? 'Ej. Glifosato' : 'Ej. Maíz'}
              maxLength={150}
              autoComplete="off"
            />
          )}
        </Field>

        {/* Es lo que distingue dos envases que dicen lo mismo: un Glifosato al
            48% y uno al 62% no son el mismo producto ni rinden igual. */}
        {esAgroquimico && (
          <Field
            label="Concentración"
            error={errors.concentracion?.message}
            ayuda="Opcional, pero es lo que separa dos productos del mismo nombre."
          >
            {(props) => (
              <Input
                {...props}
                {...register('concentracion')}
                invalido={errors.concentracion !== undefined}
                placeholder="Ej. 48%"
                maxLength={50}
                autoComplete="off"
              />
            )}
          </Field>
        )}

        {crear.isError && (
          <ErrorMessage
            titulo="No se pudo guardar el producto"
            // Viene de la base: si un jefe intenta crear uno, acá aparece el
            // rechazo de la policy.
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
