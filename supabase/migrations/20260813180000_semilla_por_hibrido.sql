-- =========================================================
-- AIBAR
-- LA SEMILLA SE IDENTIFICA POR SU HÍBRIDO
-- =========================================================
--
-- QUÉ CAMBIA
--
-- Al dar de alta una semilla, el operario ya no elige un
-- producto de una lista: escribe el híbrido (DK 7210) y con
-- eso alcanza. Es el dato que tiene a mano —está impreso en
-- la bolsa— y es lo que en los hechos identifica a la
-- semilla. Buscar «Maíz DK 7210» en un catálogo mezclado con
-- agroquímicos era un paso de más para llegar al mismo lugar.
--
-- Por debajo el producto se sigue necesitando: es lo que
-- permite sumar el stock por variedad en el panel. Así que la
-- función lo resuelve sola: si ese híbrido ya existe lo
-- reutiliza, y si es la primera vez que entra, lo crea.
--
-- Los agroquímicos no cambian: se siguen eligiendo de la
-- lista, porque ahí el nombre comercial no lo define el
-- operario y escribirlo a mano llenaría el catálogo de
-- variantes del mismo producto.
--
--
-- CÓMO SE CORRE
--
-- En el SQL Editor, entero y de una vez. Requiere que ya esté
-- aplicada la migración de sectores.
--
-- =========================================================

BEGIN;


-- =========================================================
-- 1. UNIDAD POR DEFECTO DE UNA SEMILLA NUEVA
-- =========================================================
--
-- El producto necesita una unidad de medida y el formulario
-- de semilla no la pide: son cuatro campos y ninguno es este.
-- Se usa 'bolsa', que es como se recibe y se cuenta la
-- semilla en el depósito.
--
-- Si alguna variedad se maneja en kilos, se corrige desde el
-- catálogo una vez: los palets siguientes de ese híbrido
-- reutilizan el producto y heredan la unidad corregida.
--
-- =========================================================

CREATE OR REPLACE FUNCTION public.obtener_o_crear_semilla(p_hibrido VARCHAR)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_hibrido VARCHAR;
    v_id      BIGINT;
BEGIN

    v_hibrido := NULLIF(btrim(p_hibrido), '');

    IF v_hibrido IS NULL THEN
        RAISE EXCEPTION 'Poné el híbrido de la semilla';
    END IF;

    -- Sin distinguir mayúsculas ni espacios: 'DK 7210' y
    -- 'dk 7210' son la misma variedad, y dejar que convivan
    -- partiría el stock de una semilla en dos productos.
    SELECT id INTO v_id
      FROM public.producto
     WHERE categoria = 'semilla'
       AND upper(btrim(hibrido)) = upper(v_hibrido)
     LIMIT 1;

    IF v_id IS NOT NULL THEN
        RETURN v_id;
    END IF;

    -- Primera vez que entra esta variedad.
    BEGIN
        INSERT INTO public.producto (nombre, categoria, unidad_medida, hibrido)
        VALUES (v_hibrido, 'semilla', 'bolsa', v_hibrido)
        RETURNING id INTO v_id;
    EXCEPTION WHEN unique_violation THEN
        -- Dos operarios cargando el mismo híbrido a la vez: el
        -- que perdió la carrera se queda con el que creó el
        -- otro, en vez de fallar el alta entera.
        SELECT id INTO v_id
          FROM public.producto
         WHERE categoria = 'semilla'
           AND upper(btrim(hibrido)) = upper(v_hibrido)
         LIMIT 1;

        IF v_id IS NULL THEN
            -- El choque fue por `nombre`, no por híbrido: ya
            -- hay un producto que se llama igual.
            SELECT id INTO v_id
              FROM public.producto
             WHERE upper(btrim(nombre)) = upper(v_hibrido)
             LIMIT 1;
        END IF;
    END;

    IF v_id IS NULL THEN
        RAISE EXCEPTION 'No se pudo registrar la semilla %', v_hibrido;
    END IF;

    RETURN v_id;

END;
$$;

