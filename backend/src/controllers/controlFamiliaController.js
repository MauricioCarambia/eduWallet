// App de padres: reglas de compra, alergias y avisos.
// Las reglas y las alergias son por hijo; los avisos, por padre.
const pool = require('../db/conexion');
const { normalizarRestricciones, normalizarAlergenos, ALERGENOS, CATEGORIAS, listaAlergenos } = require('../services/reglasCompra');

// Verifica el vínculo y devuelve el alumno (o null)
const alumnoDelPadre = async (padreId, alumnoId) =>
  (await pool.query(
    `SELECT a.* FROM alumnos a JOIN padres_alumnos pa ON pa.alumno_id = a.id
     WHERE pa.padre_id = $1 AND a.id = $2`,
    [padreId, alumnoId]
  )).rows[0] || null;

const auditarFamilia = (padreId, alumno, accion, detalle) =>
  pool.query(
    `INSERT INTO auditoria (empleado_id, colegio_id, accion, detalle)
     SELECT NULL, $1, $2, $3 || ' (' || COALESCE((SELECT nombre FROM padres WHERE id = $4), 'familia') || ')'`,
    [alumno.colegio_id, accion, `${alumno.nombre}: ${detalle}`, padreId]
  ).catch(() => {});

// Productos y zonas del colegio del alumno, para armar las reglas
const getCatalogo = async (req, res) => {
  try {
    const alumno = await alumnoDelPadre(req.padre.id, req.params.alumno_id);
    if (!alumno) return res.status(403).json({ error: 'No tenés acceso a este alumno' });
    const [productos, zonas] = await Promise.all([
      pool.query(
        `SELECT id, nombre, precio, categoria, local, alergenos FROM productos
         WHERE colegio_id = $1 AND activo = true ORDER BY local, nombre`,
        [alumno.colegio_id]
      ),
      pool.query('SELECT nombre FROM locales WHERE colegio_id = $1 AND activo = true ORDER BY nombre', [alumno.colegio_id]),
    ]);
    res.json({
      productos: productos.rows,
      zonas: zonas.rows.map(z => z.nombre),
      categorias: CATEGORIAS,
      alergenos: ALERGENOS,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const guardarRestricciones = async (req, res) => {
  try {
    const alumno = await alumnoDelPadre(req.padre.id, req.params.alumno_id);
    if (!alumno) return res.status(403).json({ error: 'No tenés acceso a este alumno' });

    const zonas = (await pool.query('SELECT nombre FROM locales WHERE colegio_id = $1', [alumno.colegio_id])).rows.map(z => z.nombre);
    const { restricciones, error } = normalizarRestricciones(req.body, zonas);
    if (error) return res.status(400).json({ error });

    // Sólo productos de su colegio
    if (restricciones.productos_bloqueados.length) {
      const ok = await pool.query('SELECT id FROM productos WHERE colegio_id = $1 AND id = ANY($2::int[])', [alumno.colegio_id, restricciones.productos_bloqueados]);
      restricciones.productos_bloqueados = ok.rows.map(r => r.id);
    }

    const conSemanal = 'limite_semanal' in req.body; // ahora se guarda junto al límite diario
    let limiteSemanal = conSemanal ? req.body.limite_semanal : alumno.limite_semanal;
    if (limiteSemanal === '' || limiteSemanal === undefined) limiteSemanal = null;
    if (limiteSemanal !== null) {
      limiteSemanal = Number(limiteSemanal);
      if (!Number.isFinite(limiteSemanal) || limiteSemanal <= 0 || limiteSemanal > 10000000) return res.status(400).json({ error: 'El límite semanal tiene que ser mayor a 0' });
    }

    const r = await pool.query(
      'UPDATE alumnos SET restricciones = $1, limite_semanal = $2 WHERE id = $3 RETURNING *',
      [JSON.stringify(restricciones), limiteSemanal, alumno.id]
    );
    await auditarFamilia(req.padre.id, alumno, 'Reglas de compra cambiadas por la familia', JSON.stringify({ ...restricciones, limite_semanal: limiteSemanal }));
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const guardarAlergias = async (req, res) => {
  if (typeof req.body.bloquear_alergenos !== 'boolean') return res.status(400).json({ error: 'Datos inválidos' });
  try {
    const alumno = await alumnoDelPadre(req.padre.id, req.params.alumno_id);
    if (!alumno) return res.status(403).json({ error: 'No tenés acceso a este alumno' });
    const alergenos = normalizarAlergenos(req.body.alergenos);
    const r = await pool.query(
      'UPDATE alumnos SET alergenos = $1, bloquear_alergenos = $2 WHERE id = $3 RETURNING *',
      [alergenos, req.body.bloquear_alergenos, alumno.id]
    );
    await auditarFamilia(req.padre.id, alumno, 'Alergias cambiadas por la familia',
      `${alergenos.length ? listaAlergenos(alergenos) : 'ninguna'}${req.body.bloquear_alergenos ? ' — bloquear la venta' : ' — avisar al cajero'}`);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const CAMPOS_AVISOS = ['notif_compras', 'notif_compras_minimo', 'notif_saldo_bajo', 'umbral_saldo_bajo', 'notif_bloqueos', 'notif_rechazos', 'notif_email', 'notif_push'];

const getNotificaciones = async (req, res) => {
  try {
    const r = await pool.query(`SELECT ${CAMPOS_AVISOS.join(', ')} FROM padres WHERE id = $1`, [req.padre.id]);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const guardarNotificaciones = async (req, res) => {
  const b = req.body || {};
  const booleanos = ['notif_saldo_bajo', 'notif_bloqueos', 'notif_rechazos', 'notif_email', 'notif_push'];
  if (booleanos.some(k => typeof b[k] !== 'boolean')) return res.status(400).json({ error: 'Datos inválidos' });
  if (!['todas', 'mayores', 'ninguna'].includes(b.notif_compras)) return res.status(400).json({ error: 'Datos inválidos' });
  const minimo = Number(b.notif_compras_minimo);
  const umbral = Number(b.umbral_saldo_bajo);
  if (!Number.isFinite(minimo) || minimo < 0 || minimo > 10000000) return res.status(400).json({ error: 'El monto mínimo no es válido' });
  if (!Number.isFinite(umbral) || umbral < 0 || umbral > 10000000) return res.status(400).json({ error: 'El monto de saldo bajo no es válido' });
  try {
    const r = await pool.query(
      `UPDATE padres SET notif_compras = $1, notif_compras_minimo = $2, notif_saldo_bajo = $3, umbral_saldo_bajo = $4,
         notif_bloqueos = $5, notif_rechazos = $6, notif_email = $7, notif_push = $8
       WHERE id = $9 RETURNING ${CAMPOS_AVISOS.join(', ')}`,
      [b.notif_compras, minimo, b.notif_saldo_bajo, umbral, b.notif_bloqueos, b.notif_rechazos, b.notif_email, b.notif_push, req.padre.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = { getCatalogo, guardarRestricciones, guardarAlergias, getNotificaciones, guardarNotificaciones };
