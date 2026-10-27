// Calcula los ángulos de data/posturas.json a partir de objetivos legibles
// (herramientas/objetivos_posturas.json): dónde va cada puño y cada tobillo, hacia dónde
// apuntan codos y rodillas (polo) y los ángulos del tronco que se dan tal cual.
// Brazos y piernas se resuelven con IK analítica de dos huesos; los pies quedan con el
// rumbo de su rodilla y la inclinación pedida (talón levantado).
//
// Uso: node herramientas/ajustar_posturas.mjs            -> reescribe data/posturas.json
//      node herramientas/ajustar_posturas.mjs --comprobar -> falla si no está al día
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { cinematica, cuaternion, resolver, rotar } from "../static/maniqui/posturas.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUTA_POSTURAS = join(RAIZ, "data", "posturas.json");
const RUTA_OBJETIVOS = join(RAIZ, "herramientas", "objetivos_posturas.json");
const GRADOS = 180 / Math.PI;

// ---------- Álgebra mínima ----------
const resta = (a, b) => a.map((v, i) => v - b[i]);
const suma = (a, b) => a.map((v, i) => v + b[i]);
const escala = (a, k) => a.map((v) => v * k);
const punto = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const largo = (a) => Math.hypot(...a);
const unidad = (a) => escala(a, 1 / largo(a));
const conjugado = ([x, y, z, w]) => [-x, -y, -z, w];

function qMul([ax, ay, az, aw], [bx, by, bz, bw]) {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

// Matriz de columnas X, Y, Z (ortonormal) → cuaternión.
function deEjes(X, Y, Z) {
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]];
  const traza = m11 + m22 + m33;
  if (traza > 0) {
    const s = 0.5 / Math.sqrt(traza + 1);
    return [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s];
  }
  if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
    return [0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s];
  }
  if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
    return [(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s];
  }
  const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
  return [(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s];
}

// Cuaternión → ángulos [x, y, z] en grados, orden XYZ (como THREE.Euler.setFromRotationMatrix).
function angulos(q) {
  const X = rotar(q, [1, 0, 0]);
  const Y = rotar(q, [0, 1, 0]);
  const Z = rotar(q, [0, 0, 1]);
  const [m11, m12, m13, m23, m33, m32, m22] = [X[0], Y[0], Z[0], Z[1], Z[2], Y[2], Y[1]];
  const y = Math.asin(Math.max(-1, Math.min(1, m13)));
  let x;
  let z;
  if (Math.abs(m13) < 0.9999999) {
    x = Math.atan2(-m23, m33);
    z = Math.atan2(-m12, m11);
  } else {
    x = Math.atan2(m32, m22);
    z = 0;
  }
  return [x, y, z].map((v) => Math.round(v * GRADOS * 10) / 10 + 0);
}

// ---------- IK de dos huesos ----------
// Cadena raíz → medio → fin, con huesos que en reposo apuntan a −Y local. Devuelve los
// ángulos locales de la raíz y del medio (este solo flexiona en su X). `signo` es el sentido
// natural de la flexión: rodilla +1 (la pierna se dobla hacia atrás), codo −1 (hacia delante).
// Sin él, el marco puede salir girado 180° y los ángulos son correctos pero ilegibles.
function dosHuesos(esqueleto, postura, raiz, medio, fin, objetivo, polo, signo, extra = 0) {
  const l1 = largo(esqueleto[medio].desde);
  const l2 = largo(esqueleto[fin].desde) + extra;
  const mundo = cinematica(esqueleto, resolver(esqueleto, postura));
  const A = mundo[raiz].pos;
  const padre = mundo[esqueleto[raiz].padre].rot;

  const haciaObjetivo = resta(objetivo, A);
  const d = Math.min(largo(haciaObjetivo), (l1 + l2) * 0.999);
  const u = unidad(haciaObjetivo);
  const v = unidad(resta(polo, escala(u, punto(polo, u))));
  const alfa = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const d1 = suma(escala(u, Math.cos(alfa)), escala(v, Math.sin(alfa)));

  // Marco del primer hueso: Y local = −d1; X local = normal del plano de flexión.
  const Y = escala(d1, -1);
  // X local: normal del plano, orientada para que la flexión tenga el signo natural.
  const normal = unidad(cruz(u, v));
  const llegada = unidad(resta(suma(A, escala(u, d)), suma(A, escala(d1, l1))));
  const X = punto(cruz(normal, Y), llegada) * signo > 0 ? escala(normal, -1) : normal;
  const Z = cruz(X, Y);
  const mundoRaiz = deEjes(X, Y, Z);
  const localRaiz = qMul(conjugado(padre), mundoRaiz);

  const B = suma(A, escala(d1, l1));
  const d2 = rotar(conjugado(mundoRaiz), unidad(resta(suma(A, escala(u, d)), B)));
  const flexion = Math.atan2(-d2[2], -d2[1]) * GRADOS;
  return { [raiz]: angulos(localRaiz), [medio]: [Math.round(flexion * 10) / 10 + 0, 0, 0] };
}

