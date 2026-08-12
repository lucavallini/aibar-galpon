/** Valores que `cx` sabe ignorar, para poder escribir `condicion && 'clase'`. */
type ValorDeClase = string | false | null | undefined

/**
 * Compone clases de CSS descartando las condiciones falsas.
 *
 * Es una función propia y no `clsx` a propósito: CLAUDE.md pide no sumar
 * dependencias fuera de la tabla de stack sin discutirlo, y para esto alcanza
 * con esto.
 *
 * @example cx('rounded-lg', activo && 'bg-marca-700', className)
 */
export function cx(...clases: ValorDeClase[]): string {
  return clases.filter((clase): clase is string => Boolean(clase)).join(' ')
}
