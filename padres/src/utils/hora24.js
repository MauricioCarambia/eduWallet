// En Chrome, 'es-AR' usa reloj de 12 horas sin "a. m./p. m.": las 15:00 salían
// como "03:00". Se fuerza 24 horas en todas las fechas con hora de la app,
// salvo que una llamada pida otra cosa a propósito.
const original = { fecha: Date.prototype.toLocaleString, hora: Date.prototype.toLocaleTimeString }
const en24 = opciones => (opciones && ('hour12' in opciones || 'hourCycle' in opciones) ? opciones : { ...opciones, hourCycle: 'h23' })

Date.prototype.toLocaleString = function (locales, opciones) { return original.fecha.call(this, locales, en24(opciones)) }
Date.prototype.toLocaleTimeString = function (locales, opciones) { return original.hora.call(this, locales, en24(opciones)) }
