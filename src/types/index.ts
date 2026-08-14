/**
 * Tipos de dominio de AIBAR.
 *
 * Alias legibles sobre `database.ts` — es lo que consume el resto de la app,
 * para no arrastrar `Database['public']['Tables'][...]['Row']` por todos lados.
 * Los nombres siguen al schema: `palet`, `movimiento`, `producto`, en español.
 */

import type { Database } from './database'

type Tablas = Database['public']['Tables']
type Vistas = Database['public']['Views']
type Funciones = Database['public']['Functions']

export type {
  Categoria,
  Database,
  EstadoPalet,
  Galpon,
  Rol,
  TipoMovimiento,
  TipoMovimientoRegistrable,
} from './database'

// =========================================================
// Filas
// =========================================================

export type Usuario = Tablas['usuario']['Row']
export type Producto = Tablas['producto']['Row']
export type Cliente = Tablas['cliente']['Row']
export type Transportista = Tablas['transportista']['Row']
export type EmpresaTransporte = Tablas['empresa_transporte']['Row']
export type Sector = Tablas['sector']['Row']
/** Un sector con quién lo ocupa, para poder ofrecer solo los libres. */
export type SectorDisponible = Vistas['vista_sector_disponible']['Row']
export type ObservacionPalet = Tablas['observacion_palet']['Row']
export type Palet = Tablas['palet']['Row']
export type DetalleAgroquimico = Tablas['detalle_agroquimico']['Row']
export type DetalleSemilla = Tablas['detalle_semilla']['Row']
export type Movimiento = Tablas['movimiento']['Row']

// =========================================================
// Escrituras permitidas
// =========================================================
// `movimiento` y `usuario` no aparecen acá a propósito: la base no admite
// escritura directa sobre ellas.

export type ProductoInsert = Tablas['producto']['Insert']
export type ProductoUpdate = Tablas['producto']['Update']

export type UsuarioUpdate = Tablas['usuario']['Update']

export type ClienteInsert = Tablas['cliente']['Insert']

export type TransportistaInsert = Tablas['transportista']['Insert']
export type TransportistaUpdate = Tablas['transportista']['Update']
export type EmpresaTransporteInsert = Tablas['empresa_transporte']['Insert']
export type SectorInsert = Tablas['sector']['Insert']
export type SectorUpdate = Tablas['sector']['Update']

export type ObservacionPaletInsert = Tablas['observacion_palet']['Insert']

export type PaletInsert = Tablas['palet']['Insert']
export type PaletUpdate = Tablas['palet']['Update']

export type DetalleAgroquimicoInsert = Tablas['detalle_agroquimico']['Insert']
export type DetalleAgroquimicoUpdate = Tablas['detalle_agroquimico']['Update']

export type DetalleSemillaInsert = Tablas['detalle_semilla']['Insert']
export type DetalleSemillaUpdate = Tablas['detalle_semilla']['Update']

// =========================================================
// Argumentos de las funciones RPC
// =========================================================

export type RegistrarMovimientoArgs = Funciones['registrar_movimiento']['Args']
export type CorregirMovimientoArgs = Funciones['corregir_movimiento']['Args']

// =========================================================
// Formas compuestas que devuelven las queries
// =========================================================

/** Palet con su producto resuelto: lo mínimo para mostrarlo en un listado. */
export type PaletConProducto = Palet & {
  producto: Producto
  /** `null` = mercadería propia de AIBAR. */
  cliente: Cliente | null
  /** Quién lo trajo. `null` si no se registró. */
  transportista: Pick<Transportista, 'id' | 'nombre'> | null
}

/** Un chofer con el nombre de su transporte ya resuelto. */
export type TransportistaConEmpresa = Transportista & {
  /** `null` = fletero por su cuenta, sin transporte detrás. */
  empresa: EmpresaTransporte | null
}

/** Nota de la bitácora con quien la escribió. */
export type ObservacionConAutor = ObservacionPalet & {
  usuario: Pick<Usuario, 'id' | 'nombre'> | null
}

/**
 * Palet completo, para la pantalla de detalle. Solo uno de los dos detalles
 * viene cargado — el que corresponde a la categoría del producto; el otro es
 * `null`, porque los triggers de validación impiden que coexistan.
 */
export type PaletCompleto = PaletConProducto & {
  detalle_agroquimico: DetalleAgroquimico | null
  detalle_semilla: DetalleSemilla | null
}

/**
 * Movimiento con quien lo registró, para el historial del palet.
 *
 * `usuario` puede venir `null` aunque exista la fila: si quien consulta está
 * inactivo, RLS le filtra el padrón entero. La UI tiene que tolerarlo en vez de
 * asumir que siempre hay nombre.
 */
export type MovimientoConAutor = Movimiento & {
  usuario: Pick<Usuario, 'id' | 'nombre' | 'rol'> | null
  /** Quién se llevó la mercadería. `null` en los ajustes y en los sin registrar. */
  transportista: Pick<Transportista, 'id' | 'nombre'> | null
}

// =========================================================
// Gerencia
// =========================================================

/** Palet con su producto, su vencimiento y su antigüedad ya resueltos. */
export type PaletGerencia = Vistas['vista_palet_gerencia']['Row']

/** Stock consolidado de un producto, sumando todos sus palets. */
export type StockPorProducto = Vistas['vista_stock_por_producto']['Row']
