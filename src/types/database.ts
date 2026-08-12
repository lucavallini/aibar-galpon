/**
 * Espejo tipado del schema de Supabase (`aibar_schema_completo.sql`).
 *
 * Tiene deliberadamente la misma forma que emite `supabase gen types typescript`,
 * para que el día que se linkee el CLI este archivo se reemplace por el generado
 * sin tocar nada más. Se pasa como parámetro genérico a `createClient<Database>()`,
 * y con eso todas las queries y RPCs quedan inferidas sin anotar cada llamada.
 *
 * Los tipos reflejan también los permisos del schema, no solo sus columnas:
 * lo que la base prohíbe (insertar un movimiento, tocar `cantidad_disponible`)
 * acá es directamente inexpresable.
 *
 * Mapeo de tipos Postgres → TypeScript, tal como los serializa PostgREST:
 *   bigint / smallint / numeric(10,2) → number
 *   timestamptz / date / varchar      → string
 *   uuid                              → string
 */

// =========================================================
// Uniones de los CHECK del schema
// =========================================================

/** `usuario.rol` */
export type Rol = 'operario' | 'jefe'

/** `producto.categoria` */
export type Categoria = 'agroquimico' | 'semilla'

/** `palet.estado`. Lo gobiernan los triggers y las funciones de stock, nunca el front. */
export type EstadoPalet = 'activo' | 'parcial' | 'vacio' | 'baja'

/** `movimiento.tipo` */
export type TipoMovimiento = 'venta' | 'salida' | 'ajuste' | 'correccion'

/**
 * Lo único que acepta `registrar_movimiento()`: todos restan stock.
 * `correccion` queda afuera porque solo puede crearla `corregir_movimiento()`.
 */
export type TipoMovimientoRegistrable = Exclude<TipoMovimiento, 'correccion'>

/** `palet.galpon` */
export type Galpon = 1 | 2 | 3

// =========================================================
// Filas de las tablas
// =========================================================

type UsuarioRow = {
  id: string
  nombre: string
  rol: Rol
  activo: boolean
  created_at: string
}

type ProductoRow = {
  id: number
  nombre: string
  categoria: Categoria
  unidad_medida: string
  /** Bayer, Syngenta, Nidera… */
  marca: string | null
  /** Glifosato, atrazina. Solo tiene sentido en agroquímicos. */
  principio_activo: string | null
  /** 48%, 50 g/l. */
  concentracion: string | null
  created_at: string
}

type PaletRow = {
  id: number
  producto_id: number
  lote: string
  cantidad_inicial: number
  cantidad_disponible: number
  galpon: Galpon
  sector: string | null
  fecha_ingreso: string
  estado: EstadoPalet
  /** `null` = mercadería propia de AIBAR. */
  cliente_id: number | null
  created_at: string
  updated_at: string
}

type ClienteRow = {
  id: number
  nombre: string
  created_at: string
}

/** Nota de la bitácora del palet. Inmutable, como los movimientos. */
type ObservacionPaletRow = {
  id: number
  palet_id: number
  usuario_id: string
  texto: string
  created_at: string
}

type DetalleAgroquimicoRow = {
  palet_id: number
  fecha_elaboracion: string | null
  fecha_vencimiento: string | null
}

type DetalleSemillaRow = {
  palet_id: number
  hibrido: string | null
  calibre: string | null
}

type MovimientoRow = {
  id: number
  palet_id: number
  usuario_id: string
  tipo: TipoMovimiento
  cantidad: number
  /** Solo en las correcciones: apunta al movimiento que compensa. */
  corrige_a: number | null
  /** Obligatorio en las correcciones, `null` en el resto. */
  motivo: string | null
  fecha_hora: string
}

// =========================================================
// Filas de las vistas de gerencia
// =========================================================

/** Fila de `vista_palet_gerencia`: el palet con todo ya resuelto. */
type PaletGerenciaRow = {
  id: number
  producto_id: number
  lote: string
  cantidad_inicial: number
  cantidad_disponible: number
  galpon: Galpon
  sector: string | null
  fecha_ingreso: string
  estado: EstadoPalet

  producto_nombre: string
  producto_categoria: Categoria
  producto_unidad_medida: string
  producto_marca: string | null
  producto_principio_activo: string | null
  producto_concentracion: string | null

  /** `null` = mercadería propia de AIBAR. */
  cliente_id: number | null
  cliente_nombre: string | null

  fecha_elaboracion: string | null
  fecha_vencimiento: string | null
  hibrido: string | null
  calibre: string | null

  /** Negativo = ya vencido. `null` en semillas y sin fecha cargada. */
  dias_para_vencer: number | null
  /** `null` si el palet nunca tuvo movimientos. */
  ultimo_movimiento: string | null
  /** Cuenta desde el ingreso si nunca se movió. */
  dias_sin_movimiento: number
  /** Señal de que a este palet le pasó algo y conviene abrirlo. */
  cantidad_observaciones: number
  /** La última nota, para leerla sin entrar al palet. */
  ultima_observacion: string | null
  ultima_observacion_fecha: string | null
  ultima_observacion_autor: string | null
}

