import { Spinner } from '@/components/ui/Spinner'

interface Props {
  mensaje?: string
}

/**
 * Espera a pantalla completa.
 *
 * Es lo que se muestra mientras se resuelve la sesión al recargar: sin esto, la
 * app decidiría la redirección antes de saber si hay usuario y se vería el
 * parpadeo hacia el login.
 */
export function LoadingScreen({ mensaje = 'Cargando…' }: Props) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-neutral-50 text-marca-700"
      aria-live="polite"
    >
      <Spinner tamaño="lg" etiqueta={mensaje} />
      <p className="text-base text-neutral-600">{mensaje}</p>
    </div>
  )
}
