const { Resend } = require('resend');
const pool = require('../db/conexion');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';

const getNombreColegio = async () => {
  const res = await pool.query('SELECT nombre_colegio FROM configuracion LIMIT 1');
  return res.rows[0]?.nombre_colegio || 'EduWallet';
};

const enviarEmail = async ({ to, subject, html }) => {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log(`Email enviado a ${to}`);
  } catch (err) {
    console.error('Error enviando email:', err.message);
  }
};

const baseHTML = (contenido, nombreColegio) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <div style="background: #111; padding: 16px 24px; border-radius: 12px 12px 0 0;">
      <h1 style="color: white; margin: 0; font-size: 20px;">${nombreColegio}</h1>
      <p style="color: #999; margin: 4px 0 0; font-size: 12px;">Sistema EduWallet</p>
    </div>
    <div style="background: white; border: 1px solid #eee; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
      ${contenido}
      <p style="color: #bbb; font-size: 11px; margin: 24px 0 0; border-top: 1px solid #f0f0f0; padding-top: 12px;">
        Este mensaje fue enviado automáticamente por EduWallet. No respondas este email.
      </p>
    </div>
  </div>
`;

const enviarEmailSaldoBajo = async ({ nombrePadre, emailPadre, nombreAlumno, saldo, curso }) => {
  const nombreColegio = await getNombreColegio();
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${nombrePadre}</b>,</p>
    <p style="color: #111; margin: 0 0 20px;">El saldo de <b>${nombreAlumno}</b> (${curso}) está por debajo de $200.</p>
    <div style="background: #FEF2F2; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Saldo actual</p>
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: #DC2626;">$${Number(saldo).toLocaleString('es-AR')}</p>
    </div>
    <p style="font-size: 13px; color: #666; margin: 0;">Por favor recargá el saldo para evitar inconvenientes.</p>
  `, nombreColegio);

  await enviarEmail({
    to: emailPadre,
    subject: `⚠ Saldo bajo de ${nombreAlumno} — ${nombreColegio}`,
    html
  });
};

const enviarEmailRecarga = async ({ nombrePadre, emailPadre, nombreAlumno, monto, nuevoSaldo }) => {
  const nombreColegio = await getNombreColegio();
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${nombrePadre}</b>,</p>
    <p style="color: #111; margin: 0 0 20px;">La recarga para <b>${nombreAlumno}</b> fue acreditada correctamente.</p>
    <div style="background: #F0FDF4; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Monto recargado</p>
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: #16A34A;">+$${Number(monto).toLocaleString('es-AR')}</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #666;">Nuevo saldo: <b>$${Number(nuevoSaldo).toLocaleString('es-AR')}</b></p>
    </div>
  `, nombreColegio);

  await enviarEmail({
    to: emailPadre,
    subject: `✓ Recarga exitosa para ${nombreAlumno} — ${nombreColegio}`,
    html
  });
};

const enviarEmailCompra = async ({ nombrePadre, emailPadre, nombreAlumno, descripcion, monto, saldo, lugar }) => {
  const nombreColegio = await getNombreColegio();
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${nombrePadre}</b>,</p>
    <p style="color: #111; margin: 0 0 20px;"><b>${nombreAlumno}</b> realizó una compra en el ${lugar}.</p>
    <div style="background: #F8F9FA; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #666;">Detalle</p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #111;">${descripcion}</p>
      <p style="margin: 8px 0 0; font-size: 22px; font-weight: 700; color: #111;">-$${Number(monto).toLocaleString('es-AR')}</p>
      <p style="margin: 6px 0 0; font-size: 13px; color: #666;">Saldo restante: <b>$${Number(saldo).toLocaleString('es-AR')}</b></p>
    </div>
    ${parseFloat(saldo) < 200 ? `<div style="background: #FEF2F2; border-radius: 8px; padding: 10px 14px; font-size: 13px; color: #DC2626;">⚠ Saldo bajo — por favor recargá.</div>` : ''}
  `, nombreColegio);

  await enviarEmail({
    to: emailPadre,
    subject: `🛒 Compra de ${nombreAlumno} en ${lugar} — ${nombreColegio}`,
    html
  });
};

const enviarEmailBackup = async ({ sql, nombre }) => {
  try {
    const config = await pool.query('SELECT * FROM configuracion LIMIT 1');
    const emailAdmin = config.rows[0]?.email_admin;
    const nombreColegio = config.rows[0]?.nombre_colegio || 'EduWallet';

    if (!emailAdmin) {
      console.log('No hay email de admin configurado para el backup');
      return;
    }

    await resend.emails.send({
      from: FROM,
      to: emailAdmin,
      subject: `🗄️ Backup — ${nombreColegio} — ${new Date().toLocaleDateString('es-AR')}`,
      html: baseHTML(`
        <p style="color: #111; margin: 0 0 12px;">Backup automático de <b>${nombreColegio}</b></p>
        <p style="color: #666; font-size: 13px; margin: 0 0 16px;">Fecha: ${new Date().toLocaleString('es-AR')}</p>
        <div style="background: #F0FDF4; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #166534;">
          ✓ El archivo SQL adjunto contiene todos los datos del sistema.
        </div>
      `, nombreColegio),
      attachments: [{
        filename: nombre,
        content: Buffer.from(sql).toString('base64'),
      }]
    });
    console.log(`Backup enviado por email a ${emailAdmin}`);
  } catch (err) {
    console.error('Error enviando email de backup:', err.message);
  }
};

const enviarEmailRecuperacion = async ({ nombrePadre, emailPadre, linkReset }) => {
  const nombreColegio = await getNombreColegio();
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${nombrePadre}</b>,</p>
    <p style="color: #111; margin: 0 0 20px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en EduWallet.</p>
    <a href="${linkReset}" style="display: block; text-align: center; background: #1E3A5F; color: white; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-size: 15px; font-weight: 600; margin-bottom: 20px;">
      Restablecer contraseña
    </a>
    <p style="font-size: 12px; color: #999; margin: 0 0 8px;">Este enlace expira en <b>1 hora</b>.</p>
    <p style="font-size: 12px; color: #999; margin: 0;">Si no solicitaste este cambio, podés ignorar este email. Tu contraseña no será modificada.</p>
  `, nombreColegio);

  await enviarEmail({
    to: emailPadre,
    subject: `Restablecer contraseña — ${nombreColegio}`,
    html
  });
};

const enviarMensajeAdmin = async ({ asunto, mensaje, destinatarios }) => {
  const nombreColegio = await getNombreColegio();
  const html = baseHTML(`
    <p style="color: #111; margin: 0 0 20px; font-size: 15px; white-space: pre-line;">${mensaje}</p>
  `, nombreColegio);

  let enviados = 0;
  let errores = 0;

  for (const email of destinatarios) {
    try {
      await resend.emails.send({ from: FROM, to: email, subject: asunto, html });
      enviados++;
    } catch (err) {
      console.error(`Error enviando a ${email}:`, err.message);
      errores++;
    }
  }

  return { enviados, errores };
};

module.exports = {
  enviarEmailSaldoBajo,
  enviarEmailRecarga,
  enviarEmailCompra,
  enviarEmailBackup,
  enviarMensajeAdmin,
  enviarEmailRecuperacion
};