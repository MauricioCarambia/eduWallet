const express = require('express');
const router = express.Router();
const { login, getColegios, crearColegio, actualizarColegio, buscarAlumnos, ajustarSaldo } = require('../controllers/superadminController');
const { getMetricas } = require('../controllers/metricasController');
const { verificarSuperAdmin } = require('../middlewares/auth');
const { loginEmpleadosLimiter } = require('../middlewares/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: SuperAdmin
 *   description: Panel del dueño de la plataforma (todos los colegios)
 */

router.post('/login', loginEmpleadosLimiter, login);
router.get('/colegios', verificarSuperAdmin, getColegios);
// Métricas de uso, dinero y velocidad de atención (?desde&hasta YYYY-MM-DD, ?colegio_id)
router.get('/metricas', verificarSuperAdmin, getMetricas);
router.post('/colegios', verificarSuperAdmin, crearColegio);
router.patch('/colegios/:id', verificarSuperAdmin, actualizarColegio);

/**
 * @swagger
 * /superadmin/colegios/{id}/alumnos:
 *   get:
 *     summary: Buscar alumnos de un colegio (máx. 20)
 *     tags: [SuperAdmin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Alumnos
 */
router.get('/colegios/:id/alumnos', verificarSuperAdmin, buscarAlumnos);

/**
 * @swagger
 * /superadmin/alumnos/{id}/ajuste:
 *   post:
 *     summary: Sumar saldo a un alumno como corrección puntual (queda movimiento 'ajuste' y auditoría)
 *     tags: [SuperAdmin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [monto, motivo]
 *             properties:
 *               monto: { type: number, example: 500 }
 *               motivo: { type: string, example: 'Devolución por cobro duplicado' }
 *     responses:
 *       200:
 *         description: "{ id, nombre, saldo }"
 */
router.post('/alumnos/:id/ajuste', verificarSuperAdmin, ajustarSaldo);

module.exports = router;
