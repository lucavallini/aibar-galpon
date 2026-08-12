-- =========================================================
-- AIBAR
-- VISIBILIDAD DE USUARIOS ENTRE SÍ
-- =========================================================
--
-- PROBLEMA QUE RESUELVE
--
-- La policy original solo dejaba a cada usuario ver su propia
-- fila:
--
--   USING (id = auth.uid() OR public.es_jefe())
--
-- Con eso, el historial de movimientos de un palet no puede
-- mostrar quién registró cada uno: un operario lee los
-- movimientos (la policy movimiento_select se lo permite)
-- pero al resolver el usuario asociado recibe NULL para
-- todos los que no son él.
--
-- Y saber quién movió el stock es justamente lo que sirve
-- cuando aparece un faltante.
--
--
-- POR QUÉ ES SEGURO
--
-- La tabla `usuario` no guarda datos sensibles: solo nombre,
-- rol, si está activo y cuándo se creó. El email y las
-- credenciales viven en auth.users, que sigue siendo
-- inaccesible desde el cliente.
--
-- La visibilidad se limita a usuarios activos: alguien dado
-- de baja no ve nada, igual que antes.
--
-- Esto NO habilita modificar usuarios. Sigue sin haber
-- policies de INSERT, UPDATE ni DELETE sobre esta tabla: el
-- alta la hace el trigger crear_usuario() y los cambios de
-- rol se hacen a mano contra la base.
--
-- =========================================================

DROP POLICY IF EXISTS "usuario_select" ON public.usuario;


CREATE POLICY "usuario_select"
ON public.usuario
FOR SELECT
TO authenticated
USING (
    -- La fila propia se ve siempre, incluso estando inactivo:
    -- es lo que permite mostrar la pantalla "cuenta sin acceso"
    -- con el nombre de quien entró.
    id = auth.uid()

    -- El resto del padrón, solo para usuarios activos.
    OR public.usuario_activo()
);


-- =========================================================
-- FIN
-- =========================================================
