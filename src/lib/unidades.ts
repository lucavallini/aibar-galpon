/**
 * Las unidades con las que se cuenta el stock en el depósito.
 *
 * Es una lista cerrada y no un campo de texto por la misma razón que los
 * sectores: escritas a mano terminaban conviviendo «kg», «Kg», «kilo» y
 * «kilos» como si fueran cuatro cosas distintas, y el stock de un producto
 * quedaba partido en cuatro líneas del panel.
 *
 * La unidad es **del palet**, no del producto: de la misma semilla entra una
 * partida en bolsas y otra a granel en kilos.
 *
 * Van en singular porque es como se muestran después: «120 bolsa» chirría
 * menos que inventar una pluralización que hay que mantener para cada palabra.
 */
export const UNIDADES_DE_MEDIDA = [
  'bolsa',
  'bidón',
  'tambor',
  'litro',
  'kilo',
  'tonelada',
  'unidad',
] as const

export type UnidadDeMedida = (typeof UNIDADES_DE_MEDIDA)[number]

/**
 * La que viene elegida de entrada en el alta de palet.
 *
 * No hay una unidad «neutra» que sirva para todo, así que se elige la más
 * frecuente y el operario cambia cuando no corresponde. Dejar el select vacío
 * sería un campo obligatorio más para tocar en cada alta.
 */
export const UNIDAD_POR_OMISION: UnidadDeMedida = 'bolsa'
