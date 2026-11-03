import assert from "node:assert/strict";
import { test } from "node:test";

import { crearAzar } from "../../static/motor/azar.js";
import { construirGuion } from "../../static/motor/temporizador.js";
import { combinacionesParaVer, pasosCombo, vozDeSesion, vozDelTexto } from "../../static/vistas/pasos.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

// Lo que se ve en pantalla, como "3 crochet dcha." por paso.
const pantalla = (ids, config) => pasosCombo(ids, config).map((p) => (p.numero ? `${p.numero} ${p.texto}` : p.texto));

test("en zurdo el 3 es el crochet de derecha y el 6 el gancho de izquierda, también en el nombre", () => {
  // ids ya reflejados, como los da el guion zurdo de "1-2-3-6".
  const ids = ["jab", "directo", "gancho_der", "uppercut_izq"];
  assert.deepEqual(pantalla(ids, { voz: "ambos", zurdo: true }),
    ["1 jab", "2 recto", "3 crochet dcha.", "6 gancho izq."]);
  assert.deepEqual(pantalla(["jab", "directo", "gancho_izq", "uppercut_der"], { voz: "ambos", zurdo: false }),
    ["1 jab", "2 recto", "3 crochet izq.", "6 gancho dcha."]);
});

test("con Nombres no hay número y las defensas nunca llevan", () => {
  assert.deepEqual(pantalla(["jab", "esquiva_izq", "directo"], { voz: "nombres", zurdo: true }),
    ["jab", "esquiva izq.", "recto"]);
  assert.deepEqual(pantalla(["rodar_der", "gancho_der"], { voz: "numeros", zurdo: false }),
    ["esq. abajo dcha.", "4 crochet dcha."]);
});

test("en un guion zurdo, pantalla y voz dicen el mismo golpe con su lado", () => {
  for (const voz of ["numeros", "nombres", "ambos"]) {
    const config = { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 3, zurdo: true, voz };
    const combos = construirGuion(config, crearAzar(7)).filter((e) => e.tipo === "combo");
    for (const e of combos) {
      const pasos = pasosCombo(e.ids, config);
      const dichos = e.texto.split(", ");
      assert.equal(pasos.length, dichos.length);
      pasos.forEach((p, i) => {
        // El crochet y el gancho adelantados del zurdo (3 y 5) son de derecha, en pantalla y en la voz.
        if (p.numero === 3 || p.numero === 5) assert.match(p.texto, /dcha\./, e.texto);
        if (voz !== "numeros" && /crochet|gancho/.test(p.texto)) {
          const lado = p.texto.includes("dcha.") ? "derecha" : "izquierda";
          assert.ok(dichos[i].includes(lado), `${p.texto} / ${dichos[i]}`);
        }
        if (voz !== "nombres" && p.numero) {
          const palabra = ["uno", "dos", "tres", "cuatro", "cinco", "seis"][p.numero - 1];
          assert.ok(dichos[i].startsWith(palabra), `${p.numero} / ${dichos[i]}`);
        }
      });
    }
  }
});

test("la voz de un texto guardado se deduce de sus números", () => {
  assert.equal(vozDelTexto("uno, dos, esquiva derecha, tres"), "numeros");
  assert.equal(vozDelTexto("uno jab, dos recto, esquiva derecha"), "ambos");
  assert.equal(vozDelTexto("jab, recto, gancho de izquierda"), "nombres");
  assert.equal(vozDelTexto("cúbrete, gancho de izquierda"), "nombres");
});

// Una sesión vieja (sin voz guardada, con los nombres de antes: el 3 era «gancho de izquierda» y
// la esquiva abajo, «rueda»). La segunda combinación no lleva golpes con número: no delata la voz.
const vieja = (textos) => ({
  zurdo: false,
  combinaciones: [
    { asalto: 1, texto: textos[0], ids: ["jab", "gancho_izq", "rodar_der"] },
    { asalto: 1, texto: textos[1], ids: ["rodar_izq", "bloqueo"] },
    { asalto: 2, texto: textos[2], ids: ["directo", "gancho_izq"] },
  ],
});
const verTextos = (s) => combinacionesParaVer(s, s.combinaciones).map((c) => c.texto);

test("sesión vieja en Ambos: se ve con los números en cifra y los nombres de hoy, toda igual", () => {
  const s = vieja(["uno jab, tres gancho de izquierda, rueda derecha", "rueda izquierda, bloqueo", "dos recto, tres gancho de izquierda"]);
  assert.equal(vozDeSesion(s, s.combinaciones), "ambos");
  assert.deepEqual(verTextos(s), [
    "1 jab, 3 crochet de izquierda, esquiva abajo derecha",
    "esquiva abajo izquierda, bloqueo",
    "2 recto, 3 crochet de izquierda",
  ]);
});

test("sesión vieja en Nombres: sin números", () => {
  const s = vieja(["jab, gancho de izquierda, rueda derecha", "rueda izquierda, bloqueo", "recto, gancho de izquierda"]);
  assert.equal(vozDeSesion(s, s.combinaciones), "nombres");
  assert.deepEqual(verTextos(s), [
    "jab, crochet de izquierda, esquiva abajo derecha",
    "esquiva abajo izquierda, bloqueo",
    "recto, crochet de izquierda",
  ]);
});

test("sesión vieja en Números: solo la cifra de los golpes; las defensas, con su orden", () => {
  const s = vieja(["uno, tres, rueda derecha", "rueda izquierda, bloqueo", "dos, tres"]);
  assert.deepEqual(verTextos(s), ["1, 3, esquiva abajo derecha", "esquiva abajo izquierda, bloqueo", "2, 3"]);
});

test("sesión vieja ambigua (se contradice o no delata nada): Ambos, que no pierde nada", () => {
  const mezcla = vieja(["uno jab, tres gancho de izquierda, rueda derecha", "rueda izquierda, bloqueo", "recto, gancho de izquierda"]);
  assert.equal(vozDeSesion(mezcla, mezcla.combinaciones), "ambos");
  const sinGolpes = { combinaciones: [{ asalto: 1, texto: "rueda izquierda, bloqueo", ids: ["rodar_izq", "bloqueo"] }] };
  assert.equal(vozDeSesion(sinGolpes, sinGolpes.combinaciones), "ambos");
  assert.deepEqual(verTextos(sinGolpes), ["esquiva abajo izquierda, bloqueo"]);
});

test("sesión nueva con voz guardada: manda la voz, no el texto; el zurdo guarda los ids en espejo", () => {
  const s = { ...vieja(["jab, crochet de izquierda, esquiva abajo derecha", "esquiva abajo izquierda, bloqueo", "recto, crochet de izquierda"]), voz: "ambos" };
  assert.equal(vozDeSesion(s, s.combinaciones), "ambos");
  assert.equal(verTextos(s)[0], "1 jab, 3 crochet de izquierda, esquiva abajo derecha");
  const zurdo = { voz: "numeros", zurdo: true, combinaciones: [{ asalto: 1, texto: "uno, tres", ids: ["jab", "gancho_der"] }] }; // su 3 es gancho_der
  assert.deepEqual(verTextos(zurdo), ["1, 3"]);
});

test("ids que ya no existen o sin ids: el texto guardado tal cual", () => {
  const s = { voz: "ambos", combinaciones: [
    { asalto: 1, texto: "uno jab, golpe raro", ids: ["jab", "golpe_borrado"] },
    { asalto: 1, texto: "sin ids", ids: [] },
  ] };
  assert.deepEqual(verTextos(s), ["uno jab, golpe raro", "sin ids"]);
});