REVOKE ALL ON FUNCTION public.obtener_o_crear_semilla(VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.obtener_o_crear_semilla(VARCHAR) TO authenticated;


-- =========================================================
-- 2. EL ALTA ACEPTA UN HÍBRIDO EN LUGAR DE UN PRODUCTO
-- =========================================================
--
-- `p_producto_id` pasa a ser opcional: se manda en
-- agroquímicos, y en semillas va `p_hibrido` en su lugar.
-- Exactamente uno de los dos, nunca ninguno ni los dos.
--
-- Todo sigue pasando en una sola transacción: si el detalle
-- falla, no queda ni el palet ni el producto que se acaba de
-- crear.
--
-- =========================================================

DROP FUNCTION IF EXISTS public.crear_palet_completo(
    BIGINT, VARCHAR, NUMERIC, BIGINT, DATE, DATE, DATE,
    VARCHAR, VARCHAR, BIGINT, VARCHAR
);

CREATE OR REPLACE FUNCTION public.crear_palet_completo(
    p_lote              VARCHAR,
    p_cantidad_inicial  NUMERIC,
    p_sector_id         BIGINT,
    p_producto_id       BIGINT  DEFAULT NULL,
    p_hibrido           VARCHAR DEFAULT NULL,
    p_calibre           VARCHAR DEFAULT NULL,
    p_fecha_ingreso     DATE    DEFAULT NULL,
    p_fecha_elaboracion DATE    DEFAULT NULL,
    p_fecha_vencimiento DATE    DEFAULT NULL,
    p_cliente_id        BIGINT  DEFAULT NULL,
    p_observacion       VARCHAR DEFAULT NULL
)
RETURNS public.palet
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_producto_id BIGINT;
    v_categoria   VARCHAR(20);
    v_sector      public.sector;
    v_palet       public.palet;
BEGIN

    IF NOT public.es_operario() THEN
        RAISE EXCEPTION 'Solo los operarios pueden dar de alta palets';
    END IF;

    -- ----- Qué es lo que entró -----
    IF p_producto_id IS NULL THEN
        -- Semilla: el híbrido la identifica.
        v_producto_id := public.obtener_o_crear_semilla(p_hibrido);
    ELSE
        v_producto_id := p_producto_id;
    END IF;

    SELECT categoria
      INTO v_categoria
      FROM public.producto
     WHERE id = v_producto_id;

    IF v_categoria IS NULL THEN
        RAISE EXCEPTION 'El producto no existe';
    END IF;

    -- ----- Dónde queda -----
    IF p_sector_id IS NULL THEN
        RAISE EXCEPTION 'Elegí en qué sector queda el palet';
    END IF;

    SELECT * INTO v_sector
      FROM public.sector
     WHERE id = p_sector_id;

    IF v_sector IS NULL THEN
        RAISE EXCEPTION 'El sector indicado no existe';
    END IF;

    IF NOT v_sector.activo THEN
        RAISE EXCEPTION 'El sector % ya no está en uso. Elegí otro.', v_sector.nombre;
    END IF;

    -- ----- De quién es -----
    IF p_cliente_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM public.cliente WHERE id = p_cliente_id
       ) THEN
        RAISE EXCEPTION 'El cliente indicado no existe';
    END IF;

    INSERT INTO public.palet (
        producto_id,
        lote,
        cantidad_inicial,
        galpon,
        sector_id,
        fecha_ingreso,
        cliente_id
    )
    VALUES (
        v_producto_id,
        p_lote,
        p_cantidad_inicial,
        v_sector.galpon,
        p_sector_id,
        COALESCE(p_fecha_ingreso, CURRENT_DATE),
        p_cliente_id
    )
    RETURNING * INTO v_palet;

    IF v_categoria = 'agroquimico' THEN

        INSERT INTO public.detalle_agroquimico (
            palet_id,
            fecha_elaboracion,
            fecha_vencimiento
        )
        VALUES (
            v_palet.id,
            p_fecha_elaboracion,
            p_fecha_vencimiento
        );

    ELSIF v_categoria = 'semilla' THEN

        INSERT INTO public.detalle_semilla (
            palet_id,
            hibrido,
            calibre
        )
        VALUES (
            v_palet.id,
            NULLIF(btrim(p_hibrido), ''),
            NULLIF(btrim(p_calibre), '')
        );

    ELSE
        RAISE EXCEPTION 'Categoría de producto desconocida: %', v_categoria;
    END IF;

    IF NULLIF(btrim(p_observacion), '') IS NOT NULL THEN
        INSERT INTO public.observacion_palet (palet_id, usuario_id, texto)
        VALUES (v_palet.id, auth.uid(), btrim(p_observacion));
    END IF;

    RETURN v_palet;

END;
$$;

REVOKE ALL ON FUNCTION public.crear_palet_completo(
    VARCHAR, NUMERIC, BIGINT, BIGINT, VARCHAR, VARCHAR,
    DATE, DATE, DATE, BIGINT, VARCHAR
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.crear_palet_completo(
    VARCHAR, NUMERIC, BIGINT, BIGINT, VARCHAR, VARCHAR,
    DATE, DATE, DATE, BIGINT, VARCHAR
) TO authenticated;


-- =========================================================
-- 3. EL HÍBRIDO ES ÚNICO ENTRE LAS SEMILLAS
-- =========================================================
--
-- Es lo que sostiene la búsqueda de la sección 1: sin esto,
-- dos altas simultáneas del mismo híbrido crearían dos
-- productos y el stock de esa variedad quedaría partido en
-- dos filas del panel.
--
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS producto_hibrido_unico
    ON public.producto (upper(btrim(hibrido)))
    WHERE categoria = 'semilla' AND hibrido IS NOT NULL;


COMMIT;
