// Avisos a las familias. Cada padre elige qué avisos recibe (compras, saldo
// bajo, bloqueos, compras rechazadas) y por qué medio (email, push). Un
// error al avisar nunca frena la operación que lo originó.
const pool = require('../db/conexion');
const { enviarEmailCompra, enviarEmailSaldoBajo, enviarEmailAviso } = require('./emailService');
const { enviarPush } = require('./pushService');

const pesos = n => `$${Number(n).toLocaleString('es-AR')}`;

const PREFERENCIAS = `p.id, p.nombre, p.email, p.notif_compras, p.notif_compras_minimo, p.notif_saldo_bajo,
  p.umbral_saldo_bajo, p.notif_bloqueos, p.notif_rechazos, p.notif_email, p.notif_push`;

const padresDelAlumno = async (alumnoId, excepto = null) =>
  (await pool.query(
    `SELECT ${PREFERENCIAS} FROM padres p JOIN padres_alumnos pa ON pa.padre_id = p.id
     WHERE pa.alumno_id = $1 AND ($2::int IS NULL OR p.id <> $2)`,
    [alumnoId, excepto]
  )).rows;

const avisar = async (padre, { email, push }) => {
  try {
    if (padre.notif_email && email) await email();
    if (padre.notif_push && push) await enviarPush(padre.id, push);
  } catch (err) {
    console.error(`Error avisando al padre ${padre.id}:`, err.message);
  }
};

// ¿Este aviso de compra le interesa a este padre?
const quiereCompra = (padre, total) =>
  padre.notif_compras === 'todas' || (padre.notif_compras === 'mayores' && Number(total) >= Number(padre.notif_compras_minimo));

// Se avisa una sola vez: cuando el saldo cruza el umbral hacia abajo
const cruzoUmbral = (padre, saldoAnterior, saldoNuevo) =>
  padre.notif_saldo_bajo && Number(saldoAnterior) >= Number(padre.umbral_saldo_bajo) && Number(saldoNuevo) < Number(padre.umbral_saldo_bajo);

const notificarCompra = async ({ colegioId, alumno, saldoAnterior, saldoNuevo, total, descripcion, lugar }) => {
  try {
    for (const padre of await padresDelAlumno(alumno.id)) {
      if (quiereCompra(padre, total)) {
        await avisar(padre, {
          email: () => enviarEmailCompra({ colegioId, nombrePadre: padre.nombre, emailPadre: padre.email, nombreAlumno: alumno.nombre, descripcion, monto: total, saldo: saldoNuevo, lugar }),
          push: { title: `Compra de ${alumno.nombre}`, body: `${descripcion} — ${pesos(total)} en ${lugar}. Saldo: ${pesos(saldoNuevo)}`, url: '/historial' },
        });
      }
      if (cruzoUmbral(padre, saldoAnterior, saldoNuevo)) {
        await avisar(padre, {
          email: () => enviarEmailSaldoBajo({ colegioId, nombrePadre: padre.nombre, emailPadre: padre.email, nombreAlumno: alumno.nombre, saldo: saldoNuevo, curso: alumno.curso, umbral: padre.umbral_saldo_bajo }),
          push: { title: `⚠ Saldo bajo de ${alumno.nombre}`, body: `Quedan ${pesos(saldoNuevo)}. Recargá para evitar inconvenientes.`, url: '/recargar' },
        });
      }
    }
  } catch (err) {
    console.error('Error notificarCompra:', err.message);
  }
};

// Una compra que no se permitió por las reglas de la familia o por alergia
const notificarRechazo = async ({ colegioId, alumno, motivos, lugar }) => {
  try {
    const detalle = motivos.join('. ');
    for (const padre of await padresDelAlumno(alumno.id)) {
      if (!padre.notif_rechazos) continue;
      await avisar(padre, {
        email: () => enviarEmailAviso({ colegioId, nombrePadre: padre.nombre, emailPadre: padre.email, asunto: `Compra no permitida de ${alumno.nombre}`, titulo: `${alumno.nombre} intentó comprar en ${lugar} y no se permitió.`, detalle }),
        push: { title: `Compra no permitida — ${alumno.nombre}`, body: detalle, url: '/control' },
      });
    }
  } catch (err) {
    console.error('Error notificarRechazo:', err.message);
  }
};

// Un padre bloqueó o desbloqueó algo: se avisa a los otros padres vinculados
const notificarBloqueo = async ({ colegioId, alumno, padreId, texto }) => {
  try {
    for (const padre of await padresDelAlumno(alumno.id, padreId)) {
      if (!padre.notif_bloqueos) continue;
      await avisar(padre, {
        email: () => enviarEmailAviso({ colegioId, nombrePadre: padre.nombre, emailPadre: padre.email, asunto: `Cambio en los medios de pago de ${alumno.nombre}`, titulo: texto, detalle: 'Podés ver o cambiar esto en Control, dentro de la app.' }),
        push: { title: `Medios de pago — ${alumno.nombre}`, body: texto, url: '/control' },
      });
    }
  } catch (err) {
    console.error('Error notificarBloqueo:', err.message);
  }
};

// Mercado Pago devolvió o revirtió una recarga que ya se había acreditado.
// Se avisa siempre (es plata de la familia), por los medios que eligió.
const notificarReversion = async ({ colegioId, alumnoId, monto, motivo, saldoNuevo }) => {
  try {
    const alumno = (await pool.query('SELECT id, nombre FROM alumnos WHERE id = $1', [alumnoId])).rows[0];
    if (!alumno) return;
    const titulo = `Se descontaron ${pesos(monto)} del saldo de ${alumno.nombre}: ${motivo.toLowerCase()} de una recarga en Mercado Pago.`;
    const detalle = Number(saldoNuevo) < 0
      ? `El saldo quedó en ${pesos(saldoNuevo)}. Hasta que recargues, ${alumno.nombre.split(' ')[0]} no puede comprar.`
      : `El saldo actual es ${pesos(saldoNuevo)}.`;
    for (const padre of await padresDelAlumno(alumno.id)) {
      await avisar({ ...padre, notif_email: padre.notif_email || !padre.notif_push }, {
        email: () => enviarEmailAviso({ colegioId, nombrePadre: padre.nombre, emailPadre: padre.email, asunto: `${motivo} de una recarga de ${alumno.nombre}`, titulo, detalle }),
        push: { title: `${motivo} de una recarga — ${alumno.nombre}`, body: `${titulo} ${detalle}`, url: '/historial' },
      });
    }
  } catch (err) {
    console.error('Error notificarReversion:', err.message);
  }
};

module.exports = { notificarCompra, notificarRechazo, notificarBloqueo, notificarReversion, quiereCompra, cruzoUmbral };
