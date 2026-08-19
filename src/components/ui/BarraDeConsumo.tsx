import { cx } from '@/lib/cx'

interface Props {
  /** 0 a 100. Ya viene acotado por `porcentajeRestante()`. */
  porcentaje: number
  /** Invierte los colores para usarla sobre el bloque de marca. */
  sobreOscuro?: boolean
  className?: string
}

/**
 * Barra de cuánto queda de un palet.
 *
 * Es puramente decorativa —`aria-hidden`— y eso es deliberado: al lado siempre
 * va el porcentaje escrito y, más arriba, la cantidad exacta. Anunciarla
 * también haría que el lector de pantalla dijera tres veces el mismo dato.
 *
 * No cambia de color según lo que queda. Un palet por la mitad no es una
 * advertencia —es lo más normal del depósito— y pintarlo de rojo o ámbar le
 * robaría significado a los colores que sí avisan algo: el vencimiento y la
 * baja.
 */
export function BarraDeConsumo({ porcentaje, sobreOscuro = false, className }: Props) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        'h-2 w-full overflow-hidden rounded-full',
        sobreOscuro ? 'bg-marca-800' : 'bg-piedra-200',
        className,
      )}
    >
      <div
        className={cx(
          'h-full rounded-full',
          sobreOscuro ? 'bg-marca-300' : 'bg-marca-700',
        )}
        // El ancho es un dato, no un estilo del diseño: va inline porque
        // cambia con cada palet y no puede salir de una clase de Tailwind.
        style={{ width: `${porcentaje}%` }}
      />
    </div>
  )
}
