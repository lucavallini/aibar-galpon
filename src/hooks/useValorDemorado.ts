import { useEffect, useState } from 'react'

/**
 * Devuelve el valor recién cuando deja de cambiar por un rato.
 *
 * Los campos de búsqueda alimentan la clave de React Query, así que sin esto
 * cada tecla dispara una consulta: escribir «L-2026-0113» son once viajes a la
 * base para tirar diez de ellos. En el depósito, con señal mala, eso además
 * hace que los resultados aparezcan a los saltos mientras se tipea.
 *
 * @param demoraMs cuánto esperar sin cambios. 300 ms es más rápido que tipear
 * una letra pero corto como para que la búsqueda se sienta inmediata.
 */
export function useValorDemorado<T>(valor: T, demoraMs = 300): T {
  const [demorado, setDemorado] = useState(valor)

  useEffect(() => {
    const temporizador = setTimeout(() => setDemorado(valor), demoraMs)

    // Cada cambio cancela la espera anterior: solo sobrevive la última.
    return () => clearTimeout(temporizador)
  }, [valor, demoraMs])

  return demorado
}
