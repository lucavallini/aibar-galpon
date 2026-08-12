import { useEffect, useRef, type ReactNode } from 'react'
import { cx } from '@/lib/cx'

interface Props {
  abierto: boolean
  /** Se llama al cerrar con Escape, con el botón, o tocando fuera. */
  onCerrar: () => void
  titulo: string
  /** Impide cerrar sin querer mientras hay una operación en curso. */
  bloqueado?: boolean
  children: ReactNode
}

/**
 * Diálogo modal.
 *
 * Usa el `<dialog>` nativo y no un `<div>` con posición fija: así el navegador
 * se encarga del foco atrapado, del cierre con Escape y de marcar el resto de la
 * página como inerte. Escribir todo eso a mano sale mal casi siempre.
 *
 * En el celular se pega abajo, al alcance del pulgar; desde `sm` se centra.
 */
export function Dialogo({ abierto, onCerrar, titulo, bloqueado = false, children }: Props) {
  const refDialogo = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = refDialogo.current
    if (dialogo === null) return

    // `showModal()` es lo que activa el foco atrapado y el fondo inerte;
    // abrirlo poniendo el atributo `open` a mano no hace nada de eso.
    if (abierto && !dialogo.open) {
      dialogo.showModal()
    } else if (!abierto && dialogo.open) {
      dialogo.close()
    }
  }, [abierto])

  useEffect(() => {
    const dialogo = refDialogo.current
    if (dialogo === null) return

    // El navegador cierra con Escape por su cuenta; esto mantiene sincronizado
    // el estado de React para que no quede creyendo que sigue abierto.
    const alCerrar = () => onCerrar()

    // Mientras hay una operación en curso, Escape no puede cerrar.
    const alIntentarCerrar = (evento: Event) => {
      if (bloqueado) evento.preventDefault()
    }

    dialogo.addEventListener('close', alCerrar)
    dialogo.addEventListener('cancel', alIntentarCerrar)

    return () => {
      dialogo.removeEventListener('close', alCerrar)
      dialogo.removeEventListener('cancel', alIntentarCerrar)
    }
  }, [onCerrar, bloqueado])

  return (
    <dialog
      ref={refDialogo}
      aria-labelledby="titulo-dialogo"
      className={cx(
        // `<dialog>` viene con márgenes automáticos que lo centran; acá se
        // anulan para poder pegarlo abajo en el celular.
        'm-0 w-full max-w-none bg-transparent p-0 backdrop:bg-black/50',
        'mt-auto', // pegado abajo
        'sm:m-auto sm:max-w-md sm:p-4',
      )}
      onClick={(evento) => {
        // Tocar el fondo cierra. El contenido para la propagación, así un click
        // adentro no cuenta como "afuera".
        if (!bloqueado && evento.target === refDialogo.current) onCerrar()
      }}
    >
      <div
        className="flex max-h-[85dvh] flex-col overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-5"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="titulo-dialogo" className="mb-4 text-xl font-semibold text-neutral-900">
          {titulo}
        </h2>

        {children}
      </div>
    </dialog>
  )
}
