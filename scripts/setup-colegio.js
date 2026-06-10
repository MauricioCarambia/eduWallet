const { execSync } = require('child_process');
const readline = require('readline');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const preguntar = (pregunta) => new Promise(resolve => rl.question(pregunta, resolve));

const log = (msg, color = 'reset') => {
  const colors = {
    green: '\x1b[32m', blue: '\x1b[34m', yellow: '\x1b[33m',
    red: '\x1b[31m', reset: '\x1b[0m', bold: '\x1b[1m'
  };
  console.log(`${colors[color]}${msg}${colors.reset}`);
};

async function main() {
  log('\n╔══════════════════════════════════════╗', 'bold');
  log('║     EduWallet — Setup Nuevo Colegio   ║', 'bold');
  log('╚══════════════════════════════════════╝\n', 'bold');

  // datos del colegio
  const nombre = await preguntar('📚 Nombre del colegio: ');
  const adminUsuario = await preguntar('👤 Usuario del admin: ');
  const adminPin = await preguntar('🔑 PIN del admin (4+ dígitos): ');
  const adminNombre = await preguntar('👤 Nombre del administrador: ');
  const backendUrl = await preguntar('🌐 URL del backend en Railway (ej: https://mi-colegio.up.railway.app): ');
  const adminUrl = await preguntar('🌐 URL del admin en Vercel (ej: https://mi-colegio-admin.vercel.app): ');
  const padresUrl = await preguntar('🌐 URL del portal de padres en Vercel (ej: https://mi-colegio-padres.vercel.app): ');
  const dbUrl = await preguntar('🗄️  DATABASE_URL de Railway: ');
  const resendApiKey = await preguntar('📧 API Key de Resend (re_...): ');

  log('\n⏳ Configurando el sistema...', 'yellow');

  // generar JWT secret único
  const jwtSecret = crypto.randomBytes(32).toString('hex');

  // crear archivo de configuración del colegio
  const config = {
    nombre,
    adminUsuario,
    backendUrl,
    adminUrl,
    padresUrl,
    jwtSecret,
    creado: new Date().toISOString()
  };

  const fs = require('fs');
  const path = require('path');

  // crear carpeta del colegio
  const slug = nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const dir = path.join(__dirname, 'colegios', slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // guardar configuración
  fs.writeFileSync(
    path.join(dir, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  // generar SQL de setup
  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash(adminPin, 10);

  const sql = `
-- Setup EduWallet para ${nombre}
-- Generado el ${new Date().toLocaleString('es-AR')}

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
VALUES ('${adminNombre}', '${adminUsuario}', '${hash}', 'admin', true);

INSERT INTO configuracion (nombre_colegio) VALUES ('${nombre}');
`;

  fs.writeFileSync(path.join(dir, 'setup.sql'), sql);

  // generar archivo de variables de entorno
 const envBackend = `
DATABASE_URL=${dbUrl}
JWT_SECRET=${jwtSecret}
PORT=3001
BACKEND_URL=${backendUrl}
PADRES_URL=${padresUrl}
RESEND_API_KEY=${resendApiKey}
FROM_EMAIL=onboarding@resend.dev
`.trim();

  const envAdmin = `VITE_API_URL=${backendUrl}/api`.trim();
  const envPOS = `VITE_API_URL=${backendUrl}/api`.trim();
  const envPadres = `VITE_API_URL=${backendUrl}/api`.trim();

  fs.writeFileSync(path.join(dir, 'backend.env'), envBackend);
  fs.writeFileSync(path.join(dir, 'admin.env'), envAdmin);
  fs.writeFileSync(path.join(dir, 'pos.env'), envPOS);
  fs.writeFileSync(path.join(dir, 'padres.env'), envPadres);

  // generar guía de entrega
  const guia = `
# EduWallet — ${nombre}
Generado el ${new Date().toLocaleString('es-AR')}

## Accesos

### Panel de Administración
URL: ${adminUrl}
Usuario: ${adminUsuario}
PIN: ${adminPin}

### Punto de Venta
URL: ${padresUrl.replace('padres', 'pos')}
Usuario: ${adminUsuario}
PIN: ${adminPin}

### Portal de Padres
URL: ${padresUrl}
(Los padres se registran con email y contraseña)

### Backend API
URL: ${backendUrl}

## Próximos pasos
1. Ejecutar el SQL de setup.sql en Railway
2. Cargar las variables de entorno en Railway y Vercel
3. Entregar los accesos al colegio
4. Configurar el email en el Panel de Administración → Configuración

## Soporte
Para soporte técnico contactar a EduWallet.
`;

  fs.writeFileSync(path.join(dir, 'GUIA_ENTREGA.md'), guia);

  log('\n✅ Setup completado!\n', 'green');
  log(`📁 Archivos generados en: scripts/colegios/${slug}/`, 'blue');
  log('', 'reset');
  log('📋 Próximos pasos:', 'bold');
  log('  1. Ejecutá setup.sql en el editor SQL de Railway', 'reset');
  log('  2. Cargá backend.env como variables en Railway', 'reset');
  log('  3. Cargá admin.env, pos.env y padres.env en cada proyecto de Vercel', 'reset');
  log(`  4. Entregá GUIA_ENTREGA.md al colegio`, 'reset');
  log('', 'reset');

  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  rl.close();
});