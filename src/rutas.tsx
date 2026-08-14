import { Navigate, Route, Routes } from 'react-router'
import { RutaProtegida } from '@/components/RutaProtegida'
import { Layout } from '@/components/layout/Layout'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useAuth } from '@/hooks/useAuth'
import { Login } from '@/screens/Login'
import { SinAcceso } from '@/screens/SinAcceso'
import { NoEncontrado } from '@/screens/NoEncontrado'
import { AbrirPalet } from '@/screens/AbrirPalet'
import { CatalogoUI } from '@/screens/CatalogoUI'
import { InicioOperario } from '@/screens/operario/InicioOperario'
import { AltaPalet } from '@/screens/operario/AltaPalet'
import { LoteCreado } from '@/screens/operario/LoteCreado'
import { AltaProducto } from '@/screens/operario/AltaProducto'
import { AltaCliente } from '@/screens/operario/AltaCliente'
import { EscanearQR } from '@/screens/operario/EscanearQR'
import { BuscarPalets } from '@/screens/operario/BuscarPalets'
import { Pendientes } from '@/screens/operario/Pendientes'
import { DetallePalet } from '@/screens/operario/DetallePalet'
import { PanelGerencia } from '@/screens/gerencia/PanelGerencia'
import { DetallePaletGerencia } from '@/screens/gerencia/DetallePaletGerencia'
import { Usuarios } from '@/screens/gerencia/Usuarios'
import type { ItemNav } from '@/components/layout/Nav'
import type { Rol } from '@/types'

/**
 * Mapa de rutas de la app. Todas viven acá: no se declaran rutas sueltas dentro
 * de las pantallas.
 *
 * Las direcciones se exportan desde este mismo archivo, junto al árbol que las
 * usa, para que no se puedan desincronizar. Eso cuesta el fast refresh de este
 * módulo — editarlo recarga la app en lugar de conservar el estado —, que es un
 * precio razonable en un archivo que casi no se toca.
 */
/* eslint-disable react-refresh/only-export-components */

/** Direcciones de la app, para no repetir strings sueltos por el código. */
export const RUTAS = {
  raiz: '/',
  login: '/login',
  sinAcceso: '/sin-acceso',
  operario: '/deposito',
  buscarPalets: '/deposito/palets',
  nuevoPalet: '/deposito/nuevo',
  /** Los palets recién creados de un lote. Para navegar, usar `rutaLote(ids)`. */
  lote: '/deposito/lote',
  nuevoProducto: '/deposito/productos/nuevo',
  nuevoCliente: '/deposito/clientes/nuevo',
  escanear: '/escanear',
  pendientes: '/deposito/pendientes',
  /** Patrón de la ruta. Para navegar, usar `rutaPalet(id)`. */
  palet: '/palet/:id',
  /**
   * Destino de los QR impresos. Corta a propósito: cuanto más corta la URL,
   * menos denso el QR y más fácil de escanear en una etiqueta chica.
   * No cambiar nunca: hay etiquetas físicas apuntando acá.
   */
  abrirPalet: '/p/:id',
  gerencia: '/gerencia',
  /** Patrón. Para navegar, usar `rutaPaletGerencia(id)`. */
  paletGerencia: '/gerencia/palets/:id',
  usuarios: '/gerencia/usuarios',
  catalogoUI: '/ui',
} as const

/** Detalle de un palet en el panel administrativo, de solo lectura. */
export function rutaPaletGerencia(id: number): string {
  return `/gerencia/palets/${id}`
}

/**
 * Dirección del detalle de un palet, sin concatenar strings a mano.
 *
 * @param reciénCreado agrega `?creado=1`, que hace que el detalle muestre el
 * aviso de alta y ofrezca cargar otro.
 */
export function rutaPalet(id: number, reciénCreado = false): string {
  return `/palet/${id}${reciénCreado ? '?creado=1' : ''}`
}

/**
 * Pantalla con los palets de un lote recién creado, para imprimir sus QR.
 *
 * Los ids van en la dirección y no en el estado de la navegación para que
 * recargar la página —algo que pasa solo si el celular se bloquea a mitad de la
 * impresión— no deje al operario sin la lista de lo que acaba de crear.
 */
export function rutaLote(ids: number[]): string {
  return `/deposito/lote?palets=${ids.join(',')}`
}

