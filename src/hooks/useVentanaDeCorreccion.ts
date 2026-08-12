import { useEffect, useState } from 'react'
import { MINUTOS_PARA_CORREGIR } from '@/lib/queries/movimientos'
import type { MovimientoConAutor } from '@/types'

const MS_DE_VENTANA = MINUTOS_PARA_CORREGIR * 60_000

/**
 * Si un movimiento todavía se puede corregir.
 *
 * **Esto es solo para mostrar u ocultar el botón.** Quien decide de verdad es
 * `corregir_movimiento()`, y por dos razones: el reloj del celular puede estar
 * desfasado del servidor —con lo cual este cálculo daría distinto—, y entre que
 * se abre el formulario y se confirma pueden pasar los minutos que faltaban.
 * Si eso ocurre, la base rechaza y su mensaje se muestra tal cual.
 *
 * El valor se recalcula solo al vencer el plazo: sin eso, un operario que dejara
 * la pantalla abierta seguiría viendo el botón mucho después de que dejó de
 * servir, y se llevaría un error al tocarlo.
 */
export function useVentanaDeCorreccion(movimiento: MovimientoConAutor | null): boolean {
  // Solo sirve para forzar un render cuando se acaba el plazo; el valor real se
  // deriva abajo, así siempre está fresco aunque cambie el movimiento.
  const [, marcarVencido] = useState(0)

  const msRestantes = calcularMsRestantes(movimiento)

  useEffect(() => {
    if (msRestantes <= 0) return

    const temporizador = setTimeout(() => {
      marcarVencido((n) => n + 1)
      // `+ 1000` para caer del lado seguro del límite y no quedar justo en el
      // borde por el redondeo del reloj.
    }, msRestantes + 1000)

    return () => clearTimeout(temporizador)
  }, [msRestantes])

  if (movimiento === null) return false

  // Una corrección no se puede corregir: lo prohíbe la base y sería una cadena
  // sin fin de compensaciones.
  if (movimiento.tipo === 'correccion') return false

  return msRestantes > 0
}

function calcularMsRestantes(movimiento: MovimientoConAutor | null): number {
  if (movimiento === null) return 0

  const registrado = new Date(movimiento.fecha_hora).getTime()

  if (Number.isNaN(registrado)) return 0

  return registrado + MS_DE_VENTANA - Date.now()
}
