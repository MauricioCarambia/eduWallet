const express = require('express');
const router = express.Router();
const { getProductos, crearProducto, actualizarProducto, actualizarStock, eliminarProducto, getStockBajo, getMasVendidos, importarProductos } = require('../controllers/productosController');
const { verificarToken, soloPersonalPos } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: Productos
 *   description: Gestión del catálogo de productos / kiosco
 */

/**
 * @swagger
 * /productos:
 *   get:
 *     summary: Listar productos
 *     tags: [Productos]
 *     responses:
 *       200:
 *         description: Lista de productos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Producto' }
 *   post:
 *     summary: Crear un producto (solo admin)
 *     tags: [Productos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Producto' }
 *     responses:
 *       201:
 *         description: Producto creado
 */
router.get('/', verificarToken, getProductos);

/**
 * @swagger
 * /productos/stock-bajo:
 *   get:
 *     summary: Listar productos con stock por debajo del umbral configurado
 *     tags: [Productos]
 *     responses:
 *       200:
 *         description: Umbral configurado y lista de productos con stock bajo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 umbral: { type: integer, example: 5 }
 *                 productos:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Producto' }
 */
router.get('/stock-bajo', verificarToken, getStockBajo);
router.get('/mas-vendidos', verificarToken, getMasVendidos); // ?local=Kiosco (si el empleado no tiene zona fija)
// Los productos los gestiona el personal del POS: un empleado con zona fija
// sólo los de su zona; uno sin zona, todos. El admin del colegio sólo los ve.
router.post('/', verificarToken, soloPersonalPos, crearProducto);

/**
 * @swagger
 * /productos/importar:
 *   post:
 *     summary: Importar productos de una zona (desde un Excel o CSV leído en el POS). Actualiza los que ya existen por código de barras o nombre y crea el resto
 *     tags: [Productos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productos]
 *             properties:
 *               local: { type: string, description: 'Zona (el empleado con zona fija siempre importa en la suya)' }
 *               productos:
 *                 type: array
 *                 maxItems: 1000
 *                 items:
 *                   type: object
 *                   properties:
 *                     fila: { type: integer, description: 'Fila del archivo, para informar errores' }
 *                     nombre: { type: string }
 *                     precio: { type: number }
 *                     stock: { type: integer }
 *                     categoria: { type: string }
 *                     codigo_barras: { type: string }
 *     responses:
 *       200:
 *         description: Cantidad de productos creados y actualizados, y filas con errores
 */
router.post('/importar', verificarToken, soloPersonalPos, importarProductos);

/**
 * @swagger
 * /productos/{id}:
 *   put:
 *     summary: Editar nombre, precio y categoría de un producto (el empleado con zona fija, sólo los de su zona)
 *     tags: [Productos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, precio]
 *             properties:
 *               nombre: { type: string }
 *               precio: { type: number }
 *               categoria: { type: string }
 *     responses:
 *       200:
 *         description: Producto actualizado
 */
router.put('/:id', verificarToken, soloPersonalPos, actualizarProducto);

/**
 * @swagger
 * /productos/{id}/stock:
 *   patch:
 *     summary: Actualizar el stock de un producto
 *     tags: [Productos]
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
 *             required: [stock]
 *             properties:
 *               stock: { type: integer, example: 20 }
 *     responses:
 *       200:
 *         description: Producto actualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Producto' }
 */
router.patch('/:id/stock', verificarToken, soloPersonalPos, actualizarStock);

/**
 * @swagger
 * /productos/{id}:
 *   delete:
 *     summary: Eliminar un producto (solo admin)
 *     tags: [Productos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Producto eliminado
 */
router.delete('/:id', verificarToken, soloPersonalPos, eliminarProducto);

module.exports = router;
