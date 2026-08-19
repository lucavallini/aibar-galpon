/**
 * Cuánto queda de un palet, en porcentaje.
 *
 * Es un cálculo de presentación, no de negocio: no decide nada sobre el stock,
 * solo traduce dos números que ya vienen de la base a algo que se lee de un
 * vistazo. La cantidad que manda sigue siendo `cantidad_disponible`, y quien la
 * calcula es `registrar_movimiento()` en Postgres.
 *
 * El porcentaje acompaña a la cifra, nunca la reemplaza: «62 %» no le sirve a
 * nadie para cargar un camión, pero dice al instante si el palet está entero,
 * por la mitad o casi vacío, que es lo que se quiere saber de lejos.
 */

/**
 * Porcentaje de mercadería que todavía queda, redondeado y acotado a 0–100.
 *
 * Devuelve `null` cuando no se puede calcular —un palet cuya cantidad inicial es
 * cero o negativa no existe en la práctica, pero un dato viejo o migrado podría
 * serlo—: quien lo muestre tiene que estar preparado para no mostrar nada, en
 * lugar de dibujar una barra vacía que se lee como «no queda nada».
 */
export function porcentajeRestante(
  disponible: number,
  inicial: number,
): number | null {
  if (!Number.isFinite(disponible) || !Number.isFinite(inicial)) return null
  if (inicial <= 0) return null

  const crudo = (disponible / inicial) * 100

  // Acotado a los extremos: una corrección podría dejar el disponible por
  // encima del inicial por un instante, y una barra al 104 % se desborda.
  if (crudo <= 0) return 0
  if (crudo >= 100) return 100

  // Se redondea al entero, pero nunca a 0 ni a 100 si todavía no llegó: «0 %»
  // con mercadería en el palet, o «100 %» con algo ya despachado, es mentira.
  const redondeado = Math.round(crudo)

  if (redondeado === 0) return 1
  if (redondeado === 100) return 99

  return redondeado
}
