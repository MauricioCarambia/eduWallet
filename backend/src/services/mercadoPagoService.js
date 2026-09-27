const { MercadoPagoConfig, Payment } = require('mercadopago');
const pool = require('../db/conexion');

// Cuenta de la plataforma (la del dueño de la Aplicación de MP). Se usa
// sólo si el colegio todavía no conectó su cuenta por OAuth: en ese caso
// no hay split y todo el pago entra a la plataforma, como antes.
const clientePlataforma = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

const redondear = (n) => Math.round(n * 100) / 100;

// Modelo B: el padre elige cuánto saldo cargar y la comisión se suma
// encima — el alumno recibe exactamente `monto` y el padre paga `total`.
const calcularRecarga = (monto, comisionPct) => {
  const saldo = redondear(Number(monto));
  const comision = redondear(saldo * Number(comisionPct || 0) / 100);
  return { monto: saldo, comision, total: redondear(saldo + comision) };
};

// Cliente de MP para cobrar a nombre del colegio. `split` indica si el
// colegio tiene su cuenta conectada (y por lo tanto se puede cobrar
// marketplace_fee / application_fee para la plataforma).
const clienteColegio = async (colegioId) => {
  const r = await pool.query('SELECT mp_access_token FROM colegios WHERE id = $1', [colegioId]);
  const token = r.rows[0]?.mp_access_token;
  if (!token) return { client: clientePlataforma, split: false };
  return { client: new MercadoPagoConfig({ accessToken: token }), split: true };
};

// Busca un pago probando con las cuentas de los colegios indicados y, por
// último, con la de la plataforma (un pago sólo es visible para la cuenta
// que lo cobró).
const buscarPago = async (paymentId, colegioIds = []) => {
  const clientes = [];
  for (const id of [...new Set(colegioIds)]) {
    const { client, split } = await clienteColegio(id);
    if (split) clientes.push(client);
  }
  clientes.push(clientePlataforma);

  let ultimoError;
  for (const client of clientes) {
    try {
      return await new Payment(client).get({ id: paymentId });
    } catch (err) {
      ultimoError = err;
    }
  }
  throw ultimoError;
};

// Los access_token de OAuth vencen (~180 días): se renuevan con el refresh_token
const renovarToken = async (refreshToken) => {
  const resp = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.message || 'Error al renovar el token de Mercado Pago');
  return data; // { access_token, refresh_token, expires_in, user_id, ... }
};

const vencimiento = (expiresIn) =>
  expiresIn ? new Date(Date.now() + Number(expiresIn) * 1000) : null;

// Renueva los tokens de colegios y empleados que vencen en menos de 30 días
// (o de los que no sabemos cuándo vencen)
const renovarTokensPorVencer = async () => {
  if (!process.env.MP_CLIENT_ID || !process.env.MP_CLIENT_SECRET) return;
  for (const tabla of ['colegios', 'empleados']) {
    const r = await pool.query(
      `SELECT id, mp_refresh_token FROM ${tabla}
       WHERE mp_refresh_token IS NOT NULL
         AND (mp_token_expira IS NULL OR mp_token_expira < NOW() + INTERVAL '30 days')`
    );
    for (const fila of r.rows) {
      try {
        const t = await renovarToken(fila.mp_refresh_token);
        await pool.query(
          `UPDATE ${tabla} SET mp_access_token = $1, mp_refresh_token = $2, mp_token_expira = $3 WHERE id = $4`,
          [t.access_token, t.refresh_token, vencimiento(t.expires_in), fila.id]
        );
      } catch (err) {
        console.error(`Error renovando token de MP (${tabla} ${fila.id}):`, err.message);
      }
    }
  }
};

module.exports = { clientePlataforma, calcularRecarga, clienteColegio, buscarPago, renovarTokensPorVencer, vencimiento };
