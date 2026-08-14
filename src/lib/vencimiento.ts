/**
 * Cómo se le dice a una persona cuánto falta para un vencimiento.
 *
 * Desde que el aviso se da con 6 meses de anticipación, contar en días dejó de
 * servir: «Vence en 174 d» obliga a hacer la cuenta mental para entender que
 * todavía hay tiempo. Cerca del vencimiento pasa al revés —ahí los días son
 * exactamente lo que importa—, así que la unidad cambia según cuánto falte.
 */

/** A partir de acá se cuenta en meses: dos meses de días ya no se leen. */
const DIAS_PARA_CONTAR_EN_MESES = 60

/**
 * «12 d», «5 meses», «1 mes».
 *
 * Los meses se redondean **hacia abajo**: faltando 59 días es preferible leer
 * «1 mes» y que sobre tiempo, a leer «2 meses» y confiarse de un margen que no
 * existe. Un vencimiento no es una fecha para redondear con optimismo.
 *
 * @param dias Cuántos días faltan. Negativo = ya venció.
 */
export function formatearAnticipacion(dias: number): string {
  if (dias < 0) return 'vencido'

  if (dias <= DIAS_PARA_CONTAR_EN_MESES) {
    return `${dias} d`
  }

  const meses = Math.floor(dias / 30)

  return meses === 1 ? '1 mes' : `${meses} meses`
}
