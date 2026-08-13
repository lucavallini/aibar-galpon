-- =========================================================
-- AIBAR — VACIAR LA BASE PARA SALIR A PRODUCCIÓN
-- =========================================================
--
-- Borra TODOS los datos de prueba y deja la estructura
-- intacta: tablas, funciones, triggers, vistas, permisos y
-- policies quedan exactamente como están.
--
-- ⚠️ ESTO NO SE PUEDE DESHACER. Antes de correrlo, sacá un
-- backup desde Database → Backups en el panel de Supabase.
-- Si algo de lo que hay adentro sirve, no hay vuelta atrás.
--
-- Corre en el SQL Editor, de una sola vez. Va todo dentro de
-- una transacción: o se borra todo, o no se borra nada.
--
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. Datos del depósito
-- ---------------------------------------------------------
--
-- Las cinco tablas van en un solo TRUNCATE porque están
-- relacionadas entre sí y Postgres exige vaciarlas juntas.
--
-- RESTART IDENTITY reinicia los contadores: el primer palet
-- real vuelve a ser el número 1. Es lo que se quiere al
-- estrenar el depósito, pero ojo con las etiquetas de prueba
-- que hayas impreso: si quedó alguna pegada por ahí, su
-- número va a repetirse en un palet nuevo. Tiralas antes.
--
-- TRUNCATE se salta el trigger que protege el stock, así que
-- no hace falta pasar por las funciones de movimiento.

TRUNCATE TABLE
    public.observacion_palet,
    public.movimiento,
    public.detalle_agroquimico,
    public.detalle_semilla,
    public.palet,
    public.producto,
    public.cliente
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------
-- 2. Usuarios
-- ---------------------------------------------------------
--
-- Elegí UNA de las dos opciones de abajo.
--
-- Se borra de `auth.users`, que es donde viven las cuentas.
-- La fila de `public.usuario` se va sola por CASCADE.

-- OPCIÓN A — Conservar tu cuenta de gerente y borrar el resto.
-- Es la recomendada: si borrás todas, te quedás afuera del
-- sistema y hay que crear la primera cuenta a mano desde
-- Authentication → Users.
-- Poné tu email y descomentá las dos líneas:

-- DELETE FROM auth.users
--  WHERE email <> 'PONE_ACA_TU_EMAIL';

-- OPCIÓN B — Borrar todas las cuentas, incluida la tuya.
-- Después de esto no vas a poder entrar hasta crear un
-- usuario a mano en Authentication → Users y correr:
--   UPDATE public.usuario SET rol = 'jefe', nombre = 'Tu Nombre'
--    WHERE id = '<el uuid nuevo>';
-- Descomentá la línea:

-- DELETE FROM auth.users;

-- ---------------------------------------------------------
-- 3. Control antes de confirmar
-- ---------------------------------------------------------
--
-- Mirá el resultado: todo tiene que dar 0 salvo los usuarios
-- que hayas decidido conservar.

SELECT 'palet' AS tabla, count(*) FROM public.palet
UNION ALL SELECT 'movimiento',        count(*) FROM public.movimiento
UNION ALL SELECT 'detalle_agroquimico', count(*) FROM public.detalle_agroquimico
UNION ALL SELECT 'detalle_semilla',    count(*) FROM public.detalle_semilla
UNION ALL SELECT 'producto',          count(*) FROM public.producto
UNION ALL SELECT 'cliente',           count(*) FROM public.cliente
UNION ALL SELECT 'observacion_palet', count(*) FROM public.observacion_palet
UNION ALL SELECT 'usuario',           count(*) FROM public.usuario;

COMMIT;

-- Si algo salió distinto de lo esperado, en vez de COMMIT
-- corré ROLLBACK; y no se borra nada.
