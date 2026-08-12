-- =========================================================
-- AIBAR
-- VISTAS PARA EL PANEL DE GERENCIA
-- =========================================================
--
-- El panel del jefe no pregunta «qué palets hay»: pregunta
-- qué se está por vencer, qué no se mueve y cuánto hay de
-- cada producto. Todas esas respuestas cruzan palet con
-- producto, con el detalle de agroquímico y con la última
-- fecha de movimiento.
--
-- Esos cruces se hacen en la base y no en el navegador. Si
-- se resolvieran en el cliente habría que descargar todos
-- los palets, todos sus detalles y todos sus movimientos en
-- cada apertura del panel, para después agrupar en un
-- celular. Postgres ya sabe hacerlo, y con los índices que
-- el schema tiene.
--
--
-- ⚠️ SEGURIDAD: security_invoker
--
-- Por omisión, una vista de Postgres se ejecuta con los
-- permisos de QUIEN LA CREÓ, no de quien la consulta. Eso
-- saltearía las policies RLS por completo: un usuario
-- inactivo, o el rol anónimo, verían el depósito entero.
--
-- `security_invoker = on` hace que la vista corra con los
-- permisos de quien consulta, así RLS se sigue aplicando
-- sobre las tablas de abajo exactamente igual que hoy.
--
-- Requiere PostgreSQL 15 o superior. Si esta migración falla
-- con «unrecognized parameter security_invoker», la base es
-- anterior y NO hay que quitar la opción para que pase:
-- habría que resolverlo con funciones en vez de vistas.
--
-- =========================================================


-- =========================================================
-- 1. PALETS ENRIQUECIDOS
-- =========================================================
--
-- Un palet con todo lo que el panel necesita para decidir,
-- ya resuelto: su producto, su vencimiento si es
-- agroquímico, y hace cuánto que no se mueve.
--
-- =========================================================

CREATE OR REPLACE VIEW public.vista_palet_gerencia
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

    da.fecha_elaboracion,
    da.fecha_vencimiento,
    ds.hibrido,
    ds.calibre,

    -- Negativo = ya vencido. NULL en semillas y en
    -- agroquímicos sin fecha cargada.
    (da.fecha_vencimiento - CURRENT_DATE) AS dias_para_vencer,

    ultimo.fecha_hora AS ultimo_movimiento,

    -- Un palet que nunca se movió está quieto desde que
    -- entró: por eso el fallback a fecha_ingreso.
    (CURRENT_DATE - COALESCE(ultimo.fecha_hora::date, p.fecha_ingreso))
        AS dias_sin_movimiento

FROM public.palet p

INNER JOIN public.producto pr
    ON pr.id = p.producto_id

LEFT JOIN public.detalle_agroquimico da
    ON da.palet_id = p.id

LEFT JOIN public.detalle_semilla ds
    ON ds.palet_id = p.id

LEFT JOIN LATERAL (
    SELECT max(m.fecha_hora) AS fecha_hora
    FROM public.movimiento m
    WHERE m.palet_id = p.id
) ultimo ON TRUE;


-- =========================================================
-- 2. STOCK CONSOLIDADO POR PRODUCTO
-- =========================================================
--
-- Responde «¿tengo para cubrir este pedido?» sin recorrer
-- palet por palet, y muestra en cuántos está repartido: un
-- producto con 400 litros en un palet no es lo mismo que
-- con 400 repartidos en ocho abiertos a medias.
--
-- =========================================================

CREATE OR REPLACE VIEW public.vista_stock_por_producto
WITH (security_invoker = on)
AS
SELECT
    pr.id             AS producto_id,
    pr.nombre         AS producto_nombre,
    pr.categoria      AS producto_categoria,
    pr.unidad_medida  AS producto_unidad_medida,

    COALESCE(sum(p.cantidad_disponible), 0) AS total_disponible,

    count(p.id) FILTER (
        WHERE p.estado IN ('activo', 'parcial')
    ) AS palets_con_stock,

    count(p.id) FILTER (
        WHERE p.estado = 'parcial'
    ) AS palets_parciales,

    -- En qué galpones está repartido.
    COALESCE(
        array_agg(DISTINCT p.galpon) FILTER (
            WHERE p.estado IN ('activo', 'parcial')
        ),
        '{}'
    ) AS galpones,

    -- El vencimiento más próximo entre los palets que
    -- todavía tienen stock: es el que marca la urgencia.
    min(da.fecha_vencimiento) FILTER (
        WHERE p.estado IN ('activo', 'parcial')
    ) AS proximo_vencimiento

FROM public.producto pr

LEFT JOIN public.palet p
    ON p.producto_id = pr.id

LEFT JOIN public.detalle_agroquimico da
    ON da.palet_id = p.id

GROUP BY pr.id, pr.nombre, pr.categoria, pr.unidad_medida;


-- =========================================================
-- 3. PERMISOS
-- =========================================================
--
-- Solo lectura, y para usuarios autenticados. RLS sobre las
-- tablas de abajo sigue filtrando gracias a security_invoker,
-- así que un usuario inactivo no ve nada.
--
-- =========================================================

GRANT SELECT ON public.vista_palet_gerencia TO authenticated;
GRANT SELECT ON public.vista_stock_por_producto TO authenticated;

REVOKE ALL ON public.vista_palet_gerencia FROM anon;
REVOKE ALL ON public.vista_stock_por_producto FROM anon;


-- =========================================================
-- FIN
-- =========================================================
