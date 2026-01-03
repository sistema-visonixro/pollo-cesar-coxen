-- Agregar columna factura_actual a la tabla cai_facturas
-- Esta columna llevará el control de la secuencia de factura actual
ALTER TABLE cai_facturas 
ADD COLUMN IF NOT EXISTS factura_actual TEXT;

-- Crear índice para mejorar el rendimiento en consultas
CREATE INDEX IF NOT EXISTS idx_cai_facturas_factura_actual 
ON cai_facturas(factura_actual);

-- Verificar que la columna se agregó correctamente
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cai_facturas' 
AND column_name = 'factura_actual';
