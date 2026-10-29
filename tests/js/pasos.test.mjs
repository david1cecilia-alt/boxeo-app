import assert from "node:assert/strict";
import { test } from "node:test";

import { crearAzar } from "../../static/motor/azar.js";
import { construirGuion } from "../../static/motor/temporizador.js";
import { pasosCombo } from "../../static/vistas/pasos.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

// Lo que se ve en pantalla, como "3 gancho dcha." por paso.
const pantalla = (ids, config) => pasosCombo(ids, config).map((p) => (p.numero ? `${p.numero} ${p.texto}` : p.texto));

test("en zurdo el 3 es el gancho de derecha y el 6 el uppercut de izquierda, también en el nombre", () => {
  // ids ya reflejados, como los da el guion zurdo de "1-2-3-6".
  const ids = ["jab", "directo", "gancho_der", "uppercut_izq"];
  assert.deepEqual(pantalla(ids, { voz: "ambos", zurdo: true }),
    ["1 jab", "2 recto", "3 gancho dcha.", "6 uppercut izq."]);
  assert.deepEqual(pantalla(["jab", "directo", "gancho_izq", "uppercut_der"], { voz: "ambos", zurdo: false }),
    ["1 jab", "2 recto", "3 gancho izq.", "6 uppercut dcha."]);
});

test("con Nombres no hay número y las defensas nunca llevan", () => {
  assert.deepEqual(pantalla(["jab", "esquiva_izq", "directo"], { voz: "nombres", zurdo: true }),
    ["jab", "esquiva izq.", "recto"]);
  assert.deepEqual(pantalla(["rodar_der", "gancho_der"], { voz: "numeros", zurdo: false }),
    ["rueda dcha.", "4 gancho dcha."]);
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
        // El gancho y el uppercut adelantados del zurdo (3 y 5) son de derecha, en pantalla y en la voz.
        if (p.numero === 3 || p.numero === 5) assert.match(p.texto, /dcha\./, e.texto);
        if (voz !== "numeros" && /gancho|uppercut/.test(p.texto)) {
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
