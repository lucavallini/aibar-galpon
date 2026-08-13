-- =========================================================
-- AIBAR
-- INGRESO POR DNI
-- =========================================================
--
-- Los operarios entran con su DNI, no con un email. En el
-- depósito no todos tienen correo, y el DNI es el número que
-- todos saben de memoria y no se olvidan.
--
--
-- CÓMO FUNCIONA
--
-- Supabase Auth solo autentica por email o teléfono: no hay
-- forma de pedirle que valide un campo cualquiera. Así que
-- cada cuenta se crea con un email derivado del DNI:
--
--   DNI 30123456  ->  30123456@aibar.local
--
-- Ese correo no existe ni se usa nunca: no se envían mails y
-- las cuentas se crean ya confirmadas. Es un identificador
-- interno con forma de email, nada más. El dominio `.local`
-- está reservado para redes internas, así que jamás va a
-- chocar con un dominio real.
--
-- El operario nunca lo ve. Escribe su DNI y la app arma el
-- resto.
--
--
-- POR QUÉ TAMBIÉN SE GUARDA EN `usuario`
--
-- Podría deducirse del email, pero tenerlo como columna
-- permite mostrarlo en el panel, buscar por él y garantizar
-- que no se repita con un índice único.
--
-- =========================================================

ALTER TABLE public.usuario
ADD COLUMN IF NOT EXISTS dni VARCHAR(15);


-- Dos personas no pueden compartir DNI, y sin esto dos altas
-- simultáneas podrían colarlo. El índice es parcial porque
-- las cuentas viejas —creadas con email real— lo tienen en
-- NULL y no deben bloquearse entre sí.
CREATE UNIQUE INDEX IF NOT EXISTS usuario_dni_unico
ON public.usuario (dni)
WHERE dni IS NOT NULL;


-- =========================================================
-- ALTA AUTOMÁTICA DEL PERFIL
-- =========================================================
--
-- El trigger que crea la fila en `public.usuario` cuando se
-- registra alguien pasa a copiar también el DNI, que la Edge
-- Function manda en la metadata de la cuenta.
--
-- =========================================================

CREATE OR REPLACE FUNCTION public.crear_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

    INSERT INTO public.usuario (
        id,
        nombre,
        dni,
        rol,
        activo
    )
    VALUES (
        NEW.id,

        COALESCE(
            NEW.raw_user_meta_data ->> 'nombre',
            NEW.email
        ),

        -- NULL en las cuentas creadas a mano con email real,
        -- como la del primer gerente.
        NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'dni', '')), ''),

        'operario',

        TRUE
    );

    RETURN NEW;

END;
$$;


REVOKE ALL
ON FUNCTION public.crear_usuario()
FROM PUBLIC;


-- =========================================================
-- FIN
-- =========================================================
