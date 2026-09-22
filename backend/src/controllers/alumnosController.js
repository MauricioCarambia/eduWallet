const pool = require("../db/conexion");
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { registrar } = require("./auditoriaController");
const { enviarEmailRecarga, enviarEmailInvitacion } = require("../services/emailService");
const { enviarPush } = require("../services/pushService");
const QRCode = require('qrcode');

const generarCodigoVinculacion = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const getAlumnos = async (req, res) => {
  try {
    const resultado = await pool.query("SELECT * FROM alumnos WHERE colegio_id = $1 ORDER BY nombre", [req.empleado.colegio_id]);
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const getAlumno = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query("SELECT * FROM alumnos WHERE id = $1 AND colegio_id = $2", [
      id, req.empleado.colegio_id,
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
    const codigoVinculacion = generarCodigoVinculacion();
    const resultado = await pool.query(
      `INSERT INTO alumnos (nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias, qr, codigo_vinculacion, colegio_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        codigoVinculacion,
        req.empleado.colegio_id,
      ],
    );
    await registrar(req.empleado.id, req.empleado.colegio_id, "Nuevo alumno", nombre);
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
       WHERE id=$7 AND colegio_id=$8 RETURNING *`,
      [nombre, curso, limite_diario, tutor, tutor_tel, alergias, id, req.empleado.colegio_id],
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: "Alumno no encontrado" });
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const toggleAlumno = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      "UPDATE alumnos SET activo = NOT activo WHERE id = $1 AND colegio_id = $2 RETURNING *",
      [id, req.empleado.colegio_id],
    );
    if (resultado.rows.length === 0) return res.status(404).json({ error: "Alumno no encontrado" });
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

const recargarSaldo = async (req, res) => {
  const { id } = req.params;
  const { monto, empleado_id, descripcion } = req.body;
  try {
    const actualizado = await pool.query(
      "UPDATE alumnos SET saldo = saldo + $1 WHERE id = $2 AND colegio_id = $3 RETURNING id",
      [monto, id, req.empleado.colegio_id],
    );
    if (actualizado.rows.length === 0) return res.status(404).json({ error: "Alumno no encontrado" });
    await pool.query(
      `INSERT INTO transacciones (alumno_id, empleado_id, monto, tipo, lugar, descripcion, colegio_id)
       VALUES ($1, $2, $3, 'recarga', 'Sistema', $4, $5)`,
      [id, empleado_id, monto, descripcion || "Recarga", req.empleado.colegio_id],
    );
    try {
      const padresRes = await pool.query(
        `SELECT p.id, p.nombre, p.email FROM padres p
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
          colegioId: req.empleado.colegio_id,
          nombrePadre: padre.nombre,
          emailPadre: padre.email,
          nombreAlumno: alumnoActualizado.rows[0].nombre,
          monto,
          nuevoSaldo: alumnoActualizado.rows[0].saldo,
        });
        await enviarPush(padre.id, {
          title: `Recarga acreditada — ${alumnoActualizado.rows[0].nombre}`,
          body: `+$${Number(monto).toLocaleString('es-AR')} · Nuevo saldo: $${Number(alumnoActualizado.rows[0].saldo).toLocaleString('es-AR')}`,
          url: '/inicio'
        });
      }
    } catch (emailErr) {
      console.error("Error enviando email recarga:", emailErr.message);
    }
    await registrar(
      req.empleado.id,
      req.empleado.colegio_id,
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
    const borrado = await pool.query("DELETE FROM alumnos WHERE id = $1 AND colegio_id = $2 RETURNING id", [id, req.empleado.colegio_id]);
    if (borrado.rows.length === 0) return res.status(404).json({ error: "Alumno no encontrado" });
    await registrar(req.empleado.id, req.empleado.colegio_id, "Alumno eliminado", `ID: ${id}`);
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
        AND colegio_id = $2
        AND tipo = 'compra'
        AND fecha >= NOW() - INTERVAL '7 days'
      GROUP BY dia
      ORDER BY dia
    `,
      [id, req.empleado.colegio_id],
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
    const alumno = await pool.query('SELECT * FROM alumnos WHERE id = $1 AND colegio_id = $2', [id, req.empleado.colegio_id]);
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
const regenerarCodigoVinculacion = async (req, res) => {
  const { id } = req.params;
  try {
    let codigo;
    let actualizado;
    while (!actualizado) {
      codigo = generarCodigoVinculacion();
      try {
        actualizado = await pool.query(
          'UPDATE alumnos SET codigo_vinculacion = $1 WHERE id = $2 AND colegio_id = $3 RETURNING *',
          [codigo, id, req.empleado.colegio_id]
        );
      } catch (err) {
        if (err.code !== '23505') throw err; // colisión de UNIQUE, reintentar
      }
    }
    if (actualizado.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Código de vinculación regenerado', actualizado.rows[0].nombre);
    res.json(actualizado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Crea o vincula un padre a un alumno recién importado. Si el padre no
// existe, lo crea con un token de invitación (7 días) y le manda un email
// para que active su cuenta; si ya existe, solo lo vincula.
const vincularOInvitarPadre = async (email, nombreSugerido, alumnoId, alumnoNombre, colegioId) => {
  const correo = email.trim().toLowerCase();
  const existente = await pool.query('SELECT id FROM padres WHERE email = $1', [correo]);

  let padreId;
  let esNuevo = false;

  if (existente.rows.length > 0) {
    padreId = existente.rows[0].id;
  } else {
    esNuevo = true;
    const passwordPlaceholder = await bcrypt.hash(crypto.randomUUID(), 10);
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días
    const nombrePadre = nombreSugerido?.trim() || correo.split('@')[0];

    const nuevo = await pool.query(
      `INSERT INTO padres (nombre, email, password, reset_token, reset_token_expiry)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [nombrePadre, correo, passwordPlaceholder, token, expiry]
    );
    padreId = nuevo.rows[0].id;

    const linkActivacion = `${process.env.PADRES_URL}/resetear-password?token=${token}`;
    try {
      await enviarEmailInvitacion({ colegioId, nombrePadre, emailPadre: correo, nombreAlumno: alumnoNombre, linkActivacion });
    } catch (err) { console.error('Error enviando invitación:', err.message); }
  }

  await pool.query(
    'INSERT INTO padres_alumnos (padre_id, alumno_id) VALUES ($1, $2) ON CONFLICT (padre_id, alumno_id) DO NOTHING',
    [padreId, alumnoId]
  );

  return esNuevo;
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
  const padresAVincular = []; // [{ email, nombreSugerido, alumnoId, alumnoNombre }]

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
      const codigoVinculacion = generarCodigoVinculacion();

      try {
        const res = await client.query(
          `INSERT INTO alumnos (nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias, qr, codigo_vinculacion, colegio_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, nombre`,
          [nombre, curso, saldo, limiteDiario, tutor, tutorTel, alergias, qr, codigoVinculacion, req.empleado.colegio_id]
        );
        creados.push(res.rows[0]);

        if (f.padre_email?.trim()) {
          padresAVincular.push({ email: f.padre_email, nombreSugerido: tutor, alumnoId: res.rows[0].id, alumnoNombre: nombre });
        }
        if (f.padre2_email?.trim()) {
          padresAVincular.push({ email: f.padre2_email, nombreSugerido: null, alumnoId: res.rows[0].id, alumnoNombre: nombre });
        }
      } catch (err) {
        errores.push({ fila, error: `${nombre}: ${err.message}` });
      }
    }

    await client.query('COMMIT');
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Importación masiva', `${creados.length} alumnos importados`);

    let padresInvitados = 0;
    let padresVinculados = 0;
    for (const p of padresAVincular) {
      try {
        const esNuevo = await vincularOInvitarPadre(p.email, p.nombreSugerido, p.alumnoId, p.alumnoNombre, req.empleado.colegio_id);
        if (esNuevo) padresInvitados++; else padresVinculados++;
      } catch (err) {
        console.error('Error vinculando padre en importación:', err.message);
      }
    }

    res.json({
      creados: creados.length,
      errores: errores.length,
      detalle_errores: errores,
      alumnos: creados,
      padres_invitados: padresInvitados,
      padres_vinculados: padresVinculados
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
  regenerarCodigoVinculacion,
};
