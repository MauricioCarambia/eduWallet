const pool = require('./conexion');

const crearTablas = async () => {
  try {
    await pool.query(`
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
    `);

    console.log('Tablas creadas correctamente');
    process.exit(0);
  } catch (err) {
    console.error('Error al crear tablas:', err);
    process.exit(1);
  }
};

crearTablas();