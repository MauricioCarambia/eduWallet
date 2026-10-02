const pool = require("../db/conexion");
const { normalizarAlergenos, resumenReglas } = require("../services/reglasCompra");
const { compradoHoyPorCategoria, gastoDeLaSemana, gastoPorZona } = require("../services/consumoAlumno");
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { registrar } = require("./auditoriaController");
const { registrarPadreEnColegio } = require("../db/migracion_padres_colegios");
const { variantesUid } = require("../services/tarjetasService");
const { nuevoCodigoQr, normalizarCodigo, esCodigoQr } = require("../services/credencialesService");
const { enviarEmailInvitacion } = require("../services/emailService");
const QRCode = require('qrcode');

// 8 caracteres al azar (con crypto: Math.random no es seguro para algo que da acceso a un alumno)
const LETRAS_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generarCodigoVinculacion = () => [...crypto.randomBytes(8)].map(b => LETRAS_CODIGO[b % LETRAS_CODIGO.length]).join('');

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

// El alumno arranca siempre con saldo 0: el saldo sólo entra por Mercado
// Pago (app de padres o link de pago), así se cobra siempre la comisión
const crearAlumno = async (req, res) => {
  const { nombre, curso, limite_diario, tutor, tutor_tel, contacto2, contacto2_tel, alergias } =
    req.body;
  const alergenos = normalizarAlergenos(req.body.alergenos);
  try {
    const qr = nuevoCodigoQr();
    const codigoVinculacion = generarCodigoVinculacion();
    const resultado = await pool.query(
      `INSERT INTO alumnos (nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias, qr, codigo_vinculacion, colegio_id, contacto2, contacto2_tel, alergenos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        nombre,
        curso,
        0,
        limite_diario || 500,
        tutor,
        tutor_tel,
        alergias || "Ninguna",
        qr,
        codigoVinculacion,
        req.empleado.colegio_id,
        contacto2 || null,
        contacto2_tel || null,
        alergenos,
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
  const { nombre, curso, limite_diario, tutor, tutor_tel, contacto2, contacto2_tel, alergias } = req.body;
  const alergenos = Array.isArray(req.body.alergenos) ? normalizarAlergenos(req.body.alergenos) : null;
  try {
    const resultado = await pool.query(
      `UPDATE alumnos SET nombre=$1, curso=$2, limite_diario=$3, tutor=$4, tutor_tel=$5, alergias=$6,
              contacto2=$9, contacto2_tel=$10, alergenos=COALESCE($11, alergenos)
       WHERE id=$7 AND colegio_id=$8 RETURNING *`,
      [nombre, curso, limite_diario, tutor, tutor_tel, alergias, id, req.empleado.colegio_id, contacto2 || null, contacto2_tel || null, alergenos],
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

  await registrarPadreEnColegio(padreId, colegioId);
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
      const limiteDiario = Math.max(1, parseFloat(f.limite_diario) || 500);
      const tutor      = f.tutor?.trim() || null;
      const tutorTel   = f.tutor_tel?.trim() || null;
      const contacto2  = f.tutor2?.trim() || null;
      const contacto2Tel = f.tutor2_tel?.trim() || null;
      const alergias   = f.alergias?.trim() || 'Ninguna';
      const qr         = nuevoCodigoQr();
      const codigoVinculacion = generarCodigoVinculacion();

      try {
        const res = await client.query(
          `INSERT INTO alumnos (nombre, curso, saldo, limite_diario, tutor, tutor_tel, alergias, qr, codigo_vinculacion, colegio_id, contacto2, contacto2_tel)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, nombre`,
          [nombre, curso, 0, limiteDiario, tutor, tutorTel, alergias, qr, codigoVinculacion, req.empleado.colegio_id, contacto2, contacto2Tel]
        );
        creados.push(res.rows[0]);

        if (f.padre_email?.trim()) {
          padresAVincular.push({ email: f.padre_email, nombreSugerido: tutor, alumnoId: res.rows[0].id, alumnoNombre: nombre });
        }
        if (f.padre2_email?.trim()) {
          padresAVincular.push({ email: f.padre2_email, nombreSugerido: contacto2, alumnoId: res.rows[0].id, alumnoNombre: nombre });
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

// ─── Tarjetas NFC ────────────────────────────────────────────────────────────

// Asignar (o reemplazar) la tarjeta NFC de un alumno. La misma tarjeta no
// puede estar en dos alumnos del colegio.
const asignarTarjeta = async (req, res) => {
  const { id } = req.params;
  if (esCodigoQr(req.body.uid)) {
    return res.status(400).json({ error: 'Ese es el QR de una credencial, no una tarjeta. El QR ya funciona solo: no hace falta asignarlo.' });
  }
  const claves = variantesUid(req.body.uid);
  if (claves.length === 0) return res.status(400).json({ error: 'No se pudo leer la tarjeta. Probá de nuevo.' });
  try {
    const duena = await pool.query(
      'SELECT id, nombre FROM alumnos WHERE colegio_id = $1 AND nfc_claves && $2::text[] AND id <> $3',
      [req.empleado.colegio_id, claves, id]
    );
    if (duena.rows.length > 0) {
      return res.status(409).json({ error: `Esa tarjeta ya está asignada a ${duena.rows[0].nombre}`, alumno: duena.rows[0] });
    }
    const r = await pool.query(
      'UPDATE alumnos SET nfc_uid = $1, nfc_claves = $2 WHERE id = $3 AND colegio_id = $4 RETURNING *',
      [claves[0], claves, id, req.empleado.colegio_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Tarjeta asignada', `${r.rows[0].nombre} — ${claves[0]}`);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Quitar la tarjeta (perdida o rota): deja de servir en el acto; el saldo
// es del alumno, no de la tarjeta
const quitarTarjeta = async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE alumnos SET nfc_uid = NULL, nfc_claves = NULL WHERE id = $1 AND colegio_id = $2 RETURNING *',
      [req.params.id, req.empleado.colegio_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });
    await registrar(req.empleado.id, req.empleado.colegio_id, 'Tarjeta quitada', r.rows[0].nombre);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// POS: buscar el alumno por la tarjeta que se acaba de leer (con cualquier lector)
const buscarPorTarjeta = async (req, res) => {
  const claves = variantesUid(req.query.uid);
  if (claves.length === 0) return res.status(400).json({ error: 'No se pudo leer la tarjeta. Probá de nuevo.' });
  try {
    const r = await pool.query(
      'SELECT * FROM alumnos WHERE colegio_id = $1 AND nfc_claves && $2::text[] LIMIT 1',
      [req.empleado.colegio_id, claves]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Tarjeta no asignada a ningún alumno' });
    if (r.rows[0].tarjeta_bloqueada) return res.status(403).json({ error: 'La familia bloqueó esta tarjeta', bloqueado: 'tarjeta' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ─── Identificar al alumno con cualquier medio ──────────────────────────────
// Lo que llegue del POS (QR leído con lector USB o cámara, tarjeta NFC de
// 13,56 MHz o llavero de 125 kHz, con cualquier lector) se resuelve acá: el
// POS no necesita saber qué tipo de lector usa cada colegio.
const buscarAlumnoPorCodigo = async (codigo, colegioId) => {
  const normalizado = normalizarCodigo(codigo);
  if (normalizado.length >= 6) {
    const porQr = await pool.query(
      `SELECT * FROM alumnos WHERE colegio_id = $1 AND regexp_replace(upper(qr), '[^A-Z0-9]', '', 'g') = $2 LIMIT 1`,
      [colegioId, normalizado]
    );
    if (porQr.rows.length) return { alumno: porQr.rows[0], medio: 'qr' };
  }
  const claves = variantesUid(codigo);
  if (claves.length) {
    const porTarjeta = await pool.query(
      'SELECT * FROM alumnos WHERE colegio_id = $1 AND nfc_claves && $2::text[] LIMIT 1',
      [colegioId, claves]
    );
    if (porTarjeta.rows.length) return { alumno: porTarjeta.rows[0], medio: 'tarjeta' };
  }
  return null;
};

const identificarAlumno = async (req, res) => {
  const { codigo } = req.query;
  if (!codigo || normalizarCodigo(codigo).length < 6) return res.status(400).json({ error: 'No se pudo leer el código. Probá de nuevo.' });
  try {
    const r = await buscarAlumnoPorCodigo(codigo, req.empleado.colegio_id);
    if (!r) {
      return res.status(404).json({ error: esCodigoQr(codigo) ? 'QR no reconocido: puede ser de una credencial vieja' : 'Tarjeta o código no asignado a ningún alumno' });
    }
    const nombre = r.alumno.nombre.split(' ')[0];
    if (r.medio === 'qr' && r.alumno.qr_bloqueado) {
      return res.status(403).json({ error: `La familia bloqueó el QR de ${nombre}. Puede pagar con otro medio.`, bloqueado: 'qr' });
    }
    if (r.medio === 'tarjeta' && r.alumno.tarjeta_bloqueada) {
      return res.status(403).json({ error: `La familia bloqueó la tarjeta de ${nombre}. Puede pagar con otro medio.`, bloqueado: 'tarjeta' });
    }
    res.json({ ...r.alumno, medio: r.medio });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// QR nuevo (credencial perdida o copiada): el anterior deja de funcionar
const regenerarQr = async (req, res) => {
  try {
    const r = await pool.query(
      'UPDATE alumnos SET qr = $1 WHERE id = $2 AND colegio_id = $3 RETURNING *',
      [nuevoCodigoQr(), req.params.id, req.empleado.colegio_id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Alumno no encontrado' });
    await registrar(req.empleado.id, req.empleado.colegio_id, 'QR regenerado', `${r.rows[0].nombre} (la credencial anterior dejó de funcionar)`);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Credenciales para imprimir: nombre, curso y QR de cada alumno activo
// (con ?alumno_id=, sólo la de ese alumno, esté activo o no)
const getCredenciales = async (req, res) => {
  const { curso, alumno_id } = req.query;
  try {
    const r = await pool.query(
      `SELECT id, nombre, curso, qr FROM alumnos
       WHERE colegio_id = $1
         AND ($3::int IS NOT NULL OR activo = true)
         AND ($2::text IS NULL OR curso = $2)
         AND ($3::int IS NULL OR id = $3)
       ORDER BY curso, nombre`,
      [req.empleado.colegio_id, curso || null, alumno_id ? parseInt(alumno_id) || -1 : null]
    );
    const conf = await pool.query('SELECT nombre_colegio, logo FROM configuracion WHERE colegio_id = $1', [req.empleado.colegio_id]);
    const credenciales = await Promise.all(r.rows.map(async a => ({
      id: a.id, nombre: a.nombre, curso: a.curso,
      qr_img: await QRCode.toDataURL(a.qr, { width: 300, margin: 1, errorCorrectionLevel: 'M' }),
    })));
    res.json({ colegio: conf.rows[0]?.nombre_colegio || '', logo: conf.rows[0]?.logo || null, credenciales });
  } catch (err) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// Lo que el POS necesita saber del alumno para vender: reglas de la
// familia, alergias y cuánto consumió hoy / esta semana
const getControlAlumno = async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT id, nombre, restricciones, limite_semanal, alergenos, bloquear_alergenos FROM alumnos WHERE id = $1 AND colegio_id = $2',
      [req.params.id, req.empleado.colegio_id]
    );
    const a = r.rows[0];
    if (!a) return res.status(404).json({ error: "Alumno no encontrado" });
    res.json({
      restricciones: a.restricciones || {},
      limite_semanal: a.limite_semanal,
      alergenos: a.alergenos || [],
      bloquear_alergenos: a.bloquear_alergenos,
      hoy_por_categoria: await compradoHoyPorCategoria(pool, a.id),
      gasto_semana: a.limite_semanal != null ? await gastoDeLaSemana(pool, a.id) : null,
      gasto_zona: Object.keys(a.restricciones?.limites_zona || {}).length ? await gastoPorZona(pool, a.id) : {},
      resumen: resumenReglas(a),
    });
  } catch (err) {
    res.status(500).json({ error: "Error del servidor" });
  }
};

module.exports = {
  getControlAlumno,
  identificarAlumno,
  regenerarQr,
  getCredenciales,
  asignarTarjeta,
  quitarTarjeta,
  buscarPorTarjeta,
  getAlumnos,
  getAlumno,
  crearAlumno,
  actualizarAlumno,
  getQR,
  toggleAlumno,
  eliminarAlumno,
  getGastoSemanal,
  importarAlumnos,
  regenerarCodigoVinculacion,
};
