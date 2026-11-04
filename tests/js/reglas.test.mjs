import assert from "node:assert/strict";
import { test } from "node:test";

import { accionesPorIds } from "../../static/motor/acciones.js";
import { MAX_ACCIONES, MAX_PROPIAS, avisosCreador, esValida, nivelDe, ultimoGolpe, validar } from "../../static/motor/reglas.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

const combo = (...ids) => accionesPorIds(ids);

test("la única regla es que haya al menos un golpe, como en motor/reglas.py", () => {
  assert.deepEqual(validar(combo("jab", "directo")), []);
  assert.deepEqual(validar(combo("esquiva_der", "pivote")), ["no hay ningún golpe"]);
  assert.ok(esValida(combo("jab", "directo", "bloqueo")));
  assert.ok(esValida(combo("rodar_izq", "directo_cuerpo")));
});

test("el último golpe ignora la salida", () => {
  assert.equal(ultimoGolpe(combo("jab", "directo", "gancho_izq", "esquiva_der")).id, "gancho_izq");
  assert.equal(ultimoGolpe(combo("esquiva_der", "pivote")), null);
});

test("nivel por número de acciones: 2-4 básico, 5-6 medio, 7-10 avanzado y nada fuera de 2-10", () => {
  const casos = [[0, null], [1, null], [2, 1], [4, 1], [5, 2], [6, 2], [7, 3], [10, 3], [11, null]];
  for (const [n, nivel] of casos) assert.equal(nivelDe(combo(...Array(n).fill("jab"))), nivel, `${n} acciones`);
  assert.equal(MAX_ACCIONES, 10);
  assert.equal(nivelDe(combo("jab", "gancho_izq", "rodar_der", "uppercut_der", "gancho_der")), 2);
});

// ---------- Avisos del creador (port de tests/test_reglas.py) ----------

const propias = (...listas) => listas.map((ids, i) => ({ id: `p-${i}`, ids }));

test("avisos del creador: nueva, sin golpes, de la biblioteca, igual que otra propia", () => {
  assert.deepEqual(avisosCreador(["jab", "directo", "rodar_izq", "directo", "gancho_izq"]),
    { nivel: 2, avisos: [], puede_guardar: true, motivo: null });
  assert.deepEqual(avisosCreador(["esquiva_der", "paso_atras", "pivote"]).avisos,
    [{ tipo: "sin_golpes", texto: "No lleva ningún golpe." }]);
  assert.deepEqual(avisosCreador(["jab", "directo"]).avisos,
    [{ tipo: "biblioteca", nivel: 1, texto: "Ya está en la biblioteca, en nivel básico." }]);
  const tres = propias(["jab", "jab"], ["bloqueo", "gancho_izq", "jab"], ["bloqueo", "gancho_izq", "jab"]);
  assert.deepEqual(avisosCreador(["bloqueo", "gancho_izq", "jab"], tres).avisos,
    [{ tipo: "propia", numero: 2, texto: "Es igual que tu combinación 2." }]);
  assert.equal(avisosCreador(["bloqueo", "gancho_izq", "jab"], tres, "p-1").avisos[0].numero, 3);
  assert.deepEqual(avisosCreador(["jab", "jab"], tres, "p-0").avisos, []);
  assert.deepEqual(avisosCreador(["esquiva_der", "esquiva_izq"], propias(["esquiva_der", "esquiva_izq"])).avisos
    .map((a) => a.tipo), ["sin_golpes", "propia"]);
});

test("se guarda de 2 a 10 acciones y con menos de 20 propias (salvo al editar una)", () => {
  assert.equal(MAX_PROPIAS, 20);
  for (const [n, motivo] of [[0, "Añade al menos 2 acciones."], [1, "Añade al menos 2 acciones."], [2, null], [10, null],
    [11, "Como mucho 10 acciones."]]) {
    const r = avisosCreador(Array(n).fill("jab"));
    assert.equal(r.motivo, motivo, String(n));
    assert.equal(r.puede_guardar, motivo === null);
  }
  const llenas = propias(...Array(20).fill(["jab", "directo", "jab"]));
  assert.equal(avisosCreador(["jab", "gancho_izq"], llenas).motivo, "Ya tienes 20 combinaciones: borra alguna para guardar otra.");
  assert.ok(avisosCreador(["jab", "gancho_izq"], llenas, "p-4").puede_guardar);
  assert.deepEqual(avisosCreador(["jab", "patada"]),
    { nivel: null, avisos: [], puede_guardar: false, motivo: "Lleva una acción que la app no conoce." });
});
