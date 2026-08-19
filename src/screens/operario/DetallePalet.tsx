import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { usePalet } from '@/hooks/usePalet'
import { useMovimientosDePalet } from '@/hooks/useMovimientosDePalet'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { EmptyState } from '@/components/ui/EmptyState'
import { EstadoPaletBadge } from '@/components/EstadoPaletBadge'
import { FaroPalet } from '@/components/FaroPalet'
import { Icono } from '@/components/ui/Icono'
import { EtiquetaPalet } from '@/components/EtiquetaPalet'
import { HistorialMovimientos } from '@/components/HistorialMovimientos'
import { RegistrarMovimiento } from '@/components/RegistrarMovimiento'
import { CorregirMovimiento } from '@/components/CorregirMovimiento'
import { BitacoraPalet } from '@/components/BitacoraPalet'
import { BotonDescargarMovimientos } from '@/components/BotonDescargarMovimientos'
import { EditarPalet } from '@/components/EditarPalet'
import { useVentanaDeCorreccion } from '@/hooks/useVentanaDeCorreccion'
import { useOffline } from '@/hooks/useOffline'
import { cx } from '@/lib/cx'
import { ErrorSupabase } from '@/lib/queries/errores'
import { RUTAS } from '@/rutas'
import type { MovimientoConAutor } from '@/types'

/**
 * Detalle de un palet: lo que ve el operario al escanear su QR y también al
 * terminar de darlo de alta.
 *
 * Es una sola pantalla para los dos momentos —con `?creado=1` agrega el aviso de
 * alta— porque mostraban exactamente lo mismo y mantener dos era duplicar.
 */

/** `2026-08-12` a `12/08/2026`, sin correr el día por la zona horaria. */
function formatearFecha(fecha: string): string {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)

  if (partes === null) return fecha

  return `${partes[3]}/${partes[2]}/${partes[1]}`
}

