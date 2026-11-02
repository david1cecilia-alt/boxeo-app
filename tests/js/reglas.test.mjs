import assert from "node:assert/strict";
import { test } from "node:test";

import { accionesPorIds } from "../../static/motor/acciones.js";
import { esValida, ultimoGolpe, validar } from "../../static/motor/reglas.js";
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
