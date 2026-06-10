process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// Las pruebas usan la misma base de datos configurada en .env (DB local de desarrollo).
// Cada suite crea y limpia sus propios datos de prueba.
