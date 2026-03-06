-- Consultar registros duplicados existentes en las tablas
-- Ejecutar en Supabase: Dashboard → SQL Editor

-- ====================================
-- GASTOS DUPLICADOS
-- ====================================
-- Ver si hay gastos duplicados en la base de datos
SELECT 
    fecha_hora, 
    monto, 
    cajero_id, 
    motivo,
    COUNT(*) as cantidad_duplicados,
    STRING_AGG(id::text, ', ') as ids_duplicados
FROM gastos
GROUP BY fecha_hora, monto, cajero_id, motivo
HAVING COUNT(*) > 1
ORDER BY cantidad_duplicados DESC;

-- ====================================
-- PEDIDOS DE ENVÍO DUPLICADOS
-- ====================================
-- Ver si hay pedidos de envío duplicados en la base de datos
SELECT 
    fecha, 
    total, 
    cajero_id, 
    cliente,
    celular,
    COUNT(*) as cantidad_duplicados,
    STRING_AGG(id::text, ', ') as ids_duplicados
FROM pedidos_envio
GROUP BY fecha, total, cajero_id, cliente, celular
HAVING COUNT(*) > 1
ORDER BY cantidad_duplicados DESC;

-- ====================================
-- ELIMINAR DUPLICADOS (MANTENER EL MÁS RECIENTE)
-- ====================================
-- ⚠️ ADVERTENCIA: Estos comandos ELIMINARÁN registros duplicados
-- ⚠️ Solo ejecutar si has verificado que son duplicados reales
-- ⚠️ Mantiene el registro con el ID más alto (más reciente)

-- Para GASTOS (comentado por seguridad, descomentar si es necesario):
/*
DELETE FROM gastos
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY fecha_hora, monto, cajero_id 
                ORDER BY id DESC
            ) as rn
        FROM gastos
    ) t
    WHERE rn > 1
);
*/

-- Para PEDIDOS_ENVIO (comentado por seguridad, descomentar si es necesario):
/*
DELETE FROM pedidos_envio
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY fecha, total, cajero_id, cliente 
                ORDER BY id DESC
            ) as rn
        FROM pedidos_envio
    ) t
    WHERE rn > 1
);
*/