/** Navegación del operario. Cada fase que agrega una pantalla suma su ítem acá. */
/** Navegación de gerencia. El panel es de consulta salvo la gestión de usuarios. */
const NAV_GERENCIA: ItemNav[] = [
  { a: RUTAS.gerencia, etiqueta: 'Panel', icono: 'panel' },
  { a: RUTAS.usuarios, etiqueta: 'Usuarios', icono: 'usuarios' },
]

const NAV_OPERARIO: ItemNav[] = [
  { a: RUTAS.operario, etiqueta: 'Inicio', icono: 'inicio' },
  { a: RUTAS.escanear, etiqueta: 'Escanear', icono: 'escanear' },
  { a: RUTAS.buscarPalets, etiqueta: 'Palets', icono: 'buscar' },
  { a: RUTAS.nuevoPalet, etiqueta: 'Nuevo palet', icono: 'palet' },
  // Va al lado del alta de palet porque es donde se descubre que falta: llegó
  // mercadería de algo que nunca se cargó. Antes el acceso estaba metido dentro
  // del formulario, y salir a cargar el producto costaba perder lo tipeado.
  { a: RUTAS.nuevoProducto, etiqueta: 'Producto', icono: 'producto' },
]

/**
 * Dónde aterriza cada rol al entrar.
 *
 * Es un objeto y no una función para poder vivir en este archivo sin romper el
 * fast refresh, que solo tolera exports de componentes y constantes.
 */
export const RUTA_INICIAL_POR_ROL: Record<Rol, string> = {
  operario: RUTAS.operario,
  jefe: RUTAS.gerencia,
}

/**
 * Manda a cada quien a lo suyo desde la raíz: el operario al depósito, el jefe
 * al panel. Sin sesión, al login.
 */
function Inicio() {
  const { estado, rol } = useAuth()

  if (estado === 'cargando') {
    return <LoadingScreen mensaje="Verificando tu sesión…" />
  }

  if (estado === 'sin-perfil') {
    return <Navigate to={RUTAS.sinAcceso} replace />
  }

  if (rol === null) {
    return <Navigate to={RUTAS.login} replace />
  }

  return <Navigate to={RUTA_INICIAL_POR_ROL[rol]} replace />
}

export function Rutas() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path={RUTAS.login} element={<Login />} />
      <Route path={RUTAS.sinAcceso} element={<SinAcceso />} />

      {/* Los QR impresos entran por acá y se derivan solos */}
      <Route path={RUTAS.abrirPalet} element={<AbrirPalet />} />

      {/* Raíz: deriva según el rol */}
      <Route path={RUTAS.raiz} element={<Inicio />} />

      {/* Operario: alta de palets, QR y movimientos */}
      <Route
        element={
          <RutaProtegida rolRequerido="operario">
            <Layout titulo="Depósito" items={NAV_OPERARIO} />
          </RutaProtegida>
        }
      >
        <Route path={RUTAS.operario} element={<InicioOperario />} />
        <Route path={RUTAS.escanear} element={<EscanearQR />} />
        <Route path={RUTAS.buscarPalets} element={<BuscarPalets />} />
        <Route path={RUTAS.pendientes} element={<Pendientes />} />
        <Route path={RUTAS.nuevoPalet} element={<AltaPalet />} />
        <Route path={RUTAS.lote} element={<LoteCreado />} />
        <Route path={RUTAS.nuevoProducto} element={<AltaProducto />} />
        <Route path={RUTAS.nuevoCliente} element={<AltaCliente />} />
        <Route path={RUTAS.palet} element={<DetallePalet />} />
      </Route>

      {/* Gerencia: solo consulta, sin una sola acción de escritura */}
      <Route
        element={
          <RutaProtegida rolRequerido="jefe">
            <Layout titulo="Panel administrativo" items={NAV_GERENCIA} />
          </RutaProtegida>
        }
      >
        <Route path={RUTAS.gerencia} element={<PanelGerencia />} />
        <Route path={RUTAS.paletGerencia} element={<DetallePaletGerencia />} />
        <Route path={RUTAS.usuarios} element={<Usuarios />} />
      </Route>

      {/* Catálogo de componentes: herramienta de desarrollo, fuera del build. */}
      {import.meta.env.DEV && (
        <Route path={RUTAS.catalogoUI} element={<CatalogoUI />} />
      )}

      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}
