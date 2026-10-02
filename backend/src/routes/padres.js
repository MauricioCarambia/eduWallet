const express = require('express');
const router = express.Router();
const { registro, login, getAlumnos, getCredencial, bloquearMedio, vincularAlumno, getTransaccionesAlumno, toggleBloqueo, actualizarLimite, solicitarRecuperacion, resetearPassword } = require('../controllers/padresController');
const { getClavePublica, suscribir, desuscribir } = require('../controllers/pushController');
const { getCatalogo, guardarRestricciones, guardarAlergias, getNotificaciones, guardarNotificaciones } = require('../controllers/controlFamiliaController');
const { verificarPadre } = require('../middlewares/auth');
const { vincularLimiter, loginPadresLimiter, registroPadresLimiter, recuperacionLimiter } = require('../middlewares/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Padres
 *   description: Portal de padres (registro, login, alumnos vinculados, notificaciones push)
 */

/**
 * @swagger
 * /padres/registro:
 *   post:
 *     summary: Registrar un nuevo padre/tutor
 *     tags: [Padres]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, email, password]
 *             properties:
 *               nombre: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       201:
 *         description: Padre registrado
 *       409:
 *         description: El email ya está registrado
 */
router.post('/registro', registroPadresLimiter, registro);

/**
 * @swagger
 * /padres/login:
 *   post:
 *     summary: Login de padre/tutor
 *     tags: [Padres]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve token JWT
 *       401:
 *         description: Credenciales inválidas
 */
router.post('/login', loginPadresLimiter, login);

/**
 * @swagger
 * /padres/recuperar:
 *   post:
 *     summary: Solicitar email de recuperación de contraseña
 *     tags: [Padres]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200:
 *         description: Email de recuperación enviado (si la cuenta existe)
 */
router.post('/recuperar', recuperacionLimiter, solicitarRecuperacion);

/**
 * @swagger
 * /padres/resetear-password:
 *   post:
 *     summary: Resetear contraseña con un token de recuperación
 *     tags: [Padres]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Contraseña actualizada
 *       400:
 *         description: Token inválido o expirado
 */
router.post('/resetear-password', resetearPassword);

/**
 * @swagger
 * /padres/alumnos:
 *   get:
 *     summary: Listar los alumnos vinculados al padre autenticado
 *     tags: [Padres]
 *     responses:
 *       200:
 *         description: Lista de alumnos vinculados con saldo y gasto del día
 */
router.get('/alumnos', verificarPadre, getAlumnos);

/**
 * @swagger
 * /padres/alumnos/{alumno_id}/transacciones:
 *   get:
 *     summary: Historial de transacciones de un alumno vinculado al padre autenticado
 *     tags: [Padres]
 *     parameters:
 *       - in: path
 *         name: alumno_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Lista de transacciones del alumno
 *       403:
 *         description: El alumno no está vinculado a este padre
 */
router.get('/alumnos/:alumno_id/transacciones', verificarPadre, getTransaccionesAlumno);

/**
 * @swagger
 * /padres/alumnos/{alumno_id}/credencial:
 *   get:
 *     summary: Credencial de un hijo (nombre, curso, colegio y QR) para verla, descargarla o imprimirla
 *     tags: [Padres]
 *     parameters:
 *       - in: path
 *         name: alumno_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: "{ colegio, logo, credencial: { id, nombre, curso, qr_img } }"
 *       403:
 *         description: El alumno no está vinculado al padre
 */
router.get('/alumnos/:alumno_id/credencial', verificarPadre, getCredencial);

/**
 * @swagger
 * /padres/alumnos/{alumno_id}/medios:
 *   patch:
 *     summary: Bloquear o desbloquear un medio de pago (QR de la credencial o tarjeta/llavero) sin bloquear todas las compras
 *     tags: [Padres]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [medio, bloqueado]
 *             properties:
 *               medio: { type: string, enum: [qr, tarjeta] }
 *               bloqueado: { type: boolean }
 *     responses:
 *       200:
 *         description: Alumno actualizado
 */
router.patch('/alumnos/:alumno_id/medios', verificarPadre, bloquearMedio);

/**
 * @swagger
 * /padres/alumnos/vincular:
 *   post:
 *     summary: Vincular un alumno a la cuenta del padre
 *     tags: [Padres]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigo_vinculacion]
 *             properties:
 *               codigo_vinculacion: { type: string, example: "A1B2C3D4" }
 *               relacion: { type: string, example: "tutor" }
 *     responses:
 *       200:
 *         description: Alumno vinculado
 */
router.post('/alumnos/vincular', vincularLimiter, verificarPadre, vincularAlumno);

/**
 * @swagger
 * /padres/alumnos/{alumno_id}/toggle:
 *   patch:
 *     summary: Bloquear/activar la tarjeta de un alumno vinculado
 *     tags: [Padres]
 *     parameters:
 *       - in: path
 *         name: alumno_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/alumnos/:alumno_id/toggle', verificarPadre, toggleBloqueo);

/**
 * @swagger
 * /padres/alumnos/{alumno_id}/limite:
 *   patch:
 *     summary: Actualizar el límite diario de gasto de un alumno vinculado
 *     tags: [Padres]
 *     parameters:
 *       - in: path
 *         name: alumno_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [limite_diario]
 *             properties:
 *               limite_diario: { type: number, example: 2000 }
 *     responses:
 *       200:
 *         description: Límite actualizado
 */
router.patch('/alumnos/:alumno_id/limite', verificarPadre, actualizarLimite);

/**
 * @swagger
 * /padres/alumnos/{alumno_id}/catalogo:
 *   get:
 *     summary: Productos y zonas del colegio del alumno, categorías y alérgenos (para armar las reglas de compra)
 *     tags: [Padres]
 * /padres/alumnos/{alumno_id}/restricciones:
 *   put:
 *     summary: Reglas de compra del hijo (categorías, productos y zonas bloqueadas, máximos por día, límite semanal)
 *     tags: [Padres]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categorias_bloqueadas: { type: array, items: { type: string } }
 *               productos_bloqueados: { type: array, items: { type: integer } }
 *               zonas_bloqueadas: { type: array, items: { type: string } }
 *               maximos: { type: object, additionalProperties: { type: integer }, example: { bebida: 1 } }
 *               limite_semanal: { type: number, nullable: true }
 * /padres/alumnos/{alumno_id}/alergias:
 *   put:
 *     summary: Alérgenos del hijo y si la venta de productos con esos alérgenos se bloquea (true) o se avisa al cajero (false)
 *     tags: [Padres]
 */
router.get('/alumnos/:alumno_id/catalogo', verificarPadre, getCatalogo);
router.put('/alumnos/:alumno_id/restricciones', verificarPadre, guardarRestricciones);
router.put('/alumnos/:alumno_id/alergias', verificarPadre, guardarAlergias);

/**
 * @swagger
 * /padres/notificaciones:
 *   get:
 *     summary: Qué avisos recibe el padre y por qué medio
 *     tags: [Padres]
 *   put:
 *     summary: Guardar las preferencias de avisos (compras, saldo bajo, bloqueos, compras rechazadas; email y push)
 *     tags: [Padres]
 */
router.get('/notificaciones', verificarPadre, getNotificaciones);
router.put('/notificaciones', verificarPadre, guardarNotificaciones);

/**
 * @swagger
 * /padres/push/clave-publica:
 *   get:
 *     summary: Obtener la clave pública VAPID para suscripción a notificaciones push
 *     tags: [Padres]
 *     security: []
 *     responses:
 *       200:
 *         description: Clave pública VAPID
 *       503:
 *         description: Notificaciones push no configuradas
 */
router.get('/push/clave-publica', getClavePublica);

/**
 * @swagger
 * /padres/push/suscribir:
 *   post:
 *     summary: Registrar una suscripción push del navegador del padre
 *     tags: [Padres]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint, keys]
 *             properties:
 *               endpoint: { type: string }
 *               keys:
 *                 type: object
 *                 properties:
 *                   p256dh: { type: string }
 *                   auth: { type: string }
 *     responses:
 *       200:
 *         description: Suscripción guardada
 */
router.post('/push/suscribir', verificarPadre, suscribir);

/**
 * @swagger
 * /padres/push/desuscribir:
 *   post:
 *     summary: Eliminar la suscripción push del padre
 *     tags: [Padres]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               endpoint: { type: string }
 *     responses:
 *       200:
 *         description: Suscripción eliminada
 */
router.post('/push/desuscribir', verificarPadre, desuscribir);

module.exports = router;
