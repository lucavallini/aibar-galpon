-- =========================================================
-- AIBAR
-- LA UNIDAD DE MEDIDA ES DEL PALET, NO DEL PRODUCTO
-- =========================================================
--
-- QUÉ CAMBIA
--
-- Hasta ahora la unidad vivía en el producto: una vez que
-- «Maíz» quedaba cargado en bolsas, todos sus palets eran
-- bolsas para siempre. En el depósito no funciona así — de la
-- misma semilla entra una partida en bolsas y otra a granel
-- en kilos, y del mismo agroquímico entran bidones de 20
-- litros y tambores. La unidad es de lo que entró, o sea del
-- palet.
--
-- Con eso el producto se vuelve lo que tiene que ser: qué
-- cosa es y nada más. Una semilla es un nombre —Soja, Maíz—;
-- un agroquímico es un nombre y su concentración. Todo lo que
-- cambia de partida en partida —lote, híbrido, calibre,
-- vencimiento, cantidad y ahora la unidad— vive en el palet.
--
--
-- QUÉ PASA CON LOS PALETS QUE YA ESTÁN
--
-- Cada uno hereda la unidad que tenía su producto: nada
-- cambia de valor, solo de lugar. Ningún palet queda sin
-- unidad.
--
--
-- CÓMO SE CORRE
--
-- En el SQL Editor, entero y de una vez. Va en una
-- transacción: si algo falla, no queda nada a medias.
--
-- =========================================================

BEGIN;


-- =========================================================
-- 1. LA COLUMNA NUEVA
-- =========================================================
--
-- Se agrega nullable, se completa con lo que ya había, y
-- recién ahí se pone NOT NULL: al revés fallaría contra
-- cualquier base que ya tenga palets.
--
-- =========================================================

ALTER TABLE public.palet
ADD COLUMN IF NOT EXISTS unidad_medida VARCHAR(20);


UPDATE public.palet p
SET unidad_medida = pr.unidad_medida
FROM public.producto pr
WHERE pr.id = p.producto_id
  AND p.unidad_medida IS NULL;


-- Un palet cuyo producto tampoco la tenía: 'unidad' es el
-- recuento más neutro que se puede afirmar sin inventar nada.
UPDATE public.palet
SET unidad_medida = 'unidad'
WHERE unidad_medida IS NULL;


ALTER TABLE public.palet
ALTER COLUMN unidad_medida SET NOT NULL;


-- Espeja lo que ya hace `sector.nombre`: una cadena de
-- espacios no es una unidad, y pasaría un NOT NULL pelado.
ALTER TABLE public.palet
DROP CONSTRAINT IF EXISTS palet_unidad_medida_no_vacia;

ALTER TABLE public.palet
ADD CONSTRAINT palet_unidad_medida_no_vacia
    CHECK (btrim(unidad_medida) <> '');


COMMENT ON COLUMN public.palet.unidad_medida IS
    'En qué se cuenta lo que entró en este palet: bolsas, '
    'litros, kilos. Es del palet y no del producto porque '
    'dos partidas del mismo producto pueden venir en '
    'unidades distintas.';


-- =========================================================
-- 2. EL PRODUCTO YA NO NECESITA UNIDAD
-- =========================================================
--
-- La columna se conserva —los productos que ya están la
-- tienen cargada y sirve como referencia de cómo suele venir
-- ese producto— pero deja de ser obligatoria: el alta de
-- producto ya no la pide.
--
-- No se borra porque borrar una columna es irreversible y no
-- hay nada que ganar con hacerlo hoy.
--
-- =========================================================

ALTER TABLE public.producto
ALTER COLUMN unidad_medida DROP NOT NULL;


COMMENT ON COLUMN public.producto.unidad_medida IS
    'Cómo suele venir este producto. Es solo referencia: la '
    'unidad con la que se cuenta el stock es la del palet.';


-- =========================================================
-- 3. EL ALTA DE PALET RECIBE LA UNIDAD
-- =========================================================
--
-- Es el único lugar donde se fija: `unidad_medida` no está en
-- el GRANT UPDATE de palet, así que después del alta no se
-- cambia desde el cliente, igual que `cantidad_inicial`.
--
-- Sigue aceptando un palet de semilla sin `p_producto_id`
-- —resolviéndolo por el híbrido— para no romper nada que ya
-- esté llamando así, pero la app manda siempre el producto:
-- ahora la semilla también se elige de la lista.
--
-- =========================================================

