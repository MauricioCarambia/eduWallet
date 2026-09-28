const express = require('express');
const router = express.Router();
const { login, getEmpleados, crearEmpleado, activarCuenta, toggleEmpleado, cambiarPin, resetearPin, asignarZona } = require('../controllers/empleadosController');
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
 * /empleados/activar:
 *   post:
 *     summary: El empleado activa su cuenta con el código que le dio el admin y elige su PIN (4 a 6 números)
 *     tags: [Empleados]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [colegio, usuario, codigo, pin]
 *             properties:
 *               colegio: { type: string }
 *               usuario: { type: string }
 *               codigo: { type: string, example: "K7QM-2XPT" }
 *               pin: { type: string, example: "4821" }
 *     responses:
 *       200:
 *         description: Cuenta activada
 *       400:
 *         description: Código inválido o vencido, o PIN inválido
 */
router.post('/activar', loginEmpleadosLimiter, activarCuenta);

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
 *     summary: Crear un empleado sin PIN (solo admin). Devuelve un codigo_activacion de un solo uso (48 h) para que el empleado elija su PIN
 *     tags: [Empleados]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, usuario, rol]
 *             properties:
 *               nombre: { type: string }
 *               usuario: { type: string }
 *               rol: { type: string, enum: [admin, staff] }
 *               local_id: { type: integer, description: "Zona fija (opcional)" }
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
 *     summary: Generar un código de activación nuevo (solo admin). El PIN anterior deja de funcionar y el empleado elige uno nuevo
 *     tags: [Empleados]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "{ codigo_activacion, expira }"
 */
router.patch('/:id/resetear-pin', verificarToken, soloAdmin, resetearPin);

/**
 * @swagger
 * /empleados/{id}/zona:
 *   patch:
 *     summary: Asignar (o quitar) la zona fija de un empleado (solo admin)
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
 *             properties:
 *               local_id: { type: integer, nullable: true, description: "null para quitar la restricción" }
 *     responses:
 *       200:
 *         description: Empleado actualizado
 */
router.patch('/:id/zona', verificarToken, soloAdmin, asignarZona);

module.exports = router;
