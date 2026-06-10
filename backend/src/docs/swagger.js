const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EduWallet API',
      version: '1.0.0',
      description: 'API REST para la gestión de billetera escolar (alumnos, padres, productos, transacciones, pagos y más).',
    },
    servers: [
      { url: '/api', description: 'API base' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT obtenido al hacer login (empleados/admin: /empleados/login, padres: /padres/login)',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Mensaje de error' },
          },
        },
        Alumno: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Juan Pérez' },
            curso: { type: 'string', example: '4to A' },
            saldo: { type: 'number', example: 1500 },
            limite_diario: { type: 'number', example: 2000 },
            gasto_hoy: { type: 'number', example: 300 },
            activo: { type: 'boolean', example: true },
            alergias: { type: 'string', example: 'Ninguna' },
          },
        },
        Producto: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Alfajor' },
            precio: { type: 'number', example: 500 },
            stock: { type: 'integer', example: 20 },
            categoria: { type: 'string', example: 'Snacks' },
            local: { type: 'string', example: 'Kiosco' },
            activo: { type: 'boolean', example: true },
          },
        },
        Transaccion: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            alumno_id: { type: 'integer', example: 1 },
            empleado_id: { type: 'integer', example: 1 },
            monto: { type: 'number', example: 500 },
            tipo: { type: 'string', enum: ['compra', 'recarga', 'anulacion'], example: 'compra' },
            lugar: { type: 'string', example: 'Kiosco' },
            descripcion: { type: 'string', example: 'Alfajor x1' },
            fecha: { type: 'string', format: 'date-time' },
          },
        },
        TransaccionesPaginadas: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Transaccion' } },
            total: { type: 'integer', example: 120 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 500 },
            pages: { type: 'integer', example: 1 },
          },
        },
        Empleado: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'María Gómez' },
            rol: { type: 'string', enum: ['admin', 'empleado'], example: 'empleado' },
            activo: { type: 'boolean', example: true },
          },
        },
        Padre: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            nombre: { type: 'string', example: 'Carlos Rodríguez' },
            email: { type: 'string', example: 'carlos@example.com' },
            activo: { type: 'boolean', example: true },
          },
        },
        Caja: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            empleado_id: { type: 'integer', example: 1 },
            local: { type: 'string', example: 'Kiosco' },
            fondo: { type: 'number', example: 500 },
            ventas: { type: 'number', example: 2500 },
            tx_count: { type: 'integer', example: 12 },
            abierta: { type: 'boolean', example: true },
            apertura: { type: 'string', format: 'date-time' },
            cierre: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Pago: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            padre_id: { type: 'integer', example: 1 },
            alumno_id: { type: 'integer', example: 1 },
            monto: { type: 'number', example: 1000 },
            estado: { type: 'string', enum: ['pendiente', 'acreditado', 'rechazado'], example: 'acreditado' },
            detalle: { type: 'string', example: 'Mercado Pago (checkout)' },
            creado_en: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
