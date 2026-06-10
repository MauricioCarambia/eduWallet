const express = require('express');
const router = express.Router();
const { verificarToken, soloAdmin } = require('../middlewares/auth');
const { getAlumnos, getAlumno, crearAlumno, actualizarAlumno, toggleAlumno, recargarSaldo, eliminarAlumno, getGastoSemanal, getQR, importarAlumnos } = require('../controllers/alumnosController');

/**
 * @swagger
 * tags:
 *   name: Alumnos
 *   description: Gestión de alumnos y sus saldos
 */

/**
 * @swagger
 * /alumnos:
 *   get:
 *     summary: Listar alumnos
 *     tags: [Alumnos]
 *     responses:
 *       200:
 *         description: Lista de alumnos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Alumno' }
 *   post:
 *     summary: Crear un alumno (solo admin)
 *     tags: [Alumnos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Alumno' }
 *     responses:
 *       201:
 *         description: Alumno creado
 */
router.get('/', verificarToken, getAlumnos);

/**
 * @swagger
 * /alumnos/{id}:
 *   get:
 *     summary: Obtener un alumno por ID
 *     tags: [Alumnos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Datos del alumno
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Alumno' }
 *       404:
 *         description: Alumno no encontrado
 *   put:
 *     summary: Actualizar datos de un alumno
 *     tags: [Alumnos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Alumno' }
 *     responses:
 *       200:
 *         description: Alumno actualizado
 *   delete:
 *     summary: Eliminar un alumno (solo admin)
 *     tags: [Alumnos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Alumno eliminado
 */
router.get('/:id', verificarToken, getAlumno);
router.post('/', verificarToken, soloAdmin, crearAlumno);

/**
 * @swagger
 * /alumnos/importar:
 *   post:
 *     summary: Importación masiva de alumnos vía CSV (solo admin)
 *     tags: [Alumnos]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               archivo: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Resultado de la importación (creados, errores)
 */
router.post('/importar', verificarToken, soloAdmin, importarAlumnos);
router.put('/:id', verificarToken, actualizarAlumno);

/**
 * @swagger
 * /alumnos/{id}/toggle:
 *   patch:
 *     summary: Activar/bloquear la tarjeta de un alumno
 *     tags: [Alumnos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/:id/toggle', verificarToken, actualizarAlumno);

/**
 * @swagger
 * /alumnos/{id}/recargar:
 *   post:
 *     summary: Recargar saldo de un alumno (POS/admin)
 *     tags: [Alumnos]
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
 *             required: [monto]
 *             properties:
 *               monto: { type: number, example: 1000 }
 *               empleado_id: { type: integer }
 *               descripcion: { type: string }
 *     responses:
 *       200:
 *         description: Alumno con saldo actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Alumno' }
 */
router.post('/:id/recargar', verificarToken, recargarSaldo);
router.delete('/:id', verificarToken, soloAdmin, eliminarAlumno);

/**
 * @swagger
 * /alumnos/{id}/gasto-semanal:
 *   get:
 *     summary: Obtener el gasto semanal de un alumno
 *     tags: [Alumnos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Gasto agrupado por día
 */
router.get('/:id/gasto-semanal', verificarToken, getGastoSemanal);

/**
 * @swagger
 * /alumnos/{id}/qr:
 *   get:
 *     summary: Obtener el código QR de la tarjeta del alumno
 *     tags: [Alumnos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Imagen QR (data URL)
 */
router.get('/:id/qr', verificarToken, getQR);

module.exports = router;