/** Fila de `vista_stock_por_producto`: el consolidado de cada producto. */
type StockPorProductoRow = {
  producto_id: number
  producto_nombre: string
  producto_categoria: Categoria
  producto_unidad_medida: string
  producto_marca: string | null
  producto_principio_activo: string | null
  producto_concentracion: string | null
  total_disponible: number
  palets_con_stock: number
  palets_parciales: number
  /** Galpones donde queda stock de este producto. */
  galpones: Galpon[]
  /** El vencimiento más próximo entre los palets con stock. */
  proximo_vencimiento: string | null
}

// =========================================================
// Database
// =========================================================

/**
 * Tiene que ser un `type` y no una `interface`.
 *
 * supabase-js exige que `Database[Schema]` satisfaga su `GenericSchema`, que usa
 * índices `Record<string, …>`. TypeScript le da index signature implícita a los
 * alias de tipo pero no a las interfaces, así que con `interface` el `Schema`
 * del cliente colapsa a `never` y toda llamada `.rpc()` con argumentos deja de
 * compilar. Es también la forma en que lo emite `supabase gen types`.
 */
export type Database = {
  public: {
    Tables: {
      usuario: {
        Row: UsuarioRow
        // La fila la crea el trigger `crear_usuario()` sobre auth.users.
        Insert: never
        /**
         * Solo `rol` y `activo`, y solo para jefes: es lo que expone el
         * `GRANT UPDATE` junto con la policy `usuario_update_jefe`. El nombre y
         * la fecha de alta no se administran desde la app.
         */
        Update: {
          rol?: Rol
          activo?: boolean
        }
        Relationships: []
      }

      producto: {
        Row: ProductoRow
        Insert: {
          id?: number
          nombre: string
          categoria: Categoria
          unidad_medida: string
          marca?: string | null
          principio_activo?: string | null
          concentracion?: string | null
          created_at?: string
        }
        // La categoría deja de ser editable en cuanto el producto tiene palets
        // (trigger `proteger_categoria_producto`), pero sigue siendo editable antes.
        Update: {
          nombre?: string
          categoria?: Categoria
          unidad_medida?: string
          marca?: string | null
          principio_activo?: string | null
          concentracion?: string | null
        }
        Relationships: []
      }

      palet: {
        Row: PaletRow
        /**
         * Sin `cantidad_disponible` ni `estado`: los fija el trigger
         * `inicializar_palet()` a partir de `cantidad_inicial`.
         */
        Insert: {
          id?: number
          producto_id: number
          lote: string
          cantidad_inicial: number
          galpon: Galpon
          sector?: string | null
          fecha_ingreso?: string
          cliente_id?: number | null
        }
        /**
         * Exactamente las columnas del `GRANT UPDATE` (sección 24 del schema,
         * más `cliente_id`). `cantidad_inicial` es inmutable y el stock solo se
         * mueve por RPC.
         */
        Update: {
          producto_id?: number
          lote?: string
          galpon?: Galpon
          sector?: string | null
          fecha_ingreso?: string
          cliente_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'palet_producto_id_fkey'
            columns: ['producto_id']
            referencedRelation: 'producto'
            referencedColumns: ['id']
          },
        ]
      }

      detalle_agroquimico: {
        Row: DetalleAgroquimicoRow
        Insert: {
          palet_id: number
          fecha_elaboracion?: string | null
          fecha_vencimiento?: string | null
        }
        Update: {
          fecha_elaboracion?: string | null
          fecha_vencimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'detalle_agroquimico_palet_id_fkey'
            columns: ['palet_id']
            referencedRelation: 'palet'
            referencedColumns: ['id']
          },
        ]
      }

      detalle_semilla: {
        Row: DetalleSemillaRow
        Insert: {
          palet_id: number
          hibrido?: string | null
          calibre?: string | null
        }
        Update: {
          hibrido?: string | null
          calibre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'detalle_semilla_palet_id_fkey'
            columns: ['palet_id']
            referencedRelation: 'palet'
            referencedColumns: ['id']
          },
        ]
      }

      cliente: {
        Row: ClienteRow
        Insert: {
          id?: number
          nombre: string
          created_at?: string
        }
        Update: {
          nombre?: string
        }
        Relationships: []
      }

      observacion_palet: {
        Row: ObservacionPaletRow
        /**
         * `usuario_id` va explícito porque la policy exige que coincida con
         * `auth.uid()`: nadie puede dejar una nota firmada por otro.
         */
        Insert: {
          palet_id: number
          usuario_id: string
          texto: string
        }
        /** Inmutables: el schema hace REVOKE de UPDATE y DELETE. */
        Update: never
        Relationships: [
          {
            foreignKeyName: 'observacion_palet_palet_id_fkey'
            columns: ['palet_id']
            referencedRelation: 'palet'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'observacion_palet_usuario_id_fkey'
            columns: ['usuario_id']
            referencedRelation: 'usuario'
            referencedColumns: ['id']
          },
        ]
      }

      movimiento: {
        Row: MovimientoRow
        /**
         * Historial inmutable: el schema hace REVOKE de INSERT/UPDATE/DELETE
         * (sección 25). El único camino son `registrar_movimiento()` y
         * `corregir_movimiento()`. `never` lo vuelve un error de compilación.
         */
        Insert: never
        Update: never
        Relationships: [
          {
            foreignKeyName: 'movimiento_palet_id_fkey'
            columns: ['palet_id']
            referencedRelation: 'palet'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimiento_usuario_id_fkey'
            columns: ['usuario_id']
            referencedRelation: 'usuario'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'movimiento_corrige_a_fkey'
            columns: ['corrige_a']
            referencedRelation: 'movimiento'
            referencedColumns: ['id']
          },
        ]
      }
    }

    /**
     * Vistas de solo lectura para el panel administrativo.
     *
     * Resuelven en Postgres los cruces que el panel necesita —palet con
     * producto, con su vencimiento y con su último movimiento— en lugar de
     * bajarlos todos al navegador para agruparlos ahí.
     *
     * Van con `security_invoker`, así RLS se sigue aplicando: sin eso, una
     * vista corre con los permisos de quien la creó y saltearía las policies.
     */
    Views: {
      vista_palet_gerencia: {
        Row: PaletGerenciaRow
        Relationships: []
      }
      vista_stock_por_producto: {
        Row: StockPorProductoRow
        Relationships: []
      }
    }

    Functions: {
      /**
       * Crea el palet y su detalle en una sola transacción.
       *
       * Es el único camino para dar de alta un palet: hacerlo con dos inserts
       * desde el cliente dejaría el palet sin detalle si el segundo falla,
       * porque PostgREST no puede envolver dos requests en una transacción.
       *
       * No recibe `cantidad_disponible` ni `estado`: los pone el trigger
       * `inicializar_palet()`.
       */
      crear_palet_completo: {
        /**
         * En la base todos estos parámetros salvo los cuatro primeros tienen
         * `DEFAULT NULL`, pero acá van requeridos y nullables: `crearPalet()`
         * los manda siempre, y dejarlos opcionales hace que supabase-js no
         * pueda inferir el tipo de los argumentos.
         */
        Args: {
          p_producto_id: number
          p_lote: string
          p_cantidad_inicial: number
          p_galpon: Galpon
          p_sector: string | null
          p_fecha_ingreso: string | null
          /** Solo se usa si el producto es agroquímico. */
          p_fecha_elaboracion: string | null
          /** Solo se usa si el producto es agroquímico. */
          p_fecha_vencimiento: string | null
          /** Solo se usa si el producto es semilla. */
          p_hibrido: string | null
          /** Solo se usa si el producto es semilla. */
          p_calibre: string | null
          /** `null` = mercadería propia de AIBAR. */
          p_cliente_id: number | null
          /** Primera nota de la bitácora, opcional. */
          p_observacion: string | null
        }
        Returns: PaletRow
      }

      /**
       * Saca un palet de circulación: pasa su estado a `baja` y deja el motivo
       * en la bitácora. El stock no se pone en cero, así queda registrado
       * cuánto había cuando se descartó.
       */
      dar_de_baja_palet: {
        Args: {
          p_palet_id: number
          p_motivo: string
        }
        Returns: PaletRow
      }

      /** Descuenta stock del palet y deja el registro histórico. Solo operarios. */
      registrar_movimiento: {
        Args: {
          p_palet_id: number
          p_tipo: TipoMovimientoRegistrable
          p_cantidad: number
        }
        Returns: MovimientoRow
      }

      /**
       * Única vía que suma stock. Solo el último movimiento del palet,
       * dentro de los 30 minutos, con motivo obligatorio.
       */
      corregir_movimiento: {
        Args: {
          p_movimiento_id: number
          p_motivo: string
        }
        Returns: MovimientoRow
      }

      usuario_activo: {
        Args: Record<never, never>
        Returns: boolean
      }

      es_operario: {
        Args: Record<never, never>
        Returns: boolean
      }

      es_jefe: {
        Args: Record<never, never>
        Returns: boolean
      }
    }

    Enums: Record<never, never>

    CompositeTypes: Record<never, never>
  }
}
