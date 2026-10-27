// Lógica del maniquí sin WebGL: esqueleto, posturas, espejo, interpolación y cinemática
// directa. La usa la escena 3D (escena.js), y se prueba con node (tests/js/posturas.test.mjs).
//
// Convenciones (data/posturas.json):
// - Metros. Y arriba. El rival está en +Z. La izquierda del maniquí es +X.
// - Cada articulación: ángulos [x, y, z] en grados respecto a su padre, orden "XYZ"
//   (R = Rx·Ry·Rz, como THREE.Euler por defecto). Sin ángulos = [0, 0, 0] (reposo: de pie,
//   brazos colgando).
// - "pelvis" es la raíz: además de ángulos lleva `pos` [x, y, z].
// - Todo en guardia ORTODOXA. El zurdo sale con espejoPostura(), como espejo() del motor.

const RAD = Math.PI / 180;

// ---------- Cuaterniones [x, y, z, w] ----------

function qMul([ax, ay, az, aw], [bx, by, bz, bw]) {
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function qEje(eje, grados) {
  const m = (grados * RAD) / 2;
  const q = [0, 0, 0, Math.cos(m)];
  q[eje] = Math.sin(m);
  return q;
}

// Ángulos [x, y, z] en grados, orden XYZ → cuaternión.
export function cuaternion([x, y, z]) {
  return qMul(qMul(qEje(0, x), qEje(1, y)), qEje(2, z));
}

export function slerp(a, b, t) {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  // Camino corto.
  if (cos < 0) { b = b.map((v) => -v); cos = -cos; }
  if (cos > 0.9995) {
    const q = a.map((v, i) => v + (b[i] - v) * t);
    const n = Math.hypot(...q);
    return q.map((v) => v / n);
  }
  const theta = Math.acos(cos);
  const s = Math.sin(theta);
  const ka = Math.sin((1 - t) * theta) / s;
  const kb = Math.sin(t * theta) / s;
  return a.map((v, i) => v * ka + b[i] * kb);
}

export function rotar([qx, qy, qz, qw], [vx, vy, vz]) {
  // v' = q · v · q⁻¹ (forma rápida)
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

// ---------- Posturas ----------

// Postura "resuelta": { pos: [x, y, z], rot: { articulación: cuaternión } } para todas.
export function resolver(esqueleto, postura) {
  const rot = {};
  for (const nombre of Object.keys(esqueleto)) rot[nombre] = cuaternion(postura[nombre] ?? [0, 0, 0]);
  return { pos: [...postura.pos], rot };
}

const LADO = { izq: "der", der: "izq" };
const ladoOpuesto = (nombre) => nombre.replace(/_(izq|der)$/, (_, l) => `_${LADO[l]}`);

// Zurdo: se cambian izquierda y derecha y se refleja en el plano X = 0. Reflejar una
// rotación Rx(a)·Ry(b)·Rz(c) da Rx(a)·Ry(−b)·Rz(−c).
export function espejoPostura(postura) {
  const espejo = { pos: [-postura.pos[0], postura.pos[1], postura.pos[2]] };
  for (const [nombre, valor] of Object.entries(postura)) {
    if (nombre === "pos" || !Array.isArray(valor)) continue;
    const [x, y, z] = valor;
    espejo[ladoOpuesto(nombre)] = [x, -y, -z];
  }
  return espejo;
}

export function interpolar(a, b, t) {
  const rot = {};
  for (const nombre of Object.keys(a.rot)) rot[nombre] = slerp(a.rot[nombre], b.rot[nombre], t);
  return { pos: a.pos.map((v, i) => v + (b.pos[i] - v) * t), rot };
}

// Suavizado de la animación entre pasos (empieza y acaba despacio).
export const suave = (t) => t * t * (3 - 2 * t);

// ---------- Cinemática directa ----------

// Posición y orientación en el mundo de cada articulación y de los extremos
// ({ nombre: { pos, rot } }). El esqueleto viene ordenado de padres a hijos.
export function cinematica(esqueleto, resuelta) {
  const mundo = {};
  for (const [nombre, { padre, desde }] of Object.entries(esqueleto)) {
    if (!padre) {
      mundo[nombre] = { pos: resuelta.pos, rot: resuelta.rot[nombre] };
      continue;
    }
    const p = mundo[padre];
    const desplazado = rotar(p.rot, desde);
    mundo[nombre] = {
      pos: p.pos.map((v, i) => v + desplazado[i]),
      rot: qMul(p.rot, resuelta.rot[nombre]),
    };
  }
  return mundo;
}

// Carga data/posturas.json ya resuelto. `zurdo` refleja todas las posturas.
export function prepararPosturas(datos, { zurdo = false } = {}) {
  const posturas = {};
  for (const [id, postura] of Object.entries(datos.posturas)) {
    posturas[id] = resolver(datos.esqueleto, zurdo ? espejoPostura(postura) : postura);
  }
  return posturas;
}
