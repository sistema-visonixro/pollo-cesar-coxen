-- Agregar columna referencia_aclaracion a la tabla cierres
-- Esta columna almacenará el motivo por el cual se aclara un cierre
-- Ejemplo: "se facturó producto fuera de sistema", etc.

ALTER TABLE cierres
ADD COLUMN IF NOT EXISTS referencia_aclaracion TEXT;

-- Comentario en la columna para documentación
COMMENT ON COLUMN cierres.referencia_aclaracion IS 'Motivo o referencia por el cual se aclara el cierre';
