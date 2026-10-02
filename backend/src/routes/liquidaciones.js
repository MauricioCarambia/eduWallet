const express = require('express');
const router = express.Router();
const c = require('../controllers/liquidacionesController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Liquidaciones
 *   description: Lo que el colegio le paga a cada concesionario por lo vendido en su zona
 */
router.use(verificarToken, soloAdmin);

router.get('/zonas', c.getZonas);                 // zonas, quién las opera y lo pendiente
router.put('/zonas/:local', c.guardarZona);       // { operador, contacto, email, telefono, cuenta_pago, canon_pct } (sin operador: la opera el colegio)
router.get('/vista-previa', c.getVistaPrevia);    // ?local&hasta=AAAA-MM-DD&ajuste
router.get('/', c.getLiquidaciones);              // ?local
router.post('/', c.crearLiquidacion);             // { local, hasta, ajuste, ajuste_motivo }
router.get('/:id', c.getLiquidacion);
router.post('/:id/pagar', c.pagarLiquidacion);    // { referencia }
router.post('/:id/enviar', c.enviarLiquidacion);
router.delete('/:id', c.eliminarLiquidacion);     // solo pendientes

module.exports = router;
