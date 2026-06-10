const express = require('express');
const router = express.Router();
const { getPadres, togglePadre, desvincularAlumno, vincularAlumno, eliminarPadre } = require('../controllers/adminPadresController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Admin - Padres
 *   description: Gestión de padres/tutores desde el panel admin
 */

/**
 * @swagger
 * /admin/padres:
 *   get:
 *     summary: Listar padres/tutores
 *     tags: [Admin - Padres]
 *     responses:
 *       200:
 *         description: Lista de padres
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Padre' }
 */
router.get('/', verificarToken, soloAdmin, getPadres);

/**
 * @swagger
 * /admin/padres/{id}/toggle:
 *   patch:
 *     summary: Activar/desactivar la cuenta de un padre
 *     tags: [Admin - Padres]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/:id/toggle', verificarToken, soloAdmin, togglePadre);

/**
 * @swagger
 * /admin/padres/{padre_id}/alumnos/{alumno_id}:
 *   delete:
 *     summary: Desvincular un alumno de un padre
 *     tags: [Admin - Padres]
 *     parameters:
 *       - in: path
 *         name: padre_id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: alumno_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Vínculo eliminado
 */
router.delete('/:padre_id/alumnos/:alumno_id', verificarToken, soloAdmin, desvincularAlumno);

/**
 * @swagger
 * /admin/padres/{padre_id}/alumnos:
 *   post:
 *     summary: Vincular un alumno a un padre
 *     tags: [Admin - Padres]
 *     parameters:
 *       - in: path
 *         name: padre_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alumno_id]
 *             properties:
 *               alumno_id: { type: integer }
 *               relacion: { type: string }
 *     responses:
 *       200:
 *         description: Vínculo creado
 */
router.post('/:padre_id/alumnos', verificarToken, soloAdmin, vincularAlumno);

/**
 * @swagger
 * /admin/padres/{id}:
 *   delete:
 *     summary: Eliminar la cuenta de un padre
 *     tags: [Admin - Padres]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Padre eliminado
 */
router.delete('/:id', verificarToken, soloAdmin, eliminarPadre);

module.exports = router;
