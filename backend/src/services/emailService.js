const nodemailer = require('nodemailer');
const pool = require('../db/conexion');


const getTransporter = async () => {
  const res = await pool.query('SELECT * FROM configuracion LIMIT 1');
  const config = res.rows[0];

  if (!config?.email_smtp || !config?.email_smtp_pass) {
    throw new Error('Email no configurado. Configurá el email en el panel de administración.');
  }

  return {
    transporter: nodemailer.createTransport({
      host: config.email_smtp_host || 'smtp.gmail.com',
      port: config.email_smtp_port || 587,
      secure: false,
      auth: {
        user: config.email_smtp,
        pass: config.email_smtp_pass,
      }
    }),
    from: `${config.nombre_colegio || 'EduWallet'} <${config.email_smtp}>`,
    padresUrl: process.env.PADRES_URL || 'https://edu-wallet-efzx.vercel.app'
  };
};

const enviarEmailSaldoBajo = async ({ nombrePadre, emailPadre, nombreAlumno, saldo, curso }) => {
  try {
    const { transporter, from, padresUrl } = await getTransporter();
    await transporter.sendMail({
      from,
      to: emailPadre,
      subject: `⚠ Saldo bajo de ${nombreAlumno} en EduWallet`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <div style="background: #111; padding: 16px 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">EduWallet</h1>
          </div>
          <div style="background: white; border: 1px solid #eee; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #666; margin: 0 0 16px;">Hola ${nombrePadre},</p>
            <p style="color: #111; margin: 0 0 20px;">El saldo de <b>${nombreAlumno}</b> (${curso}) está por debajo de $200.</p>
            <div style="background: #FEF2F2; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px;">
              <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Saldo actual</p>
              <p style="margin: 0; font-size: 32px; font-weight: 700; color: #DC2626;">$${Number(saldo).toLocaleString('es-AR')}</p>
            </div>
            <a href="${padresUrl}/recargar" style="display: block; background: #111; color: white; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Recargar saldo ahora
            </a>
          </div>
        </div>
      `
    });
    console.log(`Email saldo bajo enviado a ${emailPadre}`);
  } catch (err) {
    console.error('Error enviando email saldo bajo:', err.message);
  }
};

const enviarEmailRecarga = async ({ nombrePadre, emailPadre, nombreAlumno, monto, nuevoSaldo }) => {
  try {
    const { transporter, from, padresUrl } = await getTransporter();
    await transporter.sendMail({
      from,
      to: emailPadre,
      subject: `✓ Recarga exitosa para ${nombreAlumno} en EduWallet`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <div style="background: #111; padding: 16px 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">EduWallet</h1>
          </div>
          <div style="background: white; border: 1px solid #eee; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #666; margin: 0 0 16px;">Hola ${nombrePadre},</p>
            <p style="color: #111; margin: 0 0 20px;">La recarga para <b>${nombreAlumno}</b> fue acreditada correctamente.</p>
            <div style="background: #F0FDF4; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px;">
              <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Monto recargado</p>
              <p style="margin: 0; font-size: 32px; font-weight: 700; color: #16A34A;">+$${Number(monto).toLocaleString('es-AR')}</p>
              <p style="margin: 8px 0 0; font-size: 13px; color: #666;">Nuevo saldo: <b>$${Number(nuevoSaldo).toLocaleString('es-AR')}</b></p>
            </div>
            <a href="${padresUrl}" style="display: block; background: #111; color: white; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Ver en EduWallet
            </a>
          </div>
        </div>
      `
    });
    console.log(`Email recarga enviado a ${emailPadre}`);
  } catch (err) {
    console.error('Error enviando email recarga:', err.message);
  }
};

const enviarEmailCompra = async ({ nombrePadre, emailPadre, nombreAlumno, descripcion, monto, saldo, lugar }) => {
  try {
    const { transporter, from, padresUrl } = await getTransporter();
    await transporter.sendMail({
      from,
      to: emailPadre,
      subject: `🛒 Compra de ${nombreAlumno} en EduWallet`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <div style="background: #111; padding: 16px 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">EduWallet</h1>
          </div>
          <div style="background: white; border: 1px solid #eee; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #666; margin: 0 0 16px;">Hola ${nombrePadre},</p>
            <p style="color: #111; margin: 0 0 20px;"><b>${nombreAlumno}</b> acaba de realizar una compra en el ${lugar}.</p>
            <div style="background: #F8F9FA; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
              <p style="margin: 0 0 6px; font-size: 13px; color: #666;">Detalle</p>
              <p style="margin: 0 0 4px; font-size: 14px; color: #111;">${descripcion}</p>
              <p style="margin: 8px 0 0; font-size: 22px; font-weight: 700; color: #111;">-$${Number(monto).toLocaleString('es-AR')}</p>
              <p style="margin: 6px 0 0; font-size: 13px; color: #666;">Saldo restante: <b>$${Number(saldo).toLocaleString('es-AR')}</b></p>
            </div>
            ${parseFloat(saldo) < 200 ? `
            <div style="background: #FEF2F2; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 13px; color: #DC2626;">
              ⚠ Saldo bajo — recargá para evitar inconvenientes.
            </div>` : ''}
            <a href="${padresUrl}" style="display: block; background: #111; color: white; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
              Ver en EduWallet
            </a>
          </div>
        </div>
      `
    });
  } catch (err) {
    console.error('Error enviando email compra:', err.message);
  }
};
const enviarEmailBackup = async ({ sql, nombre }) => {
  try {
    const { transporter, from } = await getTransporter();
    const config = await pool.query('SELECT * FROM configuracion LIMIT 1');
    const nombreColegio = config.rows[0]?.nombre_colegio || 'EduWallet';
    const emailAdmin = config.rows[0]?.email_admin;

    if (!emailAdmin) {
      console.log('No hay email de admin configurado para el backup');
      return;
    }

    await transporter.sendMail({
      from,
      to: emailAdmin,
      subject: `🗄️ Backup de base de datos — ${nombreColegio} — ${new Date().toLocaleDateString('es-AR')}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <div style="background: #111; padding: 16px 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">EduWallet</h1>
          </div>
          <div style="background: white; border: 1px solid #eee; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
            <p style="color: #111; margin: 0 0 12px;">Backup automático de <b>${nombreColegio}</b></p>
            <p style="color: #666; font-size: 13px; margin: 0 0 16px;">Fecha: ${new Date().toLocaleString('es-AR')}</p>
            <div style="background: #F0FDF4; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #166534;">
              ✓ El archivo SQL adjunto contiene todos los datos del sistema. Guardalo en un lugar seguro.
            </div>
            <p style="color: #999; font-size: 12px; margin: 0;">Este backup se genera automáticamente todos los días a las 3am.</p>
          </div>
        </div>
      `,
      attachments: [{
        filename: nombre,
        content: sql,
        contentType: 'text/plain'
      }]
    });
    console.log(`Backup enviado por email a ${emailAdmin}`);
  } catch (err) {
    console.error('Error enviando email de backup:', err.message);
  }
};
module.exports = { enviarEmailSaldoBajo, enviarEmailRecarga, enviarEmailCompra, enviarEmailBackup };