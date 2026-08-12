import { Badge, type VarianteBadge } from '@/components/ui/Badge'
import type { EstadoPalet } from '@/types'

interface Props {
  estado: EstadoPalet
}

/**
 * Presentación de `palet.estado`.
 *
 * Vive fuera de `ui/` porque conoce el dominio: traduce los valores que guarda
 * la base a una etiqueta legible —con la tilde de "vacío", que el valor de la
 * columna no tiene— y a una variante de `Badge`. Así el primitivo se mantiene
 * genérico y reutilizable para cualquier otro estado.
 *
 * El estado lo gobiernan los triggers y las funciones de stock de la base; acá
 * solo se muestra.
 */
const PRESENTACION: Record<EstadoPalet, { etiqueta: string; variante: VarianteBadge }> = {
  activo: { etiqueta: 'Activo', variante: 'exito' },
  parcial: { etiqueta: 'Parcial', variante: 'advertencia' },
  vacio: { etiqueta: 'Vacío', variante: 'neutral' },
  baja: { etiqueta: 'De baja', variante: 'peligro' },
}

export function EstadoPaletBadge({ estado }: Props) {
  const { etiqueta, variante } = PRESENTACION[estado]

  return <Badge variante={variante}>{etiqueta}</Badge>
}