-- Las tres firmas anteriores, para que no queden sobrecargas conviviendo: con
-- dos versiones cargadas, cuál se ejecuta depende de qué parámetros mande el
-- cliente, y una de ellas no sabe nada de `unidad_medida`.
DROP FUNCTION IF EXISTS public.crear_palet_completo(
    BIGINT, VARCHAR, NUMERIC, SMALLINT, VARCHAR, DATE,
    DATE, DATE, VARCHAR, VARCHAR
);

DROP FUNCTION IF EXISTS public.crear_palet_completo(
    BIGINT, VARCHAR, NUMERIC, BIGINT, DATE, DATE, DATE,
    VARCHAR, VARCHAR, BIGINT, VARCHAR
);

DROP FUNCTION IF EXISTS public.crear_palet_completo(
    VARCHAR, NUMERIC, BIGINT, BIGINT, VARCHAR, VARCHAR,
    DATE, DATE, DATE, BIGINT, VARCHAR
);

CREATE OR REPLACE FUNCTION public.crear_palet_completo(
    p_lote              VARCHAR,
    p_cantidad_inicial  NUMERIC,
    p_sector_id         BIGINT,
    p_unidad_medida     VARCHAR DEFAULT NULL,
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
    v_unidad      VARCHAR(20);
    v_sector      public.sector;
    v_palet       public.palet;
BEGIN

    IF NOT public.es_operario() THEN
        RAISE EXCEPTION 'Solo los operarios pueden dar de alta palets';
    END IF;

    -- ----- Qué es lo que entró -----
    IF p_producto_id IS NULL THEN
        -- Compatibilidad: una semilla identificada solo por su híbrido.
        v_producto_id := public.obtener_o_crear_semilla(p_hibrido);
    ELSE
        v_producto_id := p_producto_id;
    END IF;

    SELECT categoria, unidad_medida
      INTO v_categoria, v_unidad
      FROM public.producto
     WHERE id = v_producto_id;

    IF v_categoria IS NULL THEN
        RAISE EXCEPTION 'El producto no existe';
    END IF;

    -- ----- En qué se cuenta -----
    --
    -- Si no viene, se cae a la del producto —así siguen
    -- funcionando las llamadas viejas— y si tampoco la tiene,
    -- se cuenta por unidades antes que rechazar el alta.
    v_unidad := COALESCE(
        NULLIF(btrim(p_unidad_medida), ''),
        NULLIF(btrim(v_unidad), ''),
        'unidad'
    );

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
        unidad_medida,
        galpon,
        sector_id,
        fecha_ingreso,
        cliente_id
    )
    VALUES (
        v_producto_id,
        p_lote,
        p_cantidad_inicial,
        v_unidad,
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
    VARCHAR, NUMERIC, BIGINT, VARCHAR, BIGINT, VARCHAR, VARCHAR,
    DATE, DATE, DATE, BIGINT, VARCHAR
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.crear_palet_completo(
    VARCHAR, NUMERIC, BIGINT, VARCHAR, BIGINT, VARCHAR, VARCHAR,
    DATE, DATE, DATE, BIGINT, VARCHAR
) TO authenticated;


-- =========================================================
-- 4. LAS VISTAS MIRAN LA UNIDAD DEL PALET
-- =========================================================
--
-- `producto_unidad_medida` pasa a llamarse `unidad_medida`:
-- el nombre viejo diría de dónde sale el dato, y ya no sale
-- de ahí.
--
-- ⚠️ Las dos van con `security_invoker = on`. Sin eso una
-- vista corre con los permisos de quien la creó y saltea RLS,
-- lo que expondría el depósito entero a cualquier usuario
-- autenticado, incluso uno inactivo.
--
-- =========================================================

DROP VIEW IF EXISTS public.vista_palet_gerencia;


CREATE VIEW public.vista_palet_gerencia
WITH (security_invoker = on)
AS
SELECT
    p.id,
    p.producto_id,
    p.lote,
    p.cantidad_inicial,
    p.cantidad_disponible,
    p.unidad_medida,
    p.galpon,
    p.sector,
    p.fecha_ingreso,
    p.estado,

    pr.nombre           AS producto_nombre,
    pr.categoria        AS producto_categoria,
    pr.marca            AS producto_marca,
    pr.principio_activo AS producto_principio_activo,
    pr.concentracion    AS producto_concentracion,

    p.cliente_id,
    c.nombre            AS cliente_nombre,

    da.fecha_elaboracion,
    da.fecha_vencimiento,
    ds.hibrido,
    ds.calibre,

    (da.fecha_vencimiento - CURRENT_DATE) AS dias_para_vencer,

    ultimo.fecha_hora AS ultimo_movimiento,

    (CURRENT_DATE - COALESCE(ultimo.fecha_hora::date, p.fecha_ingreso))
        AS dias_sin_movimiento,

    COALESCE(obs.cantidad, 0) AS cantidad_observaciones,

    ultima_obs.texto      AS ultima_observacion,
    ultima_obs.created_at AS ultima_observacion_fecha,
    ultima_obs.autor      AS ultima_observacion_autor

FROM public.palet p

INNER JOIN public.producto pr
    ON pr.id = p.producto_id

LEFT JOIN public.cliente c
    ON c.id = p.cliente_id

LEFT JOIN public.detalle_agroquimico da
    ON da.palet_id = p.id

LEFT JOIN public.detalle_semilla ds
    ON ds.palet_id = p.id

LEFT JOIN LATERAL (
    SELECT max(m.fecha_hora) AS fecha_hora
    FROM public.movimiento m
    WHERE m.palet_id = p.id
) ultimo ON TRUE

LEFT JOIN LATERAL (
    SELECT count(*) AS cantidad
    FROM public.observacion_palet o
    WHERE o.palet_id = p.id
) obs ON TRUE

LEFT JOIN LATERAL (
    SELECT o.texto, o.created_at, u.nombre AS autor
    FROM public.observacion_palet o
    LEFT JOIN public.usuario u ON u.id = o.usuario_id
    WHERE o.palet_id = p.id
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT 1
) ultima_obs ON TRUE;


GRANT SELECT ON public.vista_palet_gerencia TO authenticated;
REVOKE ALL ON public.vista_palet_gerencia FROM anon;


-- ---------------------------------------------------------
-- STOCK CONSOLIDADO: UNA LÍNEA POR PRODUCTO Y UNIDAD
-- ---------------------------------------------------------
--
-- Desde que la unidad es del palet, un producto puede tener
-- stock en dos unidades a la vez: 120 bolsas de maíz y 400
-- kilos del mismo maíz a granel. Sumarlos daría 520 de nada.
--
-- Por eso el agrupamiento incluye la unidad: son dos líneas
-- distintas, cada una con su total, que es lo único que se
-- puede afirmar sin inventar una conversión que el sistema no
-- conoce.
--
-- ---------------------------------------------------------

DROP VIEW IF EXISTS public.vista_stock_por_producto;


CREATE VIEW public.vista_stock_por_producto
WITH (security_invoker = on)
AS
SELECT
    pr.id               AS producto_id,
    pr.nombre           AS producto_nombre,
    pr.categoria        AS producto_categoria,
    pr.marca            AS producto_marca,
    pr.principio_activo AS producto_principio_activo,
    pr.concentracion    AS producto_concentracion,

    -- Un producto sin ningún palet no tiene unidad todavía:
    -- se muestra en unidades para que igual aparezca en el
    -- catálogo del panel con su stock en cero.
    COALESCE(p.unidad_medida, 'unidad') AS unidad_medida,

    COALESCE(sum(p.cantidad_disponible) FILTER (
        WHERE p.estado IN ('activo', 'parcial')
    ), 0) AS total_disponible,

    count(p.id) FILTER (
        WHERE p.estado IN ('activo', 'parcial')
    ) AS palets_con_stock,

    count(p.id) FILTER (
        WHERE p.estado = 'parcial'
    ) AS palets_parciales,

    COALESCE(
        array_agg(DISTINCT p.galpon) FILTER (
            WHERE p.estado IN ('activo', 'parcial')
        ),
        '{}'
    ) AS galpones,

    min(da.fecha_vencimiento) FILTER (
        WHERE p.estado IN ('activo', 'parcial')
    ) AS proximo_vencimiento

FROM public.producto pr

LEFT JOIN public.palet p
    ON p.producto_id = pr.id

LEFT JOIN public.detalle_agroquimico da
    ON da.palet_id = p.id

GROUP BY pr.id, pr.nombre, pr.categoria, pr.marca,
         pr.principio_activo, pr.concentracion,
         COALESCE(p.unidad_medida, 'unidad');


GRANT SELECT ON public.vista_stock_por_producto TO authenticated;
REVOKE ALL ON public.vista_stock_por_producto FROM anon;


COMMIT;


-- =========================================================
-- FIN
-- =========================================================
