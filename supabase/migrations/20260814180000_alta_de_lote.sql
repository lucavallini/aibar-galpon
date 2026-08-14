-- =========================================================
-- AIBAR
-- ALTA DE UN LOTE REPARTIDO EN VARIOS PALETS
-- =========================================================
--
-- QUÉ RESUELVE
--
-- Un lote de semilla no llega en un palet: llegan 10.000 kg
-- del mismo híbrido y el mismo batch repartidos en 10 palets.
-- Hasta ahora eso eran diez formularios idénticos salvo la
-- cantidad, con diez oportunidades de tipear distinto el
-- batch y partir el lote en la base.
--
-- Esta función lo hace de una: recibe el total y en cuántos
-- palets viene, y crea los N con su detalle, todo dentro de
-- una misma transacción. O se crean los diez, o no se crea
-- ninguno.
--
--
-- POR QUÉ NACEN SIN SECTOR
--
-- Es la excepción deliberada a la regla de que
-- `crear_palet_completo()` exige ubicación. Elegir diez
-- sectores antes de tener los palets físicos delante obliga
-- al operario a decidir de memoria dónde va a poner cada uno;
-- en la práctica los ubica mientras los descarga, con la
-- etiqueta ya pegada.
--
-- Nacen entonces con `sector_id NULL` —«está en algún lado
-- que no se registró»— y la app los muestra marcados hasta
-- que se les asigne el lugar. El galpón sí se pide: eso el
-- operario lo sabe cuando el camión descarga, y `palet.galpon`
-- es NOT NULL.
--
-- El alta de a uno NO cambia: sigue exigiendo el sector. Esta
-- es la única puerta de entrada sin ubicación.
--
--
-- CÓMO SE CORRE
--
-- En el SQL Editor, entero y de una vez.
--
-- =========================================================

BEGIN;


-- =========================================================
-- 1. CUÁNTOS PALETS COMO MÁXIMO
-- =========================================================
--
-- El tope existe para que un cero de más no cree mil palets
-- que después hay que borrar de a uno. Cincuenta cubre
-- cualquier camión; si algún día no alcanza, se sube acá.
--
-- =========================================================

CREATE OR REPLACE FUNCTION public.crear_palets_en_lote(
    p_producto_id       BIGINT,
    p_lote              VARCHAR,
    p_cantidad_total    NUMERIC,
    p_unidad_medida     VARCHAR,
    p_cantidad_palets   INTEGER,
    p_galpon            SMALLINT,
    p_hibrido           VARCHAR DEFAULT NULL,
    p_calibre           VARCHAR DEFAULT NULL,
    p_fecha_ingreso     DATE    DEFAULT NULL,
    p_fecha_elaboracion DATE    DEFAULT NULL,
    p_fecha_vencimiento DATE    DEFAULT NULL,
    p_cliente_id        BIGINT  DEFAULT NULL,
    p_observacion       VARCHAR DEFAULT NULL
)
RETURNS SETOF public.palet
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_categoria VARCHAR(20);
    v_unidad    VARCHAR(20);
    v_por_palet NUMERIC(10,2);
    v_ultimo    NUMERIC(10,2);
    v_cantidad  NUMERIC(10,2);
    v_palet     public.palet;
    i           INTEGER;
BEGIN

    IF NOT public.es_operario() THEN
        RAISE EXCEPTION 'Solo los operarios pueden dar de alta palets';
    END IF;

    -- ----- Cuántos -----
    IF p_cantidad_palets IS NULL OR p_cantidad_palets < 1 THEN
        RAISE EXCEPTION 'Poné cuántos palets trae el lote';
    END IF;

    IF p_cantidad_palets > 50 THEN
        RAISE EXCEPTION
            'Un lote no puede tener más de 50 palets. Vinieron %.',
            p_cantidad_palets;
    END IF;

    -- ----- Qué es -----
    SELECT categoria, unidad_medida
      INTO v_categoria, v_unidad
      FROM public.producto
     WHERE id = p_producto_id;

    IF v_categoria IS NULL THEN
        RAISE EXCEPTION 'El producto no existe';
    END IF;

    v_unidad := COALESCE(
        NULLIF(btrim(p_unidad_medida), ''),
        NULLIF(btrim(v_unidad), ''),
        'unidad'
    );

    -- ----- De quién es -----
    IF p_cliente_id IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM public.cliente WHERE id = p_cliente_id
       ) THEN
        RAISE EXCEPTION 'El cliente indicado no existe';
    END IF;

    -- =====================================================
    -- El reparto
    -- =====================================================
    --
    -- Se trunca a dos decimales, que es lo que aguanta
    -- NUMERIC(10,2), y la diferencia se le suma al último
    -- palet. Así la suma de los N da exactamente el total que
    -- entró: repartir 100 en 3 da 33,33 + 33,33 + 33,34, y no
    -- 99,99 con un kilo evaporado.
    --
    -- =====================================================

    IF p_cantidad_total IS NULL OR p_cantidad_total <= 0 THEN
        RAISE EXCEPTION 'La cantidad total tiene que ser mayor que cero';
    END IF;

    v_por_palet := trunc(p_cantidad_total / p_cantidad_palets, 2);

    IF v_por_palet <= 0 THEN
        RAISE EXCEPTION
            'No alcanza para % palets: a cada uno le tocaría menos de 0,01 %s',
            p_cantidad_palets, v_unidad;
    END IF;

    v_ultimo := p_cantidad_total - (v_por_palet * (p_cantidad_palets - 1));

    FOR i IN 1..p_cantidad_palets LOOP

        v_cantidad := CASE
            WHEN i = p_cantidad_palets THEN v_ultimo
            ELSE v_por_palet
        END;

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
            p_producto_id,
            p_lote,
            v_cantidad,
            v_unidad,
            p_galpon,
            -- Sin ubicar a propósito: se le asigna el sector al
            -- descargarlo, con la etiqueta ya pegada.
            NULL,
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

        -- La observación va en todos: describe la mercadería que
        -- llegó, y esa llegó repartida en los N palets.
        IF NULLIF(btrim(p_observacion), '') IS NOT NULL THEN
            INSERT INTO public.observacion_palet (palet_id, usuario_id, texto)
            VALUES (v_palet.id, auth.uid(), btrim(p_observacion));
        END IF;

        RETURN NEXT v_palet;

    END LOOP;

    RETURN;

END;
$$;


REVOKE ALL ON FUNCTION public.crear_palets_en_lote(
    BIGINT, VARCHAR, NUMERIC, VARCHAR, INTEGER, SMALLINT,
    VARCHAR, VARCHAR, DATE, DATE, DATE, BIGINT, VARCHAR
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.crear_palets_en_lote(
    BIGINT, VARCHAR, NUMERIC, VARCHAR, INTEGER, SMALLINT,
    VARCHAR, VARCHAR, DATE, DATE, DATE, BIGINT, VARCHAR
) TO authenticated;


COMMIT;


-- =========================================================
-- FIN
-- =========================================================
