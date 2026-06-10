const express = require('express');
const router = express.Router();
const { login, getEmpleados, crearEmpleado, toggleEmpleado, cambiarPin, resetearPin } = require('../controllers/empleadosController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');
const { loginEmpleadosLimiter } = require('../middlewares/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Empleados
 *   description: Autenticación y gestión de empleados/admin (POS y panel admin)
 */

/**
 * @swagger
 * /empleados/login:
 *   post:
 *     summary: Login de empleado o administrador (PIN)
 *     tags: [Empleados]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pin]
 *             properties:
 *               pin: { type: string, example: "1234" }
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve token JWT y datos del empleado
 *       401:
 *         description: PIN incorrecto
 */
router.post('/login', loginEmpleadosLimiter, login);

/**
 * @swagger
 * /empleados:
 *   get:
 *     summary: Listar empleados
 *     tags: [Empleados]
 *     responses:
 *       200:
 *         description: Lista de empleados
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Empleado' }
 *   post:
 *     summary: Crear un nuevo empleado (solo admin)
 *     tags: [Empleados]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, pin]
 *             properties:
 *               nombre: { type: string }
 *               pin: { type: string }
 *               rol: { type: string, enum: [admin, empleado] }
 *     responses:
 *       201:
 *         description: Empleado creado
 */
router.get('/', verificarToken, soloAdmin, getEmpleados);
router.post('/', verificarToken, soloAdmin, crearEmpleado);

/**
 * @swagger
 * /empleados/{id}/toggle:
 *   patch:
 *     summary: Activar/desactivar un empleado (solo admin)
 *     tags: [Empleados]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/:id/toggle', verificarToken, soloAdmin, toggleEmpleado);

/**
 * @swagger
 * /empleados/{id}/cambiar-pin:
 *   patch:
 *     summary: Cambiar el propio PIN
 *     tags: [Empleados]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pinActual, pinNuevo]
 *             properties:
 *               pinActual: { type: string }
 *               pinNuevo: { type: string }
 *     responses:
 *       200:
 *         description: PIN actualizado
 */
router.patch('/:id/cambiar-pin', verificarToken, cambiarPin);

/**
 * @swagger
 * /empleados/{id}/resetear-pin:
 *   patch:
 *     summary: Resetear el PIN de un empleado (solo admin)
 *     tags: [Empleados]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: PIN reseteado
 */
router.patch('/:id/resetear-pin', verificarToken, soloAdmin, resetearPin);

module.exports = router;
