const pool = require('../db/conexion');
const { conciliarColegio } = require('../services/conciliacionService');
const { registrar } = require('./auditoriaController');

// Una revisión por colegio a la vez: consulta muchos pagos en Mercado Pago
const enCurso = new Set();

const getConciliaciones = async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, e.nombre AS empleado_nombre FROM conciliaciones c
       LEFT JOIN empleados e ON e.id = c.empleado_id
       WHERE c.colegio_id = $1 ORDER BY c.ejecutado_en DESC LIMIT 15`,
      [req.empleado.colegio_id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const ejecutarConciliacion = async (req, res) => {
  const colegioId = req.empleado.colegio_id;
  const dias = Math.min(Math.max(parseInt(req.body?.dias) || 30, 1), 90);
  if (enCurso.has(colegioId)) return res.status(409).json({ error: 'Ya hay una revisión en curso. Esperá a que termine.' });
  enCurso.add(colegioId);
  try {
    const resultado = await conciliarColegio(colegioId, { dias, origen: 'manual', empleadoId: req.empleado.id });
    await registrar(req.empleado.id, colegioId, 'Conciliación con Mercado Pago',
      `${dias} días: ${resultado.revisados} pagos revisados, ${resultado.corregidas} corregidos, ${resultado.diferencias.length} diferencias`);
    res.json(resultado);
  } catch (err) {
    console.error('Error en conciliación:', err.message);
    res.status(500).json({ error: 'No se pudo completar la revisión con Mercado Pago' });
  } finally {
    enCurso.delete(colegioId);
  }
};

// Revisión automática de todos los colegios (tarea nocturna)
const conciliarTodos = async () => {
  const colegios = await pool.query('SELECT id FROM colegios WHERE activo = true');
  for (const { id } of colegios.rows) {
    if (enCurso.has(id)) continue;
    enCurso.add(id);
    try {
      const r = await conciliarColegio(id, { dias: 30, origen: 'auto' });
      if (r.diferencias.length) console.log(`Conciliación colegio ${id}: ${r.corregidas} corregidas, ${r.diferencias.length} diferencias`);
    } catch (err) {
      console.error(`Error conciliando el colegio ${id}:`, err.message);
    } finally {
      enCurso.delete(id);
    }
  }
};

module.exports = { getConciliaciones, ejecutarConciliacion, conciliarTodos };
