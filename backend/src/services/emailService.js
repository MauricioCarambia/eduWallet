const { Resend } = require('resend');
const pool = require('../db/conexion');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.FROM_EMAIL || 'onboarding@resend.dev';

// Remitente con nombre visible ("Colegio Modelo" en vez de "onboarding"):
// la bandeja muestra el nombre del colegio aunque la dirección sea la de envío
const DIRECCION = (FROM.match(/<([^>]+)>/) || [null, FROM])[1].trim();
const remitente = nombre => `"${String(nombre || 'KoleTap').replace(/["<>\\]/g, '')}" <${DIRECCION}>`;

// Texto del usuario dentro del HTML del mail (nombres, productos): sin etiquetas
const escapar = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const getBrandingDB = async (colegioId) => {
  if (!colegioId) return { nombre: 'KoleTap', logo: null };
  const res = await pool.query('SELECT nombre_colegio, logo FROM configuracion WHERE colegio_id = $1', [colegioId]);
  return {
    nombre: res.rows[0]?.nombre_colegio || 'KoleTap',
    logo:   res.rows[0]?.logo || null
  };
};

// Resend no tira excepción cuando rechaza un mail: devuelve { error }. Sin
// mirar eso, un mail rechazado se daba por enviado.
// Motivo de rechazo de Resend en castellano, para mostrarle al admin
const motivoEnCastellano = m => {
  if (/testing emails|verify a domain|domain is not verified/i.test(m || '')) return 'el envío de mails está en modo de prueba (solo le llega al dueño de la cuenta de Resend): hay que verificar el dominio';
  if (/too many requests|rate limit/i.test(m || '')) return 'demasiados envíos seguidos, probá de nuevo en un minuto';
  return m;
};

const mandar = async params => {
  const r = await resend.emails.send(params);
  if (r?.error) throw new Error(r.error.message || 'Resend rechazó el mail');
  return r;
};

const enviarEmail = async ({ to, subject, html, nombre }) => {
  try {
    await mandar({ from: remitente(nombre), to, subject, html });
    console.log(`Email enviado a ${to}`);
    return true;
  } catch (err) {
    console.error(`Error enviando email a ${to}:`, err.message);
    return false;
  }
};

const baseHTML = (contenido, nombreColegio, logo) => `
  <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <div style="background: #111; padding: 16px 24px; border-radius: 12px 12px 0 0; display: flex; align-items: center; gap: 14px;">
      ${logo ? `<img src="${logo}" alt="${nombreColegio}" style="width:40px;height:40px;border-radius:8px;object-fit:contain;background:white;padding:2px;flex-shrink:0;" />` : ''}
      <div>
        <h1 style="color: white; margin: 0; font-size: 20px;">${escapar(nombreColegio)}</h1>
        <p style="color: #999; margin: 4px 0 0; font-size: 12px;">Sistema KoleTap</p>
      </div>
    </div>
    <div style="background: white; border: 1px solid #eee; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
      ${contenido}
      <p style="color: #bbb; font-size: 11px; margin: 24px 0 0; border-top: 1px solid #f0f0f0; padding-top: 12px;">
        Este mensaje fue enviado automáticamente por KoleTap. No respondas este email.
      </p>
    </div>
  </div>
`;

const enviarEmailSaldoBajo = async ({ colegioId, nombrePadre, emailPadre, nombreAlumno, saldo, curso, umbral = 200 }) => {
  const { nombre: nombreColegio, logo } = await getBrandingDB(colegioId);
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${escapar(nombrePadre)}</b>,</p>
    <p style="color: #111; margin: 0 0 20px;">El saldo de <b>${escapar(nombreAlumno)}</b> (${escapar(curso)}) está por debajo de $${Number(umbral).toLocaleString('es-AR')}.</p>
    <div style="background: #FEF2F2; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Saldo actual</p>
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: #DC2626;">$${Number(saldo).toLocaleString('es-AR')}</p>
    </div>
    <p style="font-size: 13px; color: #666; margin: 0;">Por favor recargá el saldo para evitar inconvenientes.</p>
  `, nombreColegio, logo);

  await enviarEmail({
    nombre: nombreColegio,
    to: emailPadre,
    subject: `⚠ Saldo bajo de ${nombreAlumno} — ${nombreColegio}`,
    html
  });
};

const enviarEmailRecarga = async ({ colegioId, nombrePadre, emailPadre, nombreAlumno, monto, nuevoSaldo }) => {
  const { nombre: nombreColegio, logo } = await getBrandingDB(colegioId);
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${escapar(nombrePadre)}</b>,</p>
    <p style="color: #111; margin: 0 0 20px;">La recarga para <b>${escapar(nombreAlumno)}</b> fue acreditada correctamente.</p>
    <div style="background: #F0FDF4; border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 20px;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #666;">Monto recargado</p>
      <p style="margin: 0; font-size: 32px; font-weight: 700; color: #16A34A;">+$${Number(monto).toLocaleString('es-AR')}</p>
      <p style="margin: 8px 0 0; font-size: 13px; color: #666;">Nuevo saldo: <b>$${Number(nuevoSaldo).toLocaleString('es-AR')}</b></p>
    </div>
  `, nombreColegio, logo);

  await enviarEmail({
    nombre: nombreColegio,
    to: emailPadre,
    subject: `✓ Recarga exitosa para ${nombreAlumno} — ${nombreColegio}`,
    html
  });
};

