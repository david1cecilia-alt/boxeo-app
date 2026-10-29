import assert from "node:assert/strict";
import { test } from "node:test";

import { accionesPorIds, catalogo, espejo, espejoCombo, numero, textoHablado } from "../../static/motor/acciones.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

const ORTODOXO = { jab: 1, directo: 2, gancho_izq: 3, gancho_der: 4, uppercut_izq: 5, uppercut_der: 6 };

test("numeración del 1 al 6 en ortodoxo y la misma por mano adelantada/trasera en zurdo", () => {
  for (const [id, n] of Object.entries(ORTODOXO)) {
    const a = catalogo().get(id);
    assert.equal(numero(a), n, id);
    assert.equal(numero(espejo(a), true), n, `${id} zurdo`);
  }
  assert.equal(numero(catalogo().get("gancho_der"), true), 3);
});

test("Números, Nombres y Ambos (ortodoxo)", () => {
  const combo = accionesPorIds(["jab", "directo", "esquiva_der", "gancho_izq"]);
  assert.equal(textoHablado(combo, "nombres"), "jab, recto, esquiva derecha, gancho de izquierda");
  assert.equal(textoHablado(combo, "numeros"), "uno, dos, esquiva derecha, tres");
  assert.equal(textoHablado(combo, "ambos"), "uno jab, dos recto, esquiva derecha, tres gancho de izquierda");
});

test("Números y Ambos en zurdo", () => {
  const zurda = espejoCombo(accionesPorIds(["jab", "gancho_izq", "uppercut_der", "rodar_izq", "gancho_izq"]));
  assert.equal(textoHablado(zurda, "numeros", true), "uno, tres, seis, rueda derecha, tres");
  assert.equal(textoHablado(zurda, "ambos", true),
    "uno jab, tres gancho de derecha, seis uppercut de izquierda, rueda derecha, tres gancho de derecha");
});
