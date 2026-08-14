import { useState } from 'react'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { Spinner } from '@/components/ui/Spinner'
import { sectoresLibres, useCrearSector, useSectores } from '@/hooks/useSectores'
import type { Galpon } from '@/types'

interface Props {
  galpon: Galpon
  /** Id del sector elegido, o `''` si todavía no eligió. */
  valor: string
  onChange: (sectorId: string) => void
  error?: string
  /**
   * Sector que el palet ocupa hoy. Se ofrece aunque figure ocupado —lo ocupa él
   * mismo—, si no, al editar un palet su propio lugar no aparecería en la lista.
   */
  sectorActualId?: number | null
}

/**
 * Elegir dónde queda un palet.
 *
 * Solo ofrece los sectores **libres**: un sector es un lugar físico y ahí entra
 * un palet y no dos. Mostrar los ocupados y rechazarlos al guardar haría que el
 * operario complete el formulario entero para enterarse al final.
 *
 * El alta de un sector nuevo está acá adentro y no en otra pantalla porque el
 * momento en que se descubre que falta es este: el operario está en el galpón,
 * con el palet en la mano, y el lugar donde lo apoyó no está cargado. Mandarlo a
 * otra pantalla le haría perder lo que ya cargó.
 */
export function SelectorDeSector({
  galpon,
  valor,
  onChange,
  error,
  sectorActualId = null,
}: Props) {
  const { data: sectores, isPending, isError, error: errorDeCarga, refetch } = useSectores(galpon)
  const crear = useCrearSector()

  const [agregando, setAgregando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')

  const libres = sectoresLibres(sectores)
  const actual = (sectores ?? []).find((sector) => sector.id === sectorActualId)

  // El sector propio se suma a la lista: está ocupado, pero por este mismo
  // palet, así que dejarlo afuera lo obligaría a mudarse para poder guardar.
  const opciones = actual !== undefined && !actual.libre ? [actual, ...libres] : libres

  async function agregar() {
    const nombre = nombreNuevo.trim()
    if (nombre === '') return

    const sector = await crear.mutateAsync({ galpon, nombre })

    onChange(String(sector.id))
    setNombreNuevo('')
    setAgregando(false)
  }

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-piedra-500">
        <Spinner tamaño="sm" etiqueta="Cargando sectores" />
        Cargando sectores del galpón {galpon}…
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorMessage
        titulo="No se pudieron cargar los sectores"
        mensaje={errorDeCarga.message}
        onReintentar={() => void refetch()}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Sector"
        error={error}
        ayuda={
          opciones.length === 0
            ? `No queda ningún lugar libre en el galpón ${galpon}.`
            : 'Solo se listan los lugares libres.'
        }
        requerido
      >
        {(props) => (
          <Select
            {...props}
            value={valor}
            onChange={(evento) => onChange(evento.target.value)}
            placeholder={opciones.length === 0 ? 'Sin lugares libres' : 'Elegí un sector'}
            invalido={error !== undefined}
            disabled={opciones.length === 0}
          >
            {opciones.map((sector) => (
              <option key={sector.id} value={String(sector.id)}>
                {sector.nombre}
                {sector.id === sectorActualId && ' (donde está ahora)'}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {agregando ? (
        <div className="flex flex-col gap-2 rounded-lg border border-piedra-200 bg-piedra-50 p-3">
          <Field label={`Nombre del sector nuevo en el galpón ${galpon}`}>
            {(props) => (
              <Input
                {...props}
                value={nombreNuevo}
                onChange={(evento) => setNombreNuevo(evento.target.value)}
                placeholder="Ej. A8"
                maxLength={50}
                autoCapitalize="characters"
                autoCorrect="off"
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
              Agregar
            </Button>
            <Button
              variante="secundario"
              onClick={() => {
                setAgregando(false)
                setNombreNuevo('')
              }}
              disabled={crear.isPending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button variante="fantasma" onClick={() => setAgregando(true)} className="self-start">
          {opciones.length === 0
            ? 'Cargar un sector nuevo'
            : '¿No está el sector? Agregalo'}
        </Button>
      )}
    </div>
  )
}