export function DetallePalet() {
  const navegar = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [parametros] = useSearchParams()
  const { usuario } = useAuth()
  const { paletTienePendientes, enLinea } = useOffline()

  const [registrando, setRegistrando] = useState(false)
  const [corrigiendo, setCorrigiendo] = useState<MovimientoConAutor | null>(null)
  const [editando, setEditando] = useState(false)

  const reciénCreado = parametros.get('creado') === '1'
  const idNumerico = id !== undefined && /^\d+$/.test(id) ? Number(id) : null

  const {
    data: palet,
    isPending,
    isError,
    error,
    refetch,
    isFetching,
  } = usePalet(idNumerico)

  const {
    data: movimientos,
    isPending: cargandoMovimientos,
    isError: falloHistorial,
    error: errorHistorial,
    refetch: reintentarHistorial,
  } = useMovimientosDePalet(idNumerico)

  // La lista viene del más reciente al más viejo, así que el corregible —si hay
  // alguno— solo puede ser el primero. El hook además lo da de baja solo cuando
  // se cumplen los 30 minutos, sin necesidad de recargar.
  const ultimoMovimiento = movimientos?.[0] ?? null
  const sePuedeCorregir = useVentanaDeCorreccion(ultimoMovimiento)

  if (idNumerico === null) {
    return (
      <EmptyState
        titulo="Dirección no válida"
        descripcion="Esta dirección no corresponde a ningún palet."
        accion={<Button onClick={() => navegar(RUTAS.operario)}>Volver al inicio</Button>}
      />
    )
  }

  if (isPending) {
    return (
      <div className="flex justify-center py-12 text-marca-700">
        <Spinner tamaño="lg" etiqueta="Cargando el palet" />
      </div>
    )
  }

  if (isError) {
    // PGRST116 es «no se encontró la fila»: o el palet no existe, o RLS lo
    // oculta. Para el operario es lo mismo y merece un mensaje propio, no el
    // error crudo de Postgres.
    const noExiste = error instanceof ErrorSupabase && error.codigo === 'PGRST116'

    if (noExiste) {
      return (
        <EmptyState
          titulo={`No existe el palet #${idNumerico}`}
          descripcion="El código que escaneaste apunta a un palet que no está en el sistema. Puede haber sido eliminado, o la etiqueta ser de otro depósito."
          accion={
            <Button onClick={() => navegar(RUTAS.escanear)}>Escanear otro</Button>
          }
        />
      )
    }

    return (
      <ErrorMessage
        titulo="No se pudo cargar el palet"
        mensaje={error.message}
        onReintentar={() => void refetch()}
      />
    )
  }

  const unidad = palet.unidad_medida
  const dadoDeBaja = palet.estado === 'baja'

  /** Lo que el comprobante en PDF necesita saber de este palet. */
  const paletParaPdf = {
    id: palet.id,
    producto: palet.producto.nombre,
    lote: palet.lote,
    galpon: palet.galpon,
    sector: palet.sector,
    unidad,
    cantidadInicial: palet.cantidad_inicial,
    cantidadDisponible: palet.cantidad_disponible,
    estado: palet.estado,
    empresa: palet.cliente?.nombre ?? null,
    transportista: palet.transportista?.nombre ?? null,
    fechaIngreso: palet.fecha_ingreso,
  }
  const sinStock = palet.cantidad_disponible === 0
  /**
   * El palet está en algún lado que nadie registró.
   *
   * Es como quedan los de un alta en lote, que se ubican al descargarlos. No se
   * escribe en la bitácora: se deduce de que no tenga sector, así el aviso
   * aparece solo al crearlo y desaparece solo al asignarle el lugar, sin que
   * nadie tenga que escribir ni borrar una nota. La bitácora es inmutable y
   * esto no es una nota: es un estado.
   */
  const sinUbicar = palet.sector_id === null
  const hayPendientesDeEstePalet = paletTienePendientes(palet.id)

  /**
   * El formulario y la pantalla nombran al lote como el depósito: «número de
   * lote» es lo que dice el remito de un agroquímico, «batch» es lo que dice la
   * bolsa de semilla. Es la misma columna, `palet.lote`.
   */
  const esSemilla = palet.detalle_semilla !== null
  const etiquetaDeLote = esSemilla ? 'Batch' : 'Lote'

  /**
   * Los datos que van sueltos bajo el nombre del producto.
   *
   * Se arman como lista y no como marcado suelto porque cambian según lo que
   * sea el palet: una semilla tiene híbrido y calibre, un agroquímico tiene
   * elaboración y vencimiento, y ninguno de los dos tiene los del otro.
   *
   * No están ni la cantidad ni la unidad —las dice el faro, arriba— ni el lote
   * ni el cliente, que ya están en la línea del producto: repetir un dato a
   * cuatro centímetros del original solo agranda la pantalla.
   */
  const datosDelPalet: { etiqueta: string; valor: string; alerta?: boolean }[] = []

  if (palet.detalle_semilla !== null) {
    if (palet.detalle_semilla.hibrido !== null) {
      datosDelPalet.push({ etiqueta: 'Híbrido', valor: palet.detalle_semilla.hibrido })
    }

    if (palet.detalle_semilla.calibre !== null) {
      datosDelPalet.push({ etiqueta: 'Calibre', valor: palet.detalle_semilla.calibre })
    }
  }

  if (palet.detalle_agroquimico !== null) {
    if (palet.detalle_agroquimico.fecha_elaboracion !== null) {
      datosDelPalet.push({
        etiqueta: 'Elaboración',
        valor: formatearFecha(palet.detalle_agroquimico.fecha_elaboracion),
      })
    }

    if (palet.detalle_agroquimico.fecha_vencimiento !== null) {
      datosDelPalet.push({
        etiqueta: 'Vencimiento',
        valor: formatearFecha(palet.detalle_agroquimico.fecha_vencimiento),
      })
    }
  }

  datosDelPalet.push({
    etiqueta: 'Ingresó',
    valor: formatearFecha(palet.fecha_ingreso),
  })

  // Quién lo trajo. Es opcional: no siempre se registra, y en ese caso no se
  // muestra la fila vacía.
  if (palet.transportista != null) {
    datosDelPalet.push({ etiqueta: 'Lo trajo', valor: palet.transportista.nombre })
  }

  // Sin sector el palet está en algún lado que nadie registró: se marca en
  // ámbar en vez de dejar el dato en blanco, que pasa desapercibido.
  datosDelPalet.push(
    palet.sector !== null
      ? { etiqueta: 'Ubicación', valor: `Galpón ${palet.galpon} · ${palet.sector}` }
      : {
          etiqueta: 'Ubicación',
          valor: `Galpón ${palet.galpon} · sin ubicar`,
          alerta: true,
        },
  )

  return (
    <div className="flex flex-col gap-4">
      {/* --- Lo que se busca al escanear: cuánto queda ---
          La cifra abre la pantalla y ocupa el encabezado entero, sobre color
          lleno. Se mira con el palet delante, a veces a un brazo de distancia
          y con sol de frente: en ese segundo hace falta un solo dato. --- */}
      <FaroPalet
        className="-mt-5"
        disponible={palet.cantidad_disponible}
        inicial={palet.cantidad_inicial}
        unidad={unidad}
        // Un palet vacío o dado de baja en verde lleno diría «acá hay
        // mercadería», que es justo lo contrario de lo que pasa.
        apagado={sinStock || dadoDeBaja}
        encabezado={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="cifra text-base font-bold tracking-wide text-white">
              PALET {palet.id}
            </span>
            <EstadoPaletBadge estado={palet.estado} />
          </div>
        }
      />

      {reciénCreado && (
        <p
          role="status"
          className="rounded-lg border border-marca-200 bg-marca-50 px-4 py-3 text-center text-base font-medium text-marca-900"
        >
          Palet creado. Imprimí la etiqueta y pegala en el palet.
        </p>
      )}

      {dadoDeBaja && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="font-semibold text-red-900">Este palet está dado de baja</p>
          <p className="mt-1 text-base text-red-800">
            No se pueden registrar movimientos sobre él. Si es un error, hablá con el
            encargado.
          </p>
        </div>
      )}

      {sinUbicar && !dadoDeBaja && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="font-semibold text-amber-900">Este palet está sin ubicar</p>
          <p className="mt-1 text-base text-amber-900">
            No se registró en qué sector quedó, así que no hay forma de encontrarlo sin
            recorrer el galpón {palet.galpon}. Asignale el lugar donde lo dejaste.
          </p>
          <Button
            variante="secundario"
            className="mt-3"
            onClick={() => setEditando(true)}
          >
            Asignar sector
          </Button>
        </div>
      )}

      {/* El operario tiene que saber cuándo el número que ve puede no ser el
          real: o porque hay movimientos suyos sin sincronizar, o porque está
          viendo datos guardados de la última vez que hubo señal. */}
      {hayPendientesDeEstePalet && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="font-semibold text-amber-900">Tenés movimientos sin registrar</p>
          <p className="mt-1 text-base text-amber-900">
            El número de arriba es el que hay en el sistema y todavía no incluye lo que
            registraste sin señal. Va a cambiar cuando se sincronice.
          </p>
        </div>
      )}

      {!enLinea && !hayPendientesDeEstePalet && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="font-semibold text-amber-900">Sin señal</p>
          <p className="mt-1 text-base text-amber-900">
            Estos son los últimos datos que se pudieron traer. Puede que otro operario
            haya movido este palet desde entonces.
          </p>
        </div>
      )}

      {/* --- Identificación ---
          Qué es este palet, debajo de cuánto queda. Los datos van sueltos bajo
          el nombre del producto y no en una grilla con bordes: son pocos, y una
          tabla al lado del faro le compite el ojo a la cifra. --- */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight text-piedra-900">
              {palet.producto.nombre}
            </h2>
            <p className="cifra mt-0.5 text-base text-piedra-600">
              {etiquetaDeLote} {palet.lote} · {palet.cliente?.nombre ?? 'AIBAR S.R.L'}
            </p>
          </div>

          {!dadoDeBaja && (
            <Button
              variante="secundario"
              iconoSolo
              aria-label="Corregir los datos del palet"
              onClick={() => setEditando(true)}
            >
              <Icono nombre="editar" tamaño={19} />
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
          {datosDelPalet.map((dato) => (
            <p key={dato.etiqueta} className="text-base">
              <span className="rotulo">{dato.etiqueta}</span>{' '}
              <span
                className={cx(
                  'font-medium',
                  dato.alerta === true ? 'text-amber-800' : 'text-piedra-900',
                )}
              >
                {dato.valor}
              </span>
            </p>
          ))}
        </div>
      </div>

      {/* La acción principal de esta pantalla: descontar stock.
          La base lo rechazaría igual, pero deshabilitarlo evita que el operario
          llene un formulario para que después le digan que no. */}
      {!dadoDeBaja && (
        <Button
          tamaño="lg"
          anchoCompleto
          disabled={sinStock}
          onClick={() => setRegistrando(true)}
        >
          {sinStock ? 'Sin stock para registrar' : 'Registrar movimiento'}
        </Button>
      )}

      <RegistrarMovimiento
        palet={palet}
        abierto={registrando}
        onCerrar={() => setRegistrando(false)}
      />

      <CorregirMovimiento
        palet={palet}
        movimiento={corrigiendo}
        onCerrar={() => setCorrigiendo(null)}
      />

      <EditarPalet
        palet={palet}
        abierto={editando}
        onCerrar={() => setEditando(false)}
      />

      {/* --- Historial --- */}
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-piedra-900">Movimientos</h2>

          <BotonDescargarMovimientos
            palet={paletParaPdf}
            movimientos={movimientos ?? []}
          />
        </div>

        {cargandoMovimientos ? (
          <div className="flex justify-center py-6 text-marca-700">
            <Spinner etiqueta="Cargando movimientos" />
          </div>
        ) : falloHistorial ? (
          <ErrorMessage
            mensaje={errorHistorial.message}
            onReintentar={() => void reintentarHistorial()}
          />
        ) : (
          <HistorialMovimientos
            movimientos={movimientos}
            alta={{
              fecha: palet.fecha_ingreso,
              cantidad: palet.cantidad_inicial,
              // Quién lo trajo: el transportista del ingreso, que no es el de
              // ninguna salida. Es el dato que cierra de dónde salió el palet.
              transportista: palet.transportista?.nombre ?? null,
            }}
            usuarioActualId={usuario?.id ?? null}
            unidad={unidad}
            idCorregible={
              sePuedeCorregir && ultimoMovimiento !== null ? ultimoMovimiento.id : null
            }
            onCorregir={setCorrigiendo}
          />
        )}
      </Card>

      <BitacoraPalet paletId={palet.id} />

      <EtiquetaPalet
        id={palet.id}
        producto={palet.producto.nombre}
        lote={palet.lote}
        cantidad={`${palet.cantidad_inicial} ${unidad}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button tamaño="lg" anchoCompleto onClick={() => navegar(RUTAS.escanear)}>
          Escanear otro palet
        </Button>
        <Button
          variante="secundario"
          anchoCompleto
          cargando={isFetching}
          onClick={() => {
            void refetch()
            void reintentarHistorial()
          }}
        >
          {isFetching ? 'Actualizando…' : 'Actualizar datos'}
        </Button>
        <Button
          variante="fantasma"
          anchoCompleto
          onClick={() => navegar(reciénCreado ? RUTAS.nuevoPalet : RUTAS.operario)}
        >
          {reciénCreado ? 'Dar de alta otro' : 'Volver al inicio'}
        </Button>
      </div>
    </div>
  )
}
