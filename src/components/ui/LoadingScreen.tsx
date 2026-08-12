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
      className="flex h-full flex-col items-center justify-center gap-3 bg-piedra-100 text-marca-700"
      aria-live="polite"
    >
      <Spinner tamaño="lg" etiqueta={mensaje} />
      <p className="text-base text-piedra-600">{mensaje}</p>
    </div>
  )
}