// sinConexion: hora ("11:26") si la compra se hizo con la caja sin internet
const enviarEmailCompra = async ({ colegioId, nombrePadre, emailPadre, nombreAlumno, descripcion, monto, saldo, lugar, sinConexion = null }) => {
  const { nombre: nombreColegio, logo } = await getBrandingDB(colegioId);
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${escapar(nombrePadre)}</b>,</p>
    <p style="color: #111; margin: 0 0 20px;"><b>${escapar(nombreAlumno)}</b> realizó una compra en el ${escapar(lugar)}.</p>
    <div style="background: #F8F9FA; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 6px; font-size: 13px; color: #666;">Detalle</p>
      <p style="margin: 0 0 4px; font-size: 14px; color: #111;">${escapar(descripcion)}</p>
      <p style="margin: 8px 0 0; font-size: 22px; font-weight: 700; color: #111;">-$${Number(monto).toLocaleString('es-AR')}</p>
      <p style="margin: 6px 0 0; font-size: 13px; color: #666;">Saldo restante: <b>${Number(saldo).toLocaleString('es-AR')}</b></p>
    </div>
    ${sinConexion ? `<p style="margin: 0 0 10px; font-size: 13px; color: #5b6660;">La compra se hizo a las <b>${sinConexion}</b>, cuando la caja del colegio estaba sin internet. Por eso este aviso te llega ahora.</p>` : ''}
    ${Number(saldo) < 0 ? `<p style="margin: 0 0 10px; font-size: 13px; color: #9a5b12;">El saldo quedó en negativo: la diferencia se descuenta automáticamente de la próxima recarga.</p>` : ''}
  `, nombreColegio, logo);

  await enviarEmail({
    nombre: nombreColegio,
    to: emailPadre,
    subject: `🛒 Compra de ${nombreAlumno} en ${lugar} — ${nombreColegio}`,
    html
  });
};

const enviarEmailBackup = async ({ colegioId, sql, nombre }) => {
  try {
    const config = await pool.query('SELECT * FROM configuracion WHERE colegio_id = $1', [colegioId]);
    const emailAdmin = config.rows[0]?.email_admin;
    const nombreColegio = config.rows[0]?.nombre_colegio || 'KoleTap';

    if (!emailAdmin) {
      console.log('No hay email de admin configurado para el backup');
      return;
    }

    await mandar({
      from: remitente(nombreColegio),
      to: emailAdmin,
      subject: `🗄️ Backup — ${nombreColegio} — ${new Date().toLocaleDateString('es-AR')}`,
      html: baseHTML(`
        <p style="color: #111; margin: 0 0 12px;">Backup automático de <b>${escapar(nombreColegio)}</b></p>
        <p style="color: #666; font-size: 13px; margin: 0 0 16px;">Fecha: ${new Date().toLocaleString('es-AR')}</p>
        <div style="background: #F0FDF4; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #166534;">
          ✓ El archivo SQL adjunto contiene todos los datos del sistema.
        </div>
      `, nombreColegio, config.rows[0]?.logo || null),
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

const enviarEmailRecuperacion = async ({ colegioId, nombrePadre, emailPadre, linkReset }) => {
  const { nombre: nombreColegio, logo } = await getBrandingDB(colegioId);
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${escapar(nombrePadre)}</b>,</p>
    <p style="color: #111; margin: 0 0 20px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en KoleTap.</p>
    <a href="${linkReset}" style="display: block; text-align: center; background: #1E3A5F; color: white; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-size: 15px; font-weight: 600; margin-bottom: 20px;">
      Restablecer contraseña
    </a>
    <p style="font-size: 12px; color: #999; margin: 0 0 8px;">Este enlace expira en <b>1 hora</b>.</p>
    <p style="font-size: 12px; color: #999; margin: 0;">Si no solicitaste este cambio, podés ignorar este email. Tu contraseña no será modificada.</p>
  `, nombreColegio, logo);

  await enviarEmail({
    nombre: nombreColegio,
    to: emailPadre,
    subject: `Restablecer contraseña — ${nombreColegio}`,
    html
  });
};

