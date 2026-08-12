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
 * El catálogo lo carga el propio operario: hasta ahora había que entrar al panel
 * de Supabase para agregar un producto nuevo, y eso frenaba el alta de un palet
 * cuando llegaba mercadería de algo que todavía no estaba cargado.
 *
 * Es un formulario de tres campos y nada más. Un producto es «qué cosa es»
 * —Glifosato 48%—; lo que cambia entre partidas (lote, vencimiento, cantidad)
 * va en el palet, no acá.
 */

/** Sugerencias para no terminar con «kg», «Kg», «kilo» y «kilos» conviviendo. */
const UNIDADES_SUGERIDAS = ['litro', 'kilo', 'bolsa', 'bidón', 'tonelada', 'unidad']

const esquemaProducto = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Poné el nombre del producto.')
    .max(150, 'El nombre no puede tener más de 150 caracteres.'),

  categoria: z.enum(['agroquimico', 'semilla'], {
    message: 'Elegí si es agroquímico o semilla.',
  }),

  marca: z.string().trim().max(100, 'La marca no puede tener más de 100 caracteres.'),

  principioActivo: z
    .string()
    .trim()
    .max(150, 'El principio activo no puede tener más de 150 caracteres.'),

  concentracion: z
    .string()
    .trim()
    .max(50, 'La concentración no puede tener más de 50 caracteres.'),

  unidadMedida: z
    .string()
    .trim()
    .min(1, 'Poné la unidad de medida.')
    .max(20, 'La unidad no puede tener más de 20 caracteres.'),
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
      nombre: '',
      categoria: 'agroquimico',
      unidadMedida: '',
      marca: '',
      principioActivo: '',
      concentracion: '',
    },
    resolver: zodResolver(esquemaProducto),
  })

  // El aviso de éxito se va solo: es una confirmación, no algo que haya que
  // leer y descartar.
  // `useWatch` y no `watch()`: el segundo devuelve una función que el React
  // Compiler no puede memoizar.
  const categoria = useWatch({ control, name: 'categoria' })
  const esAgroquimico = categoria === 'agroquimico'

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
      unidadMedida: datos.unidadMedida,
      marca: datos.marca,
      principioActivo: datos.principioActivo,
      concentracion: datos.concentracion,
    })

    setCreado(producto.nombre)
    // Se limpia para poder encadenar varias altas, que es como se carga un
    // catálogo nuevo: uno atrás de otro.
    reset()
  }

  return (
    <Card>
      <h2 className="mb-1 text-xl font-semibold text-neutral-900">Nuevo producto</h2>
      <p className="mb-5 text-base text-neutral-600">
        Cargá el producto una sola vez. Después vas a poder crear todos los palets que
        quieras de él.
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
        <Field
          label="Nombre del producto"
          error={errors.nombre?.message}
          ayuda="Poné el nombre completo, con la concentración si la tiene."
          requerido
        >
          {(props) => (
            <Input
              {...props}
              {...register('nombre')}
              invalido={errors.nombre !== undefined}
              placeholder="Ej. Glifosato 48%"
              maxLength={150}
              autoComplete="off"
            />
          )}
        </Field>

        <Field label="Categoría" error={errors.categoria?.message} requerido>
          {(props) => (
            <Select {...props} {...register('categoria')}>
              <option value="agroquimico">Agroquímico</option>
              <option value="semilla">Semilla</option>
            </Select>
          )}
        </Field>

        <Field
          label="Marca"
          error={errors.marca?.message}
          ayuda="Opcional. Permite después buscar todo lo de un proveedor."
        >
          {(props) => (
            <Input
              {...props}
              {...register('marca')}
              invalido={errors.marca !== undefined}
              placeholder="Ej. Bayer"
              maxLength={100}
              autoComplete="off"
            />
          )}
        </Field>

        {/* El principio activo es lo que define qué se puede aplicar, y solo
            tiene sentido en agroquímicos: una semilla no tiene. */}
        {esAgroquimico && (
          <>
            <Field
              label="Principio activo"
              error={errors.principioActivo?.message}
              ayuda="Opcional. Sirve para detectar que dos productos distintos son lo mismo."
            >
              {(props) => (
                <Input
                  {...props}
                  {...register('principioActivo')}
                  invalido={errors.principioActivo !== undefined}
                  placeholder="Ej. Glifosato"
                  maxLength={150}
                  autoComplete="off"
                />
              )}
            </Field>

            <Field
              label="Concentración"
              error={errors.concentracion?.message}
              ayuda="Opcional."
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
          </>
        )}

        <Field
          label="Unidad de medida"
          error={errors.unidadMedida?.message}
          ayuda="Cómo se cuenta el stock de este producto."
          requerido
        >
          {(props) => (
            <>
              <Input
                {...props}
                {...register('unidadMedida')}
                invalido={errors.unidadMedida !== undefined}
                placeholder="Ej. litro"
                maxLength={20}
                autoComplete="off"
                list="unidades-sugeridas"
              />
              {/* Sugerencias nativas: guían sin impedir escribir otra cosa. */}
              <datalist id="unidades-sugeridas">
                {UNIDADES_SUGERIDAS.map((unidad) => (
                  <option key={unidad} value={unidad} />
                ))}
              </datalist>
            </>
          )}
        </Field>

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
