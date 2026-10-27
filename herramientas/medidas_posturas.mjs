// Medidas técnicas de una postura del maniquí (en grados y metros), para los tests de
// tests/js/posturas.test.mjs y para ajustar herramientas/objetivos_posturas.json a mano.
// Uso: node herramientas/medidas_posturas.mjs   -> imprime las medidas de cada postura
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cinematica, prepararPosturas, rotar } from "../static/maniqui/posturas.js";

const GRADOS = 180 / Math.PI;
// Radio del guante (puño de PERFIL_PUNO en crear_maniqui.py, ~0,1 m alrededor del punto puno).
export const RADIO_GUANTE = 0.1;
// Separación de los ojos a cada lado del punto `ojos` (centro de la cara).
const MEDIO_OJOS = 0.032;
// Los pómulos, algo por debajo de los ojos.
export const POMULOS = 0.03;

const resta = (a, b) => a.map((v, i) => v - b[i]);
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unidad = (a) => a.map((v) => v / Math.hypot(...a));
const horizontal = ([x, , z]) => unidad([x, 0, z]);

export function medidas(esqueleto, resuelta) {
  const m = cinematica(esqueleto, resuelta);
  // Hacia dónde mira el cuerpo (la pelvis), en horizontal.
  const frente = horizontal(rotar(m.pelvis.rot, [0, 0, 1]));
  // Inclinación de a → b respecto a la vertical, positiva hacia delante.
  const inclinacion = (a, b) => {
    const d = resta(m[b].pos, m[a].pos);
    return Math.atan2(punto(d, frente), d[1]) * GRADOS;
  };
  const mirada = rotar(m.cabeza.rot, [0, 0, 1]);
  const ojos = [-1, 1].map((s) => {
    const lado = rotar(m.cabeza.rot, [s * MEDIO_OJOS, 0, 0]);
    return m.ojos.pos.map((v, i) => v + lado[i]);
  });
  // Un ojo se ve de frente (desde el rival, +Z) si ningún guante delante de él lo tapa.
  const visible = (ojo) => ["izq", "der"].every((l) => {
    const g = m[`puno_${l}`].pos;
    return g[2] < ojo[2] || Math.hypot(g[0] - ojo[0], g[1] - ojo[1]) > RADIO_GUANTE;
  });
  // Ancho de hombros del cuerpo (en el reposo): la separación de los pies se compara con él.
  const hombros = 2 * Math.abs(esqueleto.hombro_izq.desde[0]);
  const rodilla = (l, otro) => {
    // Desvío de la rodilla hacia fuera (+) o hacia dentro (−) de la línea del pie.
    const pie = horizontal(resta(m[`punta_${l}`].pos, m[`tobillo_${l}`].pos));
    let fuera = [pie[2], 0, -pie[0]];
    if (punto(fuera, resta(m[`tobillo_${l}`].pos, m[`tobillo_${otro}`].pos)) < 0) fuera = fuera.map((v) => -v);
    return punto(resta(m[`rodilla_${l}`].pos, m[`tobillo_${l}`].pos), fuera);
  };
  return {
    tronco: inclinacion("pelvis", "cuello"),
    espalda_alta: inclinacion("pecho", "cuello"),
    lumbar: inclinacion("pelvis", "pecho"),
    // Cadera atrás: la pelvis por detrás del punto medio de los pies (m, hacia el frente).
    cadera_atras: -punto(resta(m.pelvis.pos, m.tobillo_izq.pos.map((v, i) => (v + m.tobillo_der.pos[i]) / 2)), frente),
    barbilla: Math.asin(-mirada[1]) * GRADOS, // positiva = mirando hacia abajo
    ojos: m.ojos.pos[1],
    ojos_visibles: ojos.every(visible),
    guantes: { izq: m.puno_izq.pos[1] - (m.ojos.pos[1] - POMULOS), der: m.puno_der.pos[1] - (m.ojos.pos[1] - POMULOS) },
    pies: Math.abs(m.tobillo_izq.pos[0] - m.tobillo_der.pos[0]) / hombros,
    rodillas: { izq: rodilla("izq", "der"), der: rodilla("der", "izq") },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
  const datos = JSON.parse(readFileSync(join(raiz, "data", "posturas.json"), "utf-8"));
  const r = (x) => (typeof x === "number" ? Math.round(x * 1000) / 1000 : x);
  for (const [id, resuelta] of Object.entries(prepararPosturas(datos))) {
    const med = medidas(datos.esqueleto, resuelta);
    console.log(id, JSON.stringify(med, (k, v) => r(v)));
  }
}
