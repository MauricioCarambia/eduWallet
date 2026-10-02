const express = require('express');
const router = express.Router();
const c = require('../controllers/proveedoresController');
const { verificarToken, soloPersonalPos } = require('../middlewares/auth');

// Proveedores del colegio (compartidos entre zonas), su catálogo, pedidos y
// recepción. Los usa el personal del POS.
const pos = [verificarToken, soloPersonalPos];

/**
 * @swagger
 * tags:
 *   - name: Proveedores
 *     description: Proveedores, catálogo de compra, pedidos y recepción de mercadería
 */

router.get('/', ...pos, c.getProveedores);
router.post('/', ...pos, c.crearProveedor);

// pedidos (antes de /:id para que "pedidos" no se tome como un id)
router.get('/pedidos', ...pos, c.getPedidos);
router.post('/pedidos', ...pos, c.crearPedido);
router.post('/pedidos/:id/recibir', ...pos, c.recibirPedido);
router.post('/pedidos/:id/cancelar', ...pos, c.cancelarPedido);

router.put('/:id', ...pos, c.actualizarProveedor);
router.delete('/:id', ...pos, c.eliminarProveedor);
router.get('/:id/productos', ...pos, c.getCatalogo);
router.post('/:id/productos', ...pos, c.crearItem);
router.post('/:id/productos/importar', ...pos, c.importarCatalogo);
router.put('/:id/productos/:itemId', ...pos, c.actualizarItem);
router.delete('/:id/productos/:itemId', ...pos, c.eliminarItem);

module.exports = router;
