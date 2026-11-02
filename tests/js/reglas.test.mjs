import assert from "node:assert/strict";
import { test } from "node:test";

import { accionesPorIds } from "../../static/motor/acciones.js";
import { MAX_ACCIONES, esValida, nivelDe, ultimoGolpe, validar } from "../../static/motor/reglas.js";
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
