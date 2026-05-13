
-- Setup EduWallet para pepe
-- Generado el 13/5/2026, 02:04:09

CREATE TABLE IF NOT EXISTS empleados (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  usuario VARCHAR(50) UNIQUE NOT NULL,
  pin VARCHAR(100) NOT NULL,
  rol VARCHAR(20) NOT NULL,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alumnos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  curso VARCHAR(50) NOT NULL,
  saldo DECIMAL(10,2) DEFAULT 0,
  limite_diario DECIMAL(10,2) DEFAULT 500,
  gasto_hoy DECIMAL(10,2) DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  qr VARCHAR(50) UNIQUE,
  alergias VARCHAR(100) DEFAULT 'Ninguna',
  tutor VARCHAR(100),
  tutor_tel VARCHAR(50),
  deuda DECIMAL(10,2) DEFAULT 0,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  stock INTEGER DEFAULT 0,
  categoria VARCHAR(50),
  local VARCHAR(50) NOT NULL,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS transacciones (
  id SERIAL PRIMARY KEY,
  alumno_id INTEGER REFERENCES alumnos(id),
  empleado_id INTEGER REFERENCES empleados(id),
  monto DECIMAL(10,2) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  lugar VARCHAR(50),
  descripcion TEXT,
  fecha TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cajas (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER REFERENCES empleados(id),
  local VARCHAR(50) NOT NULL,
  fondo DECIMAL(10,2) DEFAULT 0,
  ventas DECIMAL(10,2) DEFAULT 0,
  tx_count INTEGER DEFAULT 0,
  abierta BOOLEAN DEFAULT true,
  apertura TIMESTAMP DEFAULT NOW(),
  cierre TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  empleado_id INTEGER REFERENCES empleados(id),
  accion VARCHAR(100) NOT NULL,
  detalle TEXT,
  fecha TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS padres (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(100) NOT NULL,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS padres_alumnos (
  id SERIAL PRIMARY KEY,
  padre_id INTEGER REFERENCES padres(id) ON DELETE CASCADE,
  alumno_id INTEGER REFERENCES alumnos(id) ON DELETE CASCADE,
  relacion VARCHAR(50) DEFAULT 'tutor'
);

CREATE TABLE IF NOT EXISTS configuracion (
  id SERIAL PRIMARY KEY,
  nombre_colegio VARCHAR(100),
  direccion VARCHAR(200),
  telefono VARCHAR(50),
  email_admin VARCHAR(100),
  email_smtp VARCHAR(100),
  email_smtp_pass VARCHAR(200),
  email_smtp_host VARCHAR(100) DEFAULT 'smtp.gmail.com',
  email_smtp_port INTEGER DEFAULT 587,
  umbral_saldo_bajo DECIMAL DEFAULT 200,
  umbral_stock_bajo INTEGER DEFAULT 3,
  moneda VARCHAR(10) DEFAULT 'ARS',
  creado_en TIMESTAMP DEFAULT NOW()
);

INSERT INTO empleados (nombre, usuario, pin, rol, activo)
VALUES ('administrador', 'admin', '$2b$10$9AQ0QKjw1l1ItKLdeNBKPe6XrYX7lwLlyOSRUiWThfqPXir7yu1SC', 'admin', true);

INSERT INTO configuracion (nombre_colegio) VALUES ('pepe');
