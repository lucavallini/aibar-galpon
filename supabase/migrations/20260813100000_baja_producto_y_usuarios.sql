-- =========================================================
-- AIBAR
-- BAJA DE PALET, PRODUCTO AMPLIADO Y GESTIÓN DE USUARIOS
-- =========================================================
--
-- Tres huecos que dejó el uso real:
--
-- 1. No había forma de dar de baja un palet desde la app.
--    Mercadería vencida o rota seguía figurando como stock.
--
-- 2. `producto.nombre` era todo lo que había: no se podía
--    filtrar por marca ni por principio activo, que es lo que
--    hace falta para saber qué se puede aplicar y qué se le
--    compró a cada proveedor.
--
-- 3. Los roles se cambiaban con UPDATE manual contra la base.
--
-- =========================================================


-- =========================================================
-- 1. PRODUCTO: MARCA, PRINCIPIO ACTIVO Y CONCENTRACIÓN
-- =========================================================
--
-- Todas opcionales: hay productos cargados sin estos datos y
-- no se los puede obligar a completar retroactivamente.
--
-- El principio activo aplica a los agroquímicos —una semilla
-- no tiene— pero no se fuerza por CHECK: obligar a dejarlo
-- vacío en semillas solo agregaría errores al alta.
--
-- =========================================================

ALTER TABLE public.producto
ADD COLUMN IF NOT EXISTS marca VARCHAR(100);

ALTER TABLE public.producto
ADD COLUMN IF NOT EXISTS principio_activo VARCHAR(150);

ALTER TABLE public.producto
ADD COLUMN IF NOT EXISTS concentracion VARCHAR(50);


-- Para filtrar «todo lo de Bayer» y «todo lo que lleve
-- glifosato» sin recorrer la tabla entera.
CREATE INDEX IF NOT EXISTS idx_producto_marca
ON public.producto(marca);

CREATE INDEX IF NOT EXISTS idx_producto_principio_activo
ON public.producto(principio_activo);


-- =========================================================
-- 2. DAR DE BAJA UN PALET
-- =========================================================
--
-- SECURITY DEFINER, a diferencia de crear_palet_completo():
-- acá SÍ hay que saltear un trigger. proteger_stock_palet()
-- bloquea cualquier cambio de `estado` que venga del cliente,
-- y esta función necesita justamente eso.
--
-- El motivo es obligatorio y queda en la bitácora del palet:
-- dar de baja mercadería es sacarla del stock, y después
-- alguien va a preguntar por qué.
--
-- El stock NO se pone en cero: el palet se congela como
-- estaba. Así queda registrado cuánto había cuando se
-- descartó, que es el dato que importa para saber qué se
-- perdió.
--
-- =========================================================

CREATE OR REPLACE FUNCTION public.dar_de_baja_palet(
    p_palet_id BIGINT,
    p_motivo VARCHAR
)
RETURNS public.palet
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$

DECLARE
    v_usuario_id UUID;
    v_palet public.palet%ROWTYPE;
    v_motivo VARCHAR(500);

BEGIN

    v_usuario_id := auth.uid();

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    IF NOT public.es_operario() THEN
        RAISE EXCEPTION
            'Solo los operarios pueden dar de baja un palet';
    END IF;


    v_motivo := NULLIF(btrim(p_motivo), '');

    IF v_motivo IS NULL THEN
        RAISE EXCEPTION
            'Es obligatorio indicar el motivo de la baja';
    END IF;


    SELECT *
    INTO v_palet
    FROM public.palet
    WHERE id = p_palet_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El palet no existe';
    END IF;

    IF v_palet.estado = 'baja' THEN
        RAISE EXCEPTION
            'El palet ya estaba dado de baja';
    END IF;


    UPDATE public.palet
    SET estado = 'baja'
    WHERE id = p_palet_id;


    -- La baja queda explicada en la bitácora, junto al resto
    -- de lo que le pasó al palet.
    INSERT INTO public.observacion_palet (
        palet_id,
        usuario_id,
        texto
    )
    VALUES (
        p_palet_id,
        v_usuario_id,
        'BAJA: ' || v_motivo
    );


    SELECT *
    INTO v_palet
    FROM public.palet
    WHERE id = p_palet_id;

    RETURN v_palet;

END;
$$;


REVOKE ALL
ON FUNCTION public.dar_de_baja_palet(BIGINT, VARCHAR)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.dar_de_baja_palet(BIGINT, VARCHAR)
TO authenticated;

REVOKE EXECUTE
ON FUNCTION public.dar_de_baja_palet(BIGINT, VARCHAR)
FROM anon;


-- =========================================================
-- 3. GESTIÓN DE USUARIOS POR EL GERENTE
-- =========================================================
--
-- El jefe puede activar, desactivar y cambiar el rol de los
-- demás. Es la única escritura que se le permite, y es
-- deliberada: sin ella los roles se cambian con SQL manual.
--
-- Lo que NO puede:
--   - Cambiarse el rol a sí mismo ni desactivarse. Un jefe
--     que se quita el rol por error deja el sistema sin nadie
--     que pueda devolvérselo.
--   - Crear usuarios. Eso vive en auth.users y necesita la
--     service_role, que jamás va al navegador: lo hace una
--     Edge Function que valida el rol antes de crear.
--
-- =========================================================

CREATE POLICY "usuario_update_jefe"
ON public.usuario
FOR UPDATE
TO authenticated
USING (
    public.es_jefe()
    AND id <> auth.uid()
)
WITH CHECK (
    public.es_jefe()
    AND id <> auth.uid()
);


-- El nombre y la fecha de alta no se tocan desde la app: lo
-- único administrable es el rol y si está activo.
REVOKE UPDATE
ON public.usuario
FROM authenticated;

GRANT UPDATE (rol, activo)
ON public.usuario
TO authenticated;


-- =========================================================
-- 4. VISTAS: SUMAR LOS DATOS NUEVOS DEL PRODUCTO
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
    p.galpon,
    p.sector,
    p.fecha_ingreso,
    p.estado,

    pr.nombre         AS producto_nombre,
    pr.categoria      AS producto_categoria,
    pr.unidad_medida  AS producto_unidad_medida,
    pr.marca          AS producto_marca,
    pr.principio_activo AS producto_principio_activo,
    pr.concentracion  AS producto_concentracion,

    p.cliente_id,
    c.nombre          AS cliente_nombre,

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


DROP VIEW IF EXISTS public.vista_stock_por_producto;


CREATE VIEW public.vista_stock_por_producto
WITH (security_invoker = on)
AS
SELECT
    pr.id             AS producto_id,
    pr.nombre         AS producto_nombre,
    pr.categoria      AS producto_categoria,
    pr.unidad_medida  AS producto_unidad_medida,
    pr.marca          AS producto_marca,
    pr.principio_activo AS producto_principio_activo,
    pr.concentracion  AS producto_concentracion,

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

GROUP BY pr.id, pr.nombre, pr.categoria, pr.unidad_medida,
         pr.marca, pr.principio_activo, pr.concentracion;


GRANT SELECT ON public.vista_stock_por_producto TO authenticated;
REVOKE ALL ON public.vista_stock_por_producto FROM anon;


-- =========================================================
-- FIN
-- =========================================================
