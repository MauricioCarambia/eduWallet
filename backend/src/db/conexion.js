const { Pool } = require('pg');
require('dotenv').config();
console.log('DATABASE_URL existe:', !!process.env.DATABASE_URL);
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

pool.connect()
  .then(() => console.log('Conectado a PostgreSQL correctamente'))
  .catch(err => console.error('Error al conectar a PostgreSQL:', err));

module.exports = pool;