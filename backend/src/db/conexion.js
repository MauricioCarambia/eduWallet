const { Pool } = require('pg');
require('dotenv').config();

console.log('DATABASE_URL existe:', !!process.env.DATABASE_URL);

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

pool.on('error', (err) => {
  console.error('Error inesperado en el pool:', err.message);
});

pool.connect()
  .then(client => {
    console.log('Conectado a PostgreSQL correctamente');
    client.release();
  })
  .catch(err => console.error('Error al conectar a PostgreSQL:', err.message));

module.exports = pool;