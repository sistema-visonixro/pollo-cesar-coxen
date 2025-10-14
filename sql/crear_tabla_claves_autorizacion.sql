CREATE TABLE claves_autorizacion (
  id SERIAL PRIMARY KEY,
  clave NUMERIC(8) NOT NULL,
  descripcion VARCHAR(100)
);
