// Port de motor/ritmo.py: cuánto se tarda en dictar y ejecutar una combinación, y pausas según
// el ritmo (1-5).

import { textoHablado } from "./acciones.js";

// Lo que tarda la voz en decir un texto, de que empieza a hablar a que termina: medido con la voz
// del navegador (Microsoft Helena, es-ES, velocidad 1,1 como static/voz.js) sobre 75 combinaciones
// en los tres modos y ajustado con un poco de margen (error ±0,4 s). Recalibrar si cambia la voz.
export const HABLA_BASE = 1.0;
export const HABLA_POR_SILABA = 0.15;
export const HABLA_POR_COMA = 0.55; // pausa entre una acción y la siguiente
const SILABA = /[aeiouáéíóúü]+/gi;
// Segundos para ejecutar cada acción después de oírla.
export const SEGUNDOS_EJECUCION = { golpe: 0.5, defensa: 0.8, movimiento: 1.0 };
// Pausa (recuperar guardia) entre el final de una combinación y la siguiente, según el ritmo
// elegido: se sortea en el rango [mín, máx]. 1 = Calmado … 5 = Intenso.
export const PAUSA_POR_RITMO = { 1: [6.0, 8.0], 2: [4.9, 6.6], 3: [3.8, 5.3], 4: [2.6, 3.9], 5: [1.5, 2.5] };
export const RITMO_POR_DEFECTO = 3;
// Las combinaciones largas piden recuperar más: segundos de más por cada acción a partir de la 4.ª.
export const ACCIONES_SIN_EXTRA = 3;
export const EXTRA_POR_ACCION = 0.3;

export function redondear(x, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
}

// Lo que tarda la voz en decir `texto` (sílabas aproximadas por grupos de vocales).
export function segundosHabla(texto) {
  const silabas = (texto.match(SILABA) ?? []).length;
  const comas = texto.split(",").length - 1;
  return HABLA_BASE + HABLA_POR_SILABA * silabas + HABLA_POR_COMA * comas;
}

// Tiempo desde que empieza el dictado de `texto` (lo que se dice, según el modo de voz) hasta
// que se termina de decir y de ejecutar: la pausa entre combinaciones cuenta desde ahí.
export function duracionEstimada(combo, texto = null) {
  const ejecucion = combo.reduce((s, a) => s + SEGUNDOS_EJECUCION[a.tipo], 0);
  return redondear(segundosHabla(texto ?? textoHablado(combo)) + ejecucion);
}

export function extraPorLongitud(combo) {
  return EXTRA_POR_ACCION * Math.max(0, combo.length - ACCIONES_SIN_EXTRA);
}

// Pausa tras `combo`: la fija del usuario o, si no hay, una al azar del ritmo más lo que
// pida su longitud.
export function pausaEntreCombos(ritmo, combo, azar, pausa = null) {
  if (pausa !== null) return pausa;
  return redondear(azar.uniform(...PAUSA_POR_RITMO[ritmo]) + extraPorLongitud(combo));
}
