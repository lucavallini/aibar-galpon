import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { crearSector, listarSectoresConOcupacion } from '@/lib/queries/sectores'
import { claves } from '@/lib/queries/claves'
import type { Galpon, Sector, SectorDisponible } from '@/types'

/**
 * Los sectores de un galpón, con quién ocupa cada uno.
 *
 * La ocupación cambia sola: un palet que se termina libera su lugar sin que
 * nadie toque nada. Por eso no se cachea largo — ofrecer un sector ocupado
 * haría que el operario complete todo el formulario para que la base se lo
 * rechace al final.
 */
export function useSectores(galpon: Galpon) {
  return useQuery({
    queryKey: claves.sectores.ocupacion(galpon),
    queryFn: () => listarSectoresConOcupacion(galpon),
  })
}

/** Los que están libres, que es lo único que se puede elegir al dar de alta. */
export function sectoresLibres(sectores: SectorDisponible[] | undefined): SectorDisponible[] {
  return (sectores ?? []).filter((sector) => sector.libre)
}

/**
 * Alta de un sector.
 *
 * Invalida la lista al terminar para que aparezca enseguida en el selector: el
 * caso normal es cargarlo justo cuando hace falta, con el palet en la mano.
 */
export function useCrearSector() {
  const clienteDeQueries = useQueryClient()

  return useMutation<Sector, Error, { galpon: Galpon; nombre: string }>({
    mutationFn: ({ galpon, nombre }) => crearSector(galpon, nombre),
    onSuccess: () => {
      void clienteDeQueries.invalidateQueries({ queryKey: claves.sectores.todos })
    },
  })
}
