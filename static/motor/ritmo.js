// Port de motor/ritmo.py: cuánto se tarda en dictar una combinación y hueco hasta la siguiente
// según el ritmo (1-5). Se golpea MIENTRAS se oye: no hay tiempo de ejecución aparte; el ritmo es
// solo el hueco desde que la voz termina hasta que empieza la siguiente.

import { textoHablado } from "./acciones.js";

// Lo que tarda la voz en decir un texto, de que empieza a hablar a que termina: medido con la voz
// del navegador (Microsoft Helena, es-ES, velocidad 1,1 como static/voz.js) sobre 75 combinaciones
// en los tres modos y ajustado con un poco de margen (error ±0,4 s). Recalibrar si cambia la voz.
// A otra velocidad se escala en proporción inversa (1,1 / velocidad): es una aproximación,
// recalibrar midiendo a 0,9 y 1,3.
export const HABLA_BASE = 1.0;
export const HABLA_POR_SILABA = 0.15;
export const HABLA_POR_COMA = 0.55; // pausa entre una acción y la siguiente
export const VELOCIDAD_MEDIDA = 1.1; // la de las medidas de arriba
// Velocidades de la voz que se pueden elegir en Ajustes (rate de la Web Speech API).
export const VELOCIDADES = { lenta: 0.9, normal: 1.1, rapida: 1.3 };
export const VELOCIDAD_POR_DEFECTO = "normal";
const SILABA = /[aeiouáéíóúü]+/gi;
// Hueco desde que la voz termina de decir una combinación hasta que empieza la siguiente, según el
// ritmo elegido: se sortea en el rango [mín, máx], igual para combinaciones cortas y largas.
// 1 Calmado (mover los pies) … 5 Intenso (encadenar: 1 s fijo).
export const PAUSA_POR_RITMO = { 1: [5.0, 7.0], 2: [4.0, 5.0], 3: [2.0, 4.0], 4: [1.0, 3.0], 5: [1.0, 1.0] };
export const RITMO_POR_DEFECTO = 3;

export function redondear(x, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
}

// Lo que tarda la voz en decir `texto` (sílabas aproximadas por grupos de vocales) a la
// `velocidad` de la voz.
export function segundosHabla(texto, velocidad = VELOCIDAD_MEDIDA) {
  const silabas = (texto.match(SILABA) ?? []).length;
  const comas = texto.split(",").length - 1;
  const medido = HABLA_BASE + HABLA_POR_SILABA * silabas + HABLA_POR_COMA * comas;
  return (medido * VELOCIDAD_MEDIDA) / velocidad;
}

// Tiempo desde que empieza el dictado de `texto` (lo que se dice, según el modo de voz) hasta
// que se termina de decir: se golpea mientras se oye y el hueco cuenta desde ahí.
export function duracionEstimada(combo, texto = null, velocidad = VELOCIDAD_MEDIDA) {
  return redondear(segundosHabla(texto ?? textoHablado(combo), velocidad));
}

// Hueco tras una combinación: el fijo del usuario o, si no hay, uno al azar del ritmo.
export function pausaEntreCombos(ritmo, azar, pausa = null) {
  if (pausa !== null) return pausa;
  return redondear(azar.uniform(...PAUSA_POR_RITMO[ritmo]));
}