const enviarEmailInvitacion = async ({ colegioId, nombrePadre, emailPadre, nombreAlumno, linkActivacion }) => {
  const { nombre: nombreColegio, logo } = await getBrandingDB(colegioId);
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola${nombrePadre ? ` <b>${escapar(nombrePadre)}</b>` : ''},</p>
    <p style="color: #111; margin: 0 0 20px;"><b>${escapar(nombreColegio)}</b> te dio de alta en KoleTap como padre/tutor de <b>${escapar(nombreAlumno)}</b>, para que puedas ver su saldo y recargarlo desde el celular.</p>
    <a href="${linkActivacion}" style="display: block; text-align: center; background: #1E3A5F; color: white; text-decoration: none; padding: 14px 24px; border-radius: 10px; font-size: 15px; font-weight: 600; margin-bottom: 20px;">
      Activar mi cuenta
    </a>
    <p style="font-size: 12px; color: #999; margin: 0 0 8px;">El enlace expira en <b>7 días</b>. Al activar tu cuenta vas a poder elegir tu contraseña.</p>
  `, nombreColegio, logo);

  await enviarEmail({
    nombre: nombreColegio,
    to: emailPadre,
    subject: `Te invitaron a KoleTap — ${nombreColegio}`,
    html
  });
};

// Mensaje del admin a las familias: en tandas de hasta 100 (la API de lotes de
// Resend), así no se choca con el límite de pedidos por segundo. Cuenta como
// enviados solo los que Resend aceptó y devuelve el primer motivo de rechazo.
const enviarMensajeAdmin = async ({ colegioId, asunto, mensaje, destinatarios }) => {
  const { nombre: nombreColegio, logo } = await getBrandingDB(colegioId);
  const html = baseHTML(`
    <p style="color: #111; margin: 0 0 20px; font-size: 15px; white-space: pre-line;">${escapar(mensaje)}</p>
  `, nombreColegio, logo);

  let enviados = 0;
  let errores = 0;
  let motivo = null;
  for (let i = 0; i < destinatarios.length; i += 100) {
    const tanda = destinatarios.slice(i, i + 100);
    try {
      const r = await resend.batch.send(tanda.map(to => ({ from: remitente(nombreColegio), to, subject: asunto, html })));
      if (r?.error) throw new Error(r.error.message || 'Resend rechazó el envío');
      enviados += tanda.length;
    } catch (err) {
      console.error(`Error enviando mensaje a ${tanda.length} destinatarios:`, err.message);
      errores += tanda.length;
      motivo ??= motivoEnCastellano(err.message);
    }
    if (i + 100 < destinatarios.length) await new Promise(r => setTimeout(r, 600));
  }

  return { enviados, errores, motivo };
};

// Consulta del formulario de la página: le llega a quien vende KoleTap

const enviarEmailContacto = async ({ nombre, colegio, cargo, email, telefono, alumnos, mensaje }) => {
  const fila = (etiqueta, valor) => valor ? `<tr><td style="padding: 6px 12px 6px 0; color: #666; font-size: 13px; white-space: nowrap; vertical-align: top;">${etiqueta}</td><td style="padding: 6px 0; color: #111; font-size: 14px;">${escapar(valor)}</td></tr>` : '';
  const html = baseHTML(`
    <p style="color: #111; margin: 0 0 16px; font-size: 15px;">Nueva consulta desde la página de KoleTap.</p>
    <table style="border-collapse: collapse; margin-bottom: 16px;">
      ${fila('Nombre', nombre)}${fila('Colegio', colegio)}${fila('Cargo', cargo)}${fila('Email', email)}${fila('Teléfono', telefono)}${fila('Alumnos', alumnos)}
    </table>
    ${mensaje ? `<div style="background: #F6F8F5; border-radius: 10px; padding: 14px; font-size: 14px; color: #111; white-space: pre-wrap;">${escapar(mensaje)}</div>` : ''}
  `, 'KoleTap', null);

  await enviarEmail({
    to: process.env.CONTACTO_EMAIL || 'mcarambia@gmail.com',
    subject: `Consulta de ${String(colegio).slice(0, 80)} — KoleTap`,
    html,
  });
};

// Aviso genérico a una familia (reglas, bloqueos, devoluciones de recargas)
const enviarEmailAviso = async ({ colegioId, nombrePadre, emailPadre, asunto, titulo, detalle }) => {
  const { nombre: nombreColegio, logo } = await getBrandingDB(colegioId);
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${escapar(nombrePadre)}</b>,</p>
    <p style="color: #111; margin: 0 0 12px; font-size: 15px;"><b>${escapar(titulo)}</b></p>
    <p style="color: #444; margin: 0; font-size: 14px;">${escapar(detalle)}</p>
  `, nombreColegio, logo);
  await enviarEmail({ to: emailPadre, subject: `${asunto} — ${nombreColegio}`, html, nombre: nombreColegio });
};

