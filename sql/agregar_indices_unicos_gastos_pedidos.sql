-- Agregar índices únicos para prevenir registros duplicados
-- Ejecutar en Supabase: Dashboard → SQL Editor

-- ====================================
-- ÍNDICE ÚNICO PARA GASTOS
-- ====================================
-- Previene gastos duplicados basándose en:
-- - fecha_hora: Momento exacto del registro
-- - monto: Cantidad del gasto
-- - cajero_id: Cajero que registró el gasto

CREATE UNIQUE INDEX IF NOT EXISTS idx_gastos_unique 
ON gastos(fecha_hora, monto, cajero_id);

-- ====================================
-- ÍNDICE ÚNICO PARA PEDIDOS DE ENVÍO
-- ====================================
-- Previene pedidos duplicados basándose en:
-- - fecha: Fecha del pedido
-- - total: Monto total
-- - cajero_id: Cajero que registró el pedido
-- - cliente: Nombre del cliente

CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_unique
ON pedidos_envio(fecha, total, cajero_id, cliente);

-- ====================================
-- VERIFICACIÓN
-- ====================================
-- Para verificar que los índices se crearon correctamente:

-- Ver índices de la tabla gastos
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'gastos';

-- Ver índices de la tabla pedidos_envio
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'pedidos_envio';
