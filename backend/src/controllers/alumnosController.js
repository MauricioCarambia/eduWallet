const pool = require("../db/conexion");
const { registrar } = require("./auditoriaController");
const { enviarEmailRecarga } = require("../services/emailService");
const QRCode = require('qrcode');

const getAlumnos = async (req, res) => {
  try {
    const resultado = await pool.query("SELECT * FROM alumnos ORDER BY nombre");
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const getAlumno = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query("SELECT * FROM alumnos WHERE id = $1", [
      id,
    ]);
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: "Alumno no encontrado" });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const crearAlumno = async (req, res) => {
  const { nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias } =
    req.body;
  try {
    const qr = "QR-" + Date.now();
    const resultado = await pool.query(
      `INSERT INTO alumnos (nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias, qr)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        nombre,
        curso,
        saldo || 0,
        limite_diario || 500,
        tutor,
        tutor_tel,
        alergias || "Ninguna",
        qr,
      ],
    );
    await registrar(req.empleado?.id, "Nuevo alumno", nombre);
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const actualizarAlumno = async (req, res) => {
  const { id } = req.params;
  const { nombre, curso, limite_diario, tutor, tutor_tel, alergias } = req.body;
  try {
    const resultado = await pool.query(
      `UPDATE alumnos SET nombre=$1, curso=$2, limite_diario=$3, tutor=$4, tutor_tel=$5, alergias=$6
       WHERE id=$7 RETURNING *`,
      [nombre, curso, limite_diario, tutor, tutor_tel, alergias, id],
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const toggleAlumno = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      "UPDATE alumnos SET activo = NOT activo WHERE id = $1 RETURNING *",
      [id],
    );
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const recargarSaldo = async (req, res) => {
  const { id } = req.params;
  const { monto, empleado_id, descripcion } = req.body;
  try {
    await pool.query("UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2", [
      monto,
      id,
    ]);
    await pool.query(
      `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion)
       VALUES ($1, $2, $3, 'recarga', 'Sistema', $4)`,
      [id, empleado_id, monto, descripcion || "Recarga"],
    );
    try {
      const padresRes = await pool.query(
        `SELECT p.nombre, p.email FROM padres p
     JOIN padres_alumnos pa ON pa.padre_id = p.id
     WHERE pa.alumno_id = $1`,
        [id],
      );
      const alumnoActualizado = await pool.query(
        "SELECT * FROM alumnos WHERE id = $1",
        [id],
      );
      for (const padre of padresRes.rows) {
        await enviarEmailRecarga({
          nombrePadre: padre.nombre,
          emailPadre: padre.email,
          nombreAlumno: alumnoActualizado.rows[0].nombre,
          monto,
          nuevoSaldo: alumnoActualizado.rows[0].saldo,
        });
      }
    } catch (emailErr) {
      console.error("Error enviando email recarga:", emailErr.message);
    }
    await registrar(
      req.empleado?.id,
      "Recarga de saldo",
      `Alumno ID: ${id} — $${monto}`,
    );
    const alumno = await pool.query("SELECT * FROM alumnos WHERE id = $1", [
      id,
    ]);
    res.json(alumno.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const eliminarAlumno = async (req, res) => {
  const { id } = req.params;
  try {
    await registrar(req.empleado?.id, "Alumno eliminado", `ID: ${id}`);
    await pool.query("DELETE FROM alumnos WHERE id = $1", [id]);
    res.json({ mensaje: "Alumno eliminado" });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const getGastoSemanal = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      `
      SELECT
        EXTRACT(DOW FROM fecha) as dia,
        SUM(monto) as total
      FROM transacciones
      WHERE alumno_id = $1
        AND tipo = 'compra'
        AND fecha >= NOW() - INTERVAL '7 days'
      GROUP BY dia
      ORDER BY dia
    `,
      [id],
    );

    const dias = [0, 0, 0, 0, 0, 0, 0];
    resultado.rows.forEach((r) => {
      dias[parseInt(r.dia)] = parseFloat(r.total);
    });

    res.json(dias);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};
const getQR = async (req, res) => {
  const { id } = req.params;
  try {
    const alumno = await pool.query('SELECT * FROM alumnos WHERE id = $1', [id]);
    if (alumno.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });

    const qrData = alumno.rows[0].qr;
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    res.json({ qr: qrImage, codigo: qrData });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
const importarAlumnos = async (req, res) => {
  const { filas } = req.body; // array de objetos ya parseados en el frontend
  if (!Array.isArray(filas) || filas.length === 0) {
    return res.status(400).json({ error: 'No se recibieron filas para importar' });
  }
  if (filas.length > 500) {
    return res.status(400).json({ error: 'Máximo 500 alumnos por importación' });
  }

  const client = await pool.connect();
  const creados = [];
  const errores = [];

  try {
    await client.query('BEGIN');

    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const fila = i + 2; // fila real en el CSV (1 = encabezado)

      if (!f.nombre?.trim()) { errores.push({ fila, error: 'Nombre requerido' }); continue; }
      if (!f.curso?.trim())  { errores.push({ fila, error: `Fila ${fila}: curso requerido` }); continue; }

      const nombre     = f.nombre.trim();
      const curso      = f.curso.trim();
      const saldo      = Math.max(0, parseFloat(f.saldo) || 0);
      const limiteDiario = Math.max(1, parseFloat(f.limite_diario) || 500);
      const tutor      = f.tutor?.trim() || null;
      const tutorTel   = f.tutor_tel?.trim() || null;
      const alergias   = f.alergias?.trim() || 'Ninguna';
      const qr         = 'QR-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

      try {
        const res = await client.query(
          `INSERT INTO alumnos (nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias, qr)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, nombre`,
          [nombre, curso, saldo, limiteDiario, tutor, tutorTel, alergias, qr]
        );
        creados.push(res.rows[0]);
      } catch (err) {
        errores.push({ fila, error: `${nombre}: ${err.message}` });
      }
    }

    await client.query('COMMIT');
    await registrar(req.empleado?.id, 'Importación masiva', `${creados.length} alumnos importados`);

    res.json({
      creados: creados.length,
      errores: errores.length,
      detalle_errores: errores,
      alumnos: creados
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error importarAlumnos:', err);
    res.status(500).json({ error: 'Error del servidor' });
  } finally {
    client.release();
  }
};

module.exports = {
  getAlumnos,
  getAlumno,
  crearAlumno,
  actualizarAlumno,
  getQR,
  toggleAlumno,
  recargarSaldo,
  eliminarAlumno,
  getGastoSemanal,
  importarAlumnos,
};