// Liquidación a un concesionario: devuelve true si Resend la aceptó
const enviarEmailLiquidacion = async ({ colegioId, email, liq }) => {
  const { nombre: nombreColegio, logo } = await getBrandingDB(colegioId);
  const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
  const fecha = d => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('es-AR') : '';
  const fila = (etiqueta, valor, fuerte) => `<tr><td style="padding: 6px 0; color: #666; font-size: 14px;">${etiqueta}</td><td style="padding: 6px 0; text-align: right; font-size: ${fuerte ? 16 : 14}px; color: #111;${fuerte ? ' font-weight: 700;' : ''}">${valor}</td></tr>`;
  const html = baseHTML(`
    <p style="color: #666; margin: 0 0 16px;">Hola <b>${escapar(liq.operador)}</b>,</p>
    <p style="color: #111; margin: 0 0 16px; font-size: 15px;">Liquidación N° ${liq.id} de <b>${escapar(liq.local)}</b>, del ${fecha(liq.desde)} al ${fecha(liq.hasta)}.</p>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;">
      ${fila(`Ventas (${liq.cantidad_ventas})`, pesos(liq.ventas))}
      ${Number(liq.anulaciones) ? fila(`Anulaciones (${liq.cantidad_anulaciones})`, '− ' + pesos(liq.anulaciones)) : ''}
      ${Number(liq.canon) ? fila(`${liq.tipo_operador === 'encargado' ? 'Comisión' : 'Canon'} del colegio (${Number(liq.canon_pct)}%)`, '− ' + pesos(liq.canon)) : ''}
      ${Number(liq.ajuste) ? fila(`Ajuste${liq.ajuste_motivo ? ': ' + escapar(liq.ajuste_motivo) : ''}`, (Number(liq.ajuste) < 0 ? '− ' : '') + pesos(Math.abs(liq.ajuste))) : ''}
      ${fila('Total a cobrar', pesos(liq.total), true)}
    </table>
    <p style="color: #444; margin: 0; font-size: 14px;">${liq.estado === 'pagada' ? `<b>Pagada</b>${liq.referencia_pago ? ' · ' + escapar(liq.referencia_pago) : ''}.` : 'Pendiente de pago.'}</p>
  `, nombreColegio, logo);
  try {
    const r = await resend.emails.send({ from: remitente(nombreColegio), to: email, subject: `Liquidación N° ${liq.id} — ${liq.local} — ${nombreColegio}`, html });
    if (r?.error) { console.error('Error enviando liquidación:', r.error.message); return false; }
    return true;
  } catch (err) { console.error('Error enviando liquidación:', err.message); return false; }
};

module.exports = {
  enviarEmailLiquidacion,
  enviarEmailAviso,
  enviarEmailContacto,
  enviarEmailSaldoBajo,
  enviarEmailRecarga,
  enviarEmailCompra,
  enviarEmailBackup,
  enviarMensajeAdmin,
  enviarEmailRecuperacion,
  enviarEmailInvitacion
};