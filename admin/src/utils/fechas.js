// Fechas en hora argentina. El servidor guarda en UTC: tomar el día con
// toISOString() o fecha.slice(0, 10) corre al día siguiente lo de después de las 21 h.
const ZONA = 'America/Argentina/Buenos_Aires'

// Día (AAAA-MM-DD) en Argentina de una fecha o un ISO
export const diaAR = f => new Date(f).toLocaleDateString('en-CA', { timeZone: ZONA })
export const hoyAR = () => diaAR(new Date())

// Suma (o resta) días a un AAAA-MM-DD
export const sumarDias = (dia, n) => {
  const d = new Date(dia + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Un AAAA-MM-DD como fecha para mostrar (al mediodía, así no cambia de día)
export const fechaDeDia = dia => new Date(dia + 'T12:00:00Z')
