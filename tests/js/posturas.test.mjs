// Posturas del maniquí (data/posturas.json) y su lógica (static/maniqui/posturas.js):
// espejo para zurdo, interpolación, pies en el suelo, fichas que apuntan a posturas que
// existen y carga diferida de Three.js.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { contenido } from "../../herramientas/ajustar_posturas.mjs";
import {
  cinematica, espejoPostura, interpolar, prepararPosturas, resolver, slerp,
} from "../../static/maniqui/posturas.js";
import { RAIZ } from "./datos.mjs";

const leer = (...ruta) => readFileSync(join(RAIZ, ...ruta), "utf-8");
const datos = JSON.parse(leer("data", "posturas.json"));
const tecnica = JSON.parse(leer("data", "tecnica.json"));
const { esqueleto } = datos;
const cerca = (a, b, tol = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < tol);
const opuesto = (n) => n.replace(/_(izq|der)$/, (_, l) => (l === "izq" ? "_der" : "_izq"));

test("posturas.json está al día con sus objetivos", () => {
  assert.equal(leer("data", "posturas.json").replace(/\r\n/g, "\n"), contenido(),
    "Ejecuta: node herramientas/ajustar_posturas.mjs");
});

test("el esqueleto va de padres a hijos y cada postura usa articulaciones que existen", () => {
  const vistos = new Set();
  for (const [nombre, { padre }] of Object.entries(esqueleto)) {
    assert.ok(padre === null || vistos.has(padre), `${nombre}: su padre ${padre} va después`);
    vistos.add(nombre);
  }
  for (const [id, postura] of Object.entries(datos.posturas)) {
    for (const [clave, valor] of Object.entries(postura)) {
      if (Array.isArray(valor) && clave !== "pos") assert.ok(clave in esqueleto, `${id}: ${clave}`);
    }
  }
});

test("toda postura está pendiente de revisar hasta que la vea el entrenador", () => {
  for (const [id, p] of Object.entries(datos.posturas)) {
    assert.equal(typeof p.revisar, "boolean", id);
    if (p.revisar) assert.ok(p.pendiente.startsWith("REVISAR CON ENTRENADOR:"), id);
  }
});

test("los pasos de las fichas apuntan a posturas que existen", () => {
  for (const ficha of tecnica.fichas) {
    for (const paso of ficha.pasos) {
      if (paso.postura) assert.ok(paso.postura in datos.posturas, `${ficha.id}: ${paso.postura}`);
    }
  }
});

test("los pies están en el suelo en todas las posturas", () => {
  for (const [id, r] of Object.entries(prepararPosturas(datos))) {
    const mundo = cinematica(esqueleto, r);
    for (const lado of ["izq", "der"]) {
      const tobillo = mundo[`tobillo_${lado}`].pos[1];
      const punta = mundo[`punta_${lado}`].pos[1];
      assert.ok(tobillo > 0.04 && tobillo < 0.14, `${id} ${lado}: tobillo a ${tobillo.toFixed(3)} m`);
      assert.ok(punta > -0.03 && punta < 0.06, `${id} ${lado}: punta a ${punta.toFixed(3)} m`);
    }
  }
});

test("el espejo dos veces deja la postura igual", () => {
  for (const p of Object.values(datos.posturas)) {
    const doble = espejoPostura(espejoPostura(p));
    for (const [clave, valor] of Object.entries(p)) {
      if (Array.isArray(valor)) assert.ok(cerca(doble[clave].map((v) => v + 0), valor), clave);
    }
  }
});

test("el zurdo es el reflejo exacto del ortodoxo: X cambia de signo e izq ↔ der", () => {
  const orto = prepararPosturas(datos);
  const zurdo = prepararPosturas(datos, { zurdo: true });
  for (const id of Object.keys(orto)) {
    const a = cinematica(esqueleto, orto[id]);
    const b = cinematica(esqueleto, zurdo[id]);
    for (const nombre of Object.keys(esqueleto)) {
      const [x, y, z] = a[nombre].pos;
      assert.ok(cerca(b[opuesto(nombre)].pos, [-x, y, z]), `${id}: ${nombre}`);
    }
  }
});

test("en guardia ortodoxa el pie y el puño izquierdos van delante", () => {
  const mundo = cinematica(esqueleto, prepararPosturas(datos).guardia);
  assert.ok(mundo.tobillo_izq.pos[2] > mundo.tobillo_der.pos[2] + 0.3);
  assert.ok(mundo.puno_izq.pos[2] > mundo.puno_der.pos[2]);
  // Las manos arriba: a la altura de la cara, por encima de los hombros.
  for (const lado of ["izq", "der"]) assert.ok(mundo[`puno_${lado}`].pos[1] > mundo[`hombro_${lado}`].pos[1]);
});

test("en el jab el puño izquierdo llega más lejos y el derecho no se mueve", () => {
  const P = prepararPosturas(datos);
  const guardia = cinematica(esqueleto, P.guardia);
  const impacto = cinematica(esqueleto, P.jab_impacto);
  assert.ok(impacto.puno_izq.pos[2] > guardia.puno_izq.pos[2] + 0.4);
  assert.ok(cerca(impacto.puno_der.pos, guardia.puno_der.pos, 0.02), "la mano derecha se queda en la cara");
});

test("interpolar empieza y acaba en las posturas y da cuaterniones unitarios", () => {
  const a = resolver(esqueleto, datos.posturas.guardia);
  const b = resolver(esqueleto, datos.posturas.jab_impacto);
  for (const [t, esperado] of [[0, a], [1, b]]) {
    const r = interpolar(a, b, t);
    for (const n of Object.keys(esqueleto)) {
      const q = r.rot[n];
      const e = esperado.rot[n];
      // q y −q son la misma rotación.
      assert.ok(cerca(q, e, 1e-9) || cerca(q, e.map((v) => -v), 1e-9), `${n} en t=${t}`);
    }
  }
  const medio = interpolar(a, b, 0.5);
  for (const q of Object.values(medio.rot)) assert.ok(Math.abs(Math.hypot(...q) - 1) < 1e-9);
  assert.ok(cerca(slerp([0, 0, 0, 1], [0, 0, 0, 1], 0.3), [0, 0, 0, 1]));
});

test("Three.js solo se carga con import() desde el maniquí", () => {
  const conThree = ["app.js", "maniqui/maniqui.js", "maniqui/posturas.js", "maniqui/lienzo.js"];
  for (const f of conThree) assert.ok(!leer("static", f).includes("vendor/three"), f);
  assert.match(leer("static", "maniqui", "maniqui.js"), /await import\("\.\/escena\.js"\)/);
  assert.match(leer("static", "index.html"), /^(?![\s\S]*vendor\/three)/);
});
