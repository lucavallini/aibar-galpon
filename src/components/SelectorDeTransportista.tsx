import { useState } from 'react'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Spinner } from '@/components/ui/Spinner'
import {
  useCrearTransportista,
  useEmpresasDeTransporte,
  useTransportistas,
} from '@/hooks/useTransportistas'

interface Props {
  label: string
  /** Id del chofer elegido, o `''` si no hay ninguno. */
  valor: string
  onChange: (transportistaId: string) => void
  ayuda?: string
  error?: string
}

/**
 * Elegir el chofer que trae o que se lleva la mercadería.
 *
 * **Siempre opcional**: si el operario no llegó a preguntar quién era, el alta o
 * la salida se registran igual. Trabar la carga por un dato que no siempre está
 * a mano terminaría en movimientos sin registrar, que es peor que un movimiento
 * sin chofer.
 *
 * El alta de un chofer nuevo va acá adentro, como en `SelectorDeSector`: el
 * momento en que se descubre que falta es este —el camión está en la puerta— y
 * mandarlo a otra pantalla le haría perder lo que ya cargó.
 */
export function SelectorDeTransportista({ label, valor, onChange, ayuda, error }: Props) {
  const {
    data: transportistas,
    isPending,
    isError,
    error: errorDeCarga,
    refetch,
  } = useTransportistas()

  const { data: empresas } = useEmpresasDeTransporte()
  const crear = useCrearTransportista()

  const [agregando, setAgregando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [empresaNueva, setEmpresaNueva] = useState('')
  const [telefonoNuevo, setTelefonoNuevo] = useState('')

  async function agregar() {
    const nombre = nombreNuevo.trim()
    if (nombre === '') return

    const transportista = await crear.mutateAsync({
      nombre,
      empresaTransporteId: empresaNueva === '' ? null : Number(empresaNueva),
      telefono: telefonoNuevo,
    })

    // Queda elegido: es para lo que se lo acaba de cargar.
    onChange(String(transportista.id))
    setNombreNuevo('')
    setEmpresaNueva('')
    setTelefonoNuevo('')
    setAgregando(false)
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-piedra-500">
        <Spinner tamaño="sm" etiqueta="Cargando transportistas" />
        Cargando choferes…
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        titulo="No se pudieron cargar los choferes"
        mensaje={errorDeCarga.message}
        onReintentar={() => void refetch()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label={label} error={error} ayuda={ayuda}>
        {(props) => (
          <Select
            {...props}
            value={valor}
            onChange={(evento) => onChange(evento.target.value)}
            invalido={error !== undefined}
          >
            {/* Sin chofer es una opción válida y explícita, no un olvido. */}
            <option value="">Sin registrar</option>
            {transportistas.map((transportista) => (
              <option key={transportista.id} value={String(transportista.id)}>
                {transportista.nombre}
                {transportista.empresa !== null && ` — ${transportista.empresa.nombre}`}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {agregando ? (
        <div className="flex flex-col gap-3 rounded-lg border border-piedra-200 bg-piedra-50 p-3">
          <Field label="Nombre del chofer" requerido>
            {(props) => (
              <Input
                {...props}
                value={nombreNuevo}
                onChange={(evento) => setNombreNuevo(evento.target.value)}
                placeholder="Ej. Juan Pérez"
                maxLength={150}
                autoComplete="off"
              />
            )}
          </Field>

          <Field label="Empresa de transporte" ayuda="Opcional.">
            {(props) => (
              <Select
                {...props}
                value={empresaNueva}
                onChange={(evento) => setEmpresaNueva(evento.target.value)}
              >
                <option value="">Sin empresa</option>
                {empresas?.map((empresa) => (
                  <option key={empresa.id} value={String(empresa.id)}>
                    {empresa.nombre}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Teléfono" ayuda="Opcional.">
            {(props) => (
              <Input
                {...props}
                value={telefonoNuevo}
                onChange={(evento) => setTelefonoNuevo(evento.target.value)}
                type="tel"
                inputMode="tel"
                placeholder="Ej. 3462504163"
                maxLength={30}
                autoComplete="off"
              />
            )}
          </Field>

          {crear.isError && <ErrorMessage mensaje={crear.error.message} />}

          <div className="flex gap-2">
            <Button
              onClick={() => void agregar()}
              cargando={crear.isPending}
              disabled={nombreNuevo.trim() === ''}
            >
              Guardar chofer
            </Button>
            <Button
              variante="secundario"
              onClick={() => setAgregando(false)}
              disabled={crear.isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variante="fantasma" onClick={() => setAgregando(true)} className="self-start">
          ¿No está el chofer? Agregalo
        </Button>
      )}
    </div>
  )
}
