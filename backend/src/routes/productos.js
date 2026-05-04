const express = require('express');
const router = express.Router();
const { getProductos, crearProducto, actualizarStock, eliminarProducto } = require('../controllers/productosController');
const { verificarToken, soloAdmin } = require('../middlewares/auth');

router.get('/', verificarToken, getProductos);
router.post('/', verificarToken, soloAdmin, crearProducto);
router.patch('/:id/stock', verificarToken, actualizarStock);
router.delete('/:id', verificarToken, soloAdmin, eliminarProducto);

module.exports = router;