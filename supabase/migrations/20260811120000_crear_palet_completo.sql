-- =========================================================
-- AIBAR
-- ALTA DE PALET COMPLETO (palet + detalle)
-- =========================================================
--
-- PROBLEMA QUE RESUELVE
--
-- Un palet y su detalle son una sola cosa desde el punto de
-- vista del negocio, pero viven en dos tablas. Desde el
-- cliente eso son dos requests HTTP contra PostgREST, y
-- PostgREST no puede envolver dos requests en una misma
-- transacción: entre el INSERT del palet y el del detalle
-- hay una ventana en la que el palet existe incompleto, y
-- si la red se corta ahí, queda así para siempre.
--
-- Esta función hace los dos INSERT dentro de una única
-- transacción. O se crean los dos, o no se crea ninguno.
--
--
-- SEGURIDAD: SECURITY INVOKER (el valor por omisión)
--
-- A diferencia de registrar_movimiento() y
-- corregir_movimiento(), esta función NO es SECURITY
-- DEFINER, y es a propósito.
--
-- Aquellas necesitan DEFINER porque tienen que saltear el
-- trigger proteger_stock_palet(). Esta no necesita saltear
-- nada: el operario ya tiene permiso de INSERT por las
-- policies palet_insert_operario, agroquimico_insert_operario
-- y semilla_insert_operario.
--
-- Con INVOKER, RLS se sigue aplicando adentro de la función.
-- Ponerle DEFINER abriría un agujero: cualquier usuario
-- autenticado podría crear palets salteándose su policy.
--
--
-- STOCK
--
-- No se pasan cantidad_disponible ni estado: los fija el
-- trigger inicializar_palet() a partir de cantidad_inicial.
-- Mandarlos sería redundante y frágil.
--
-- =========================================================

CREATE OR REPLACE FUNCTION public.crear_palet_completo(
    p_producto_id BIGINT,
    p_lote VARCHAR,
    p_cantidad_inicial NUMERIC,
    p_galpon SMALLINT,
    p_sector VARCHAR DEFAULT NULL,
    p_fecha_ingreso DATE DEFAULT NULL,

    -- Solo se usan si el producto es agroquímico
    p_fecha_elaboracion DATE DEFAULT NULL,
    p_fecha_vencimiento DATE DEFAULT NULL,

    -- Solo se usan si el producto es semilla
    p_hibrido VARCHAR DEFAULT NULL,
    p_calibre VARCHAR DEFAULT NULL
)
RETURNS public.palet
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$

DECLARE
    v_categoria VARCHAR(20);
    v_palet public.palet%ROWTYPE;

BEGIN

    -- =====================================================
    -- 1. Verificar operario
    -- =====================================================
    --
    -- Las policies ya lo impedirían, pero el error que
    -- devuelve RLS ('new row violates row-level security
    -- policy') no le dice nada al operario. Este chequeo
    -- existe solo para dar un mensaje legible.
    --
    -- =====================================================

    IF NOT public.es_operario() THEN
        RAISE EXCEPTION
            'Solo los operarios pueden dar de alta palets';
    END IF;


    -- =====================================================
    -- 2. Obtener la categoría del producto
    -- =====================================================
    --
    -- Es la que decide qué tabla de detalle corresponde.
    --
    -- =====================================================

    SELECT categoria
    INTO v_categoria
    FROM public.producto
    WHERE id = p_producto_id;

    IF v_categoria IS NULL THEN
        RAISE EXCEPTION
            'El producto indicado no existe';
    END IF;


    -- =====================================================
    -- 3. Crear el palet
    -- =====================================================
    --
    -- Sin cantidad_disponible ni estado: los pone el
    -- trigger inicializar_palet().
    --
    -- =====================================================

    INSERT INTO public.palet (
        producto_id,
        lote,
        cantidad_inicial,
        galpon,
        sector,
        fecha_ingreso
    )
    VALUES (
        p_producto_id,
        p_lote,
        p_cantidad_inicial,
        p_galpon,
        NULLIF(btrim(p_sector), ''),
        COALESCE(p_fecha_ingreso, CURRENT_DATE)
    )
    RETURNING *
    INTO v_palet;


    -- =====================================================
    -- 4. Crear el detalle que corresponda
    -- =====================================================
    --
    -- Se inserta siempre, aunque sus campos vengan en NULL,
    -- para que todo palet tenga la fila de detalle de su
    -- categoría y las consultas posteriores sean uniformes.
    --
    -- Los campos de la otra categoría se ignoran. Si igual
    -- se colaran, los triggers validar_detalle_agroquimico()
    -- y validar_detalle_semilla() los rechazarían.
    --
    -- =====================================================

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

        RAISE EXCEPTION
            'Categoría de producto desconocida: %',
            v_categoria;

    END IF;


    -- =====================================================
    -- 5. Devolver el palet creado
    -- =====================================================
    --
    -- Se relee para que cantidad_disponible y estado vengan
    -- con los valores que puso el trigger, y no con los que
    -- tenía la fila antes de dispararse.
    --
    -- =====================================================

    SELECT *
    INTO v_palet
    FROM public.palet
    WHERE id = v_palet.id;

    RETURN v_palet;

END;
$$;


-- =========================================================
-- PERMISOS
-- =========================================================

REVOKE ALL
ON FUNCTION public.crear_palet_completo(
    BIGINT, VARCHAR, NUMERIC, SMALLINT, VARCHAR, DATE,
    DATE, DATE, VARCHAR, VARCHAR
)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.crear_palet_completo(
    BIGINT, VARCHAR, NUMERIC, SMALLINT, VARCHAR, DATE,
    DATE, DATE, VARCHAR, VARCHAR
)
TO authenticated;


REVOKE EXECUTE
ON FUNCTION public.crear_palet_completo(
    BIGINT, VARCHAR, NUMERIC, SMALLINT, VARCHAR, DATE,
    DATE, DATE, VARCHAR, VARCHAR
)
FROM anon;


-- =========================================================
-- FIN
-- =========================================================
