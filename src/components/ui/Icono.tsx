import { cx } from '@/lib/cx'

/**
 * Iconos de la app.
 *
 * Dibujados a mano y no importados de una librería: son ocho, y una dependencia
 * más significaría cargar cientos que nunca se usan en un teléfono con mala
 * señal.
 *
 * Todos comparten trazo de 1.5, extremos redondeados y una caja de 24: puestos
 * uno al lado del otro tienen que leerse como un solo juego, no como recortes
 * de distintos lados.
 */

export type NombreIcono =
  | 'inicio'
  | 'escanear'
  | 'buscar'
  | 'palet'
  | 'producto'
  | 'cliente'
  | 'panel'
  | 'usuarios'
  | 'pendientes'
  | 'salir'

interface Props {
  nombre: NombreIcono
  /** Tamaño en píxeles. 20 para navegación, 24 para accesos grandes. */
  tamaño?: number
  className?: string
}

/** Los trazos de cada icono, sin el `<svg>` que los envuelve. */
const TRAZOS: Record<NombreIcono, React.ReactNode> = {
  // Techo a dos aguas: un galpón, no una casa de suburbio.
  inicio: (
    <>
      <path d="M3 10.5 12 4l9 6.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),

  // Las cuatro esquinas de un visor de cámara.
  escanear: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M4 12h16" />
    </>
  ),

  buscar: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),

  // Tarima vista de frente, con los tacos abajo.
  palet: (
    <>
      <path d="M3 15h18" />
      <path d="M3 19h18" />
      <path d="M6 15v4M12 15v4M18 15v4" />
      <path d="M6 5h12v7H6z" />
    </>
  ),

  // Etiqueta con su ojal.
  producto: (
    <>
      <path d="M20.5 12.5 12 21l-8-8V5.5A1.5 1.5 0 0 1 5.5 4H13l7.5 7.5a.7.7 0 0 1 0 1z" />
      <circle cx="8.5" cy="8.5" r="1.2" />
    </>
  ),

  // Edificio de dos cuerpos.
  cliente: (
    <>
      <path d="M4 20V7l6-3v16" />
      <path d="M10 11h6a1 1 0 0 1 1 1v8" />
      <path d="M3 20h18" />
      <path d="M13 15h1M13 18h1M6.5 9h1M6.5 12h1M6.5 15h1" />
    </>
  ),

  // Barras: el panel es lectura de cifras.
  panel: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6" />
      <path d="M12 20V6" />
      <path d="M17 20v-9" />
    </>
  ),

  usuarios: (
    <>
      <circle cx="10" cy="8" r="3.2" />
      <path d="M3.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.6" />
      <path d="M18 14.5a6.5 6.5 0 0 1 2.5 5.5" />
    </>
  ),

  // Reloj: hay algo esperando su turno.
  pendientes: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),

  salir: (
    <>
      <path d="M15 5.5V4H5v16h10v-1.5" />
      <path d="M11 12h9" />
      <path d="m17 9 3 3-3 3" />
    </>
  ),
}

export function Icono({ nombre, tamaño = 20, className }: Props) {
  return (
    <svg
      width={tamaño}
      height={tamaño}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('shrink-0', className)}
      // Decorativo: siempre va junto a un texto que dice lo mismo.
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
