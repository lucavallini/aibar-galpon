import type { FormHTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/cx'

interface Props extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode
}

/**
 * Contenedor de formulario con el espaciado vertical estandarizado.
 *
 * Va con `noValidate`: la validación del navegador muestra burbujas en inglés y
 * fuera de nuestro control. La validación de campo la hacemos nosotros por UX
 * (con `Field`), y la definitiva la hace la base de datos.
 */
export function Form({ className, noValidate = true, children, ...resto }: Props) {
  return (
    <form noValidate={noValidate} className={cx('flex flex-col gap-5', className)} {...resto}>
      {children}
    </form>
  )
}

interface PropsAcciones {
  children: ReactNode
  className?: string
}

/**
 * Zona de acciones al pie del formulario.
 *
 * En el celular los botones van apilados y a ancho completo, que es lo que se
 * toca bien con guantes; desde `sm` se acomodan en fila a la derecha, con la
 * acción principal al final. El orden inverso en la fila deja el botón primario
 * —que en el DOM va primero, por el orden de tabulación— visualmente a la
 * derecha, donde se lo espera.
 */
export function FormAcciones({ children, className }: PropsAcciones) {
  return (
    <div
      className={cx(
        'mt-1 flex flex-col gap-3',
        'sm:flex-row-reverse sm:justify-start',
        '[&>*]:w-full sm:[&>*]:w-auto',
        className,
      )}
    >
      {children}
    </div>
  )
}
