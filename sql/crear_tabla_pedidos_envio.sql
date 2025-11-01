-- Creación de la tabla pedidos_envio
-- Esta versión guarda la fecha como texto (formato enviado desde el frontend: "YYYY-MM-DD HH:MM:SS").
-- Si prefieres almacenar como timestamptz, ver la sección ALTERNATIVA al final.

CREATE TABLE IF NOT EXISTS public.pedidos_envio (
  id bigserial PRIMARY KEY,
  productos jsonb NOT NULL,
  cajero_id text,
  caja text,
  fecha text NOT NULL,
  cliente text,
  celular text,
  total numeric(12,2) NOT NULL,
  costo_envio numeric(12,2) DEFAULT 0,
  tipo_pago text,
  created_at timestamptz DEFAULT now()
);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_pedidos_envio_cajero ON public.pedidos_envio (cajero_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_envio_caja ON public.pedidos_envio (caja);
CREATE INDEX IF NOT EXISTS idx_pedidos_envio_created_at ON public.pedidos_envio (created_at);

-- Opcional: habilitar RLS y políticas (ajusta según tu esquema de autenticación)
-- ALTER TABLE public.pedidos_envio ENABLE ROW LEVEL SECURITY;
-- Ejemplo simple (permite INSERT a usuarios autenticados):
-- CREATE POLICY "Allow authenticated insert" ON public.pedidos_envio
--   FOR INSERT
--   WITH CHECK ( auth.role() = 'authenticated' );

-- ALTERNATIVA: almacenar fecha como timestamptz (recomendado si quieres fechas con zona horaria).
-- Si usas esta alternativa, adapta el frontend para insertar un valor ISO con zona o deja Postgres usar now() y
-- guarda el valor UTC. Si mantienes el helper que devuelve "YYYY-MM-DD HH:MM:SS" (sin TZ) y quieres convertirlo
-- a timestamptz en el servidor, usa to_timestamp o "fecha::timestamp AT TIME ZONE 'America/Tegucigalpa'" al insertar.
--
-- CREATE TABLE IF NOT EXISTS public.pedidos_envio (
--   id bigserial PRIMARY KEY,
--   productos jsonb NOT NULL,
--   cajero_id text,
--   caja text,
--   fecha timestamptz NOT NULL,
--   cliente text,
--   celular text,
--   total numeric(12,2) NOT NULL,
--   costo_envio numeric(12,2) DEFAULT 0,
--   tipo_pago text,
--   created_at timestamptz DEFAULT now()
-- );

-- Pruebas rápidas (después de crear la tabla):
-- INSERT INTO public.pedidos_envio (productos, cajero_id, caja, fecha, cliente, celular, total, costo_envio, tipo_pago)
-- VALUES ('[{"id":1,"nombre":"Pollo entero","precio":230,"cantidad":1}]', 'user_123', 'Caja 1', '2025-11-01 12:34:00', 'Juan Pérez', '98765432', 230.00, 30.00, 'Efectivo');
-- SELECT * FROM public.pedidos_envio ORDER BY created_at DESC LIMIT 10;

-- Fin
