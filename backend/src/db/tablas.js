const pool = require('./conexion');

const crearTablas = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS empleados (
        id        SERIAL PRIMARY KEY,
        nombre    VARCHAR(100) NOT NULL,
        usuario   VARCHAR(50)  UNIQUE NOT NULL,
        pin       VARCHAR(100) NOT NULL,
        rol       VARCHAR(20)  NOT NULL CHECK (rol IN ('admin', 'staff')),
        activo    BOOLEAN      DEFAULT true,
        creado_en TIMESTAMP    DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS alumnos (
        id           SERIAL PRIMARY KEY,
        nombre       VARCHAR(100)   NOT NULL,
        curso        VARCHAR(50)    NOT NULL,
        saldo        DECIMAL(10,2)  DEFAULT 0  CHECK (saldo >= 0),
        limite_diario DECIMAL(10,2) DEFAULT 500 CHECK (limite_diario > 0),
        gasto_hoy    DECIMAL(10,2)  DEFAULT 0  CHECK (gasto_hoy >= 0),
        activo       BOOLEAN        DEFAULT true,
        qr           VARCHAR(50)    UNIQUE,
        alergias     VARCHAR(100)   DEFAULT 'Ninguna',
        tutor        VARCHAR(100),
        tutor_tel    VARCHAR(50),
        creado_en    TIMESTAMP      DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS productos (
        id        SERIAL PRIMARY KEY,
        nombre    VARCHAR(100)  NOT NULL,
        precio    DECIMAL(10,2) NOT NULL CHECK (precio > 0),
        stock     INTEGER       DEFAULT 0 CHECK (stock >= 0),
        categoria VARCHAR(50),
        local     VARCHAR(50)   NOT NULL,
        activo    BOOLEAN       DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS transacciones (
        id          SERIAL PRIMARY KEY,
        alumno_id   INTEGER       REFERENCES alumnos(id)   ON DELETE SET NULL,
        empleado_id INTEGER       REFERENCES empleados(id) ON DELETE SET NULL,
        monto       DECIMAL(10,2) NOT NULL CHECK (monto > 0),
        tipo        VARCHAR(20)   NOT NULL CHECK (tipo IN ('compra', 'recarga', 'anulacion', 'ajuste')),
        lugar       VARCHAR(50),
        descripcion TEXT,
        fecha       TIMESTAMP     DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cajas (
        id          SERIAL PRIMARY KEY,
        empleado_id INTEGER       REFERENCES empleados(id) ON DELETE SET NULL,
        local       VARCHAR(50)   NOT NULL,
        fondo       DECIMAL(10,2) DEFAULT 0 CHECK (fondo >= 0),
        ventas      DECIMAL(10,2) DEFAULT 0 CHECK (ventas >= 0),
        tx_count    INTEGER       DEFAULT 0 CHECK (tx_count >= 0),
        abierta     BOOLEAN       DEFAULT true,
        apertura    TIMESTAMP     DEFAULT NOW(),
        cierre      TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS auditoria (
        id          SERIAL PRIMARY KEY,
        empleado_id INTEGER       REFERENCES empleados(id) ON DELETE SET NULL,
        accion      VARCHAR(100)  NOT NULL,
        detalle     TEXT,
        fecha       TIMESTAMP     DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS padres (
        id        SERIAL PRIMARY KEY,
        nombre    VARCHAR(100) NOT NULL,
        email     VARCHAR(150) UNIQUE NOT NULL,
        password  VARCHAR(200) NOT NULL,
        activo    BOOLEAN      DEFAULT true,
        creado_en TIMESTAMP    DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS padres_alumnos (
        id        SERIAL PRIMARY KEY,
        padre_id  INTEGER     NOT NULL REFERENCES padres(id)  ON DELETE CASCADE,
        alumno_id INTEGER     NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        relacion  VARCHAR(50) DEFAULT 'tutor',
        UNIQUE(padre_id, alumno_id)
      );

      CREATE TABLE IF NOT EXISTS configuracion (
        id               SERIAL PRIMARY KEY,
        nombre_colegio   VARCHAR(100) DEFAULT 'Mi Colegio',
        direccion        VARCHAR(200),
        telefono         VARCHAR(50),
        email_admin      VARCHAR(150),
        umbral_saldo_bajo  DECIMAL(10,2) DEFAULT 200 CHECK (umbral_saldo_bajo >= 0),
        umbral_stock_bajo  INTEGER       DEFAULT 5   CHECK (umbral_stock_bajo >= 0),
        moneda           VARCHAR(10)  DEFAULT 'ARS',
        logo             TEXT
      );

      CREATE TABLE IF NOT EXISTS pagos (
        id                 SERIAL PRIMARY KEY,
        padre_id           INTEGER NOT NULL REFERENCES padres(id)  ON DELETE CASCADE,
        alumno_id          INTEGER NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
        monto              DECIMAL(10,2) NOT NULL CHECK (monto > 0),
        estado             VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'acreditado', 'rechazado')),
        mp_payment_id      VARCHAR(50),
        external_reference VARCHAR(100),
        detalle            VARCHAR(100),
        creado_en          TIMESTAMP DEFAULT NOW(),
        actualizado_en     TIMESTAMP DEFAULT NOW()
      );
    `);

    // Índices para consultas frecuentes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_transacciones_alumno_id ON transacciones (alumno_id);
      CREATE INDEX IF NOT EXISTS idx_transacciones_fecha     ON transacciones (fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_transacciones_tipo      ON transacciones (tipo);
      CREATE INDEX IF NOT EXISTS idx_transacciones_lugar     ON transacciones (lugar);
      CREATE INDEX IF NOT EXISTS idx_auditoria_fecha         ON auditoria (fecha DESC);
      CREATE INDEX IF NOT EXISTS idx_auditoria_empleado_id   ON auditoria (empleado_id);
      CREATE INDEX IF NOT EXISTS idx_alumnos_activo          ON alumnos (activo);
      CREATE INDEX IF NOT EXISTS idx_alumnos_curso           ON alumnos (curso);
      CREATE INDEX IF NOT EXISTS idx_padres_alumnos_padre    ON padres_alumnos (padre_id);
      CREATE INDEX IF NOT EXISTS idx_padres_alumnos_alumno   ON padres_alumnos (alumno_id);
      CREATE INDEX IF NOT EXISTS idx_pagos_padre_id          ON pagos (padre_id);
      CREATE INDEX IF NOT EXISTS idx_pagos_alumno_id         ON pagos (alumno_id);
      CREATE INDEX IF NOT EXISTS idx_pagos_estado            ON pagos (estado);
    `);

    console.log('Tablas e índices creados correctamente');
    process.exit(0);
  } catch (err) {
    console.error('Error al crear tablas:', err);
    process.exit(1);
  }
};

crearTablas();
