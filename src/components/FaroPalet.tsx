import type { ReactNode } from 'react'
import { BarraDeConsumo } from '@/components/ui/BarraDeConsumo'
import { porcentajeRestante } from '@/lib/consumo'
import { cx } from '@/lib/cx'

interface Props {
  disponible: number
  inicial: number
  unidad: string
  /** Barra superior del bloque: volver, número de palet, lo que haga falta. */
  encabezado?: ReactNode
  /**
   * Apaga el color de marca. Va cuando el palet no tiene stock o está dado de
   * baja: el verde lleno significa «acá hay mercadería», y usarlo para un palet
   * vacío diría lo contrario de lo que pasa.
   */
  apagado?: boolean
  className?: string
}

/**
 * El bloque que abre la pantalla de un palet: cuánto queda, en grande.
 *
 * La cifra no está dentro de una tarjeta sino que ES el encabezado, sobre color
 * lleno y a sangre. El motivo es el del depósito: se mira el teléfono con el
 * palet delante, a veces a un brazo de distancia y con sol de frente, y lo que
 * se necesita saber en ese segundo es uno solo de los datos de la pantalla.
 *
 * La barra y el porcentaje acompañan a la cifra, no la reemplazan: dicen de un
 * vistazo si el palet está entero, por la mitad o casi vacío, que es lo que no
 * se deduce de «1.240» sin conocer con cuánto entró.
 */
export function FaroPalet({
  disponible,
  inicial,
  unidad,
  encabezado,
  apagado = false,
  className,
}: Props) {
  const porcentaje = porcentajeRestante(disponible, inicial)

  return (
    <div
      className={cx(
        '-mx-4 px-4 py-4 sm:-mx-6 sm:px-6',
        apagado ? 'bg-piedra-700' : 'bg-marca-700',
        className,
      )}
    >
      {encabezado !== undefined && <div className="mb-4">{encabezado}</div>}

      <p className={cx('rotulo', apagado ? 'text-piedra-300' : 'text-marca-300')}>
        Disponible
      </p>

      <p className="mt-1 flex items-baseline gap-2">
        <span className="cifra text-6xl leading-none font-extrabold text-white sm:text-7xl">
          {disponible}
        </span>
        <span
          className={cx(
            'text-2xl font-semibold',
            apagado ? 'text-piedra-300' : 'text-marca-200',
          )}
        >
          {unidad}
        </span>
      </p>

      {/* Sin cantidad inicial válida no hay proporción que mostrar, así que se
          muestra solo el dato crudo en vez de una barra que no significa nada. */}
      {porcentaje !== null ? (
        <>
          <BarraDeConsumo porcentaje={porcentaje} sobreOscuro className="mt-4" />

          <div className="mt-2 flex items-center justify-between gap-3">
            <span
              className={cx(
                'cifra text-sm',
                apagado ? 'text-piedra-300' : 'text-marca-200',
              )}
            >
              Entraron {inicial} {unidad}
            </span>
            <span className="cifra text-sm font-semibold text-white">
              Queda el {porcentaje} %
            </span>
          </div>
        </>
      ) : (
        <p
          className={cx(
            'cifra mt-3 text-sm',
            apagado ? 'text-piedra-300' : 'text-marca-200',
          )}
        >
          Entraron {inicial} {unidad}
        </p>
      )}
    </div>
  )
}
