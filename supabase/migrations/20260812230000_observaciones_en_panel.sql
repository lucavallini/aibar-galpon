-- =========================================================
-- AIBAR
-- OBSERVACIONES A LA VISTA EN EL PANEL DE GERENCIA
-- =========================================================
--
-- El panel mostraba cuántas observaciones tenía cada palet,
-- pero para leerlas había que entrar uno por uno. Un jefe
-- que quiere saber qué novedades hubo en el depósito no va a
-- abrir treinta palets para averiguarlo.
--
-- La vista pasa a traer la última nota de cada palet —texto,
-- fecha y autor— para que se lea directamente en el listado.
--
-- Se resuelve con un LATERAL en la base y no trayendo todas
-- las observaciones al navegador: así sigue siendo una sola
-- consulta, sin una por palet.
--
-- =========================================================

-- CREATE OR REPLACE no permite insertar columnas en el medio
-- de una vista existente, y estas van junto al resto de la
-- información del palet.
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

    -- La última nota, para leerla sin entrar al palet.
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
    SELECT
        o.texto,
        o.created_at,
        u.nombre AS autor
    FROM public.observacion_palet o
    LEFT JOIN public.usuario u
        ON u.id = o.usuario_id
    WHERE o.palet_id = p.id
    ORDER BY o.created_at DESC, o.id DESC
    LIMIT 1
) ultima_obs ON TRUE;


GRANT SELECT ON public.vista_palet_gerencia TO authenticated;
REVOKE ALL ON public.vista_palet_gerencia FROM anon;


-- =========================================================
-- FIN
-- =========================================================