// Pie con rumbo `rumbo` (grados alrededor de Y; 0 = hacia el rival) y talón levantado `talon`.
function pie(esqueleto, postura, tobillo, rumbo, talon) {
  const mundo = cinematica(esqueleto, resolver(esqueleto, postura));
  const padre = mundo[esqueleto[tobillo].padre].rot;
  const deseado = qMul(cuaternion([0, rumbo, 0]), cuaternion([talon, 0, 0]));
  return angulos(qMul(conjugado(padre), deseado));
}

export function calcular(datos, objetivos) {
  const esqueleto = datos.esqueleto;
  const posturas = {};
  for (const [id, o] of Object.entries(objetivos.posturas)) {
    const postura = { pos: o.pelvis.pos, ...o.angulos };
    for (const lado of ["izq", "der"]) {
      const b = o.brazos[lado];
      // El puño es la prolongación del antebrazo (muñeca recta en X y Z).
      Object.assign(postura, dosHuesos(esqueleto, postura, `hombro_${lado}`, `codo_${lado}`,
        `muneca_${lado}`, b.puno, b.polo, -1, largo(esqueleto[`puno_${lado}`].desde)));
      const p = o.piernas[lado];
      const polo = rotar(cuaternion([0, p.rumbo, 0]), [0, 0, 1]);
      Object.assign(postura, dosHuesos(esqueleto, postura, `cadera_${lado}`, `rodilla_${lado}`,
        `tobillo_${lado}`, p.tobillo, polo, 1));
      postura[`tobillo_${lado}`] = pie(esqueleto, postura, `tobillo_${lado}`, p.rumbo, p.talon ?? 0);
    }
    posturas[id] = { ...postura, revisar: o.revisar, pendiente: o.pendiente };
  }
  return posturas;
}

// Una articulación por línea, para que los cambios se lean bien en git.
function formatear(datos) {
  const linea = (k, v) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)}`;
  const posturas = Object.entries(datos.posturas).map(([id, p]) =>
    `    ${JSON.stringify(id)}: {\n${Object.entries(p).map(([k, v]) => linea(k, v)).join(",\n")}\n    }`);
  const esqueleto = Object.entries(datos.esqueleto).map(([k, v]) =>
    `    ${JSON.stringify(k)}: {"padre": ${JSON.stringify(v.padre)}, "desde": ${JSON.stringify(v.desde)}}`);
  return `{\n  "_nota": ${JSON.stringify(datos._nota)},\n  "esqueleto": {\n${esqueleto.join(",\n")}\n  },\n`
    + `  "posturas": {\n${posturas.join(",\n")}\n  }\n}\n`;
}

export function contenido() {
  const datos = JSON.parse(readFileSync(RUTA_POSTURAS, "utf-8"));
  const objetivos = JSON.parse(readFileSync(RUTA_OBJETIVOS, "utf-8"));
  return formatear({ ...datos, posturas: calcular(datos, objetivos) });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const nuevo = contenido();
  if (process.argv.includes("--comprobar")) {
    if (readFileSync(RUTA_POSTURAS, "utf-8").replace(/\r\n/g, "\n") !== nuevo) {
      console.error("data/posturas.json no está al día: node herramientas/ajustar_posturas.mjs");
      process.exit(1);
    }
  } else {
    writeFileSync(RUTA_POSTURAS, nuevo);
    console.log(`Posturas: ${Object.keys(JSON.parse(nuevo).posturas).join(", ")}`);
  }
}
