// Cuánto tardó una venta en el POS (ms), para la velocidad del recreo.
// Se descartan valores imposibles o de un carrito olvidado (más de 10 minutos).
const duracionVenta = valor => {
  const ms = Math.round(Number(valor));
  return Number.isFinite(ms) && ms >= 300 && ms <= 600000 ? ms : null;
};

module.exports = { duracionVenta };
