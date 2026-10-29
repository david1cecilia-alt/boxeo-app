import assert from "node:assert/strict";
import { test } from "node:test";

import { VELOCIDADES, VELOCIDAD_MEDIDA, VELOCIDAD_POR_DEFECTO, segundosHabla } from "../../static/motor/ritmo.js";
import { validarConfig } from "../../static/motor/temporizador.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

const BASE = { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 1, ritmo: 3, pausa: null, voz: "nombres" };

test("las mismas velocidades que motor/ritmo.py", () => {
  assert.deepEqual(VELOCIDADES, { lenta: 0.9, normal: 1.1, rapida: 1.3 });
  assert.equal(VELOCIDADES[VELOCIDAD_POR_DEFECTO], VELOCIDAD_MEDIDA);
});

test("la estimación de voz escala en proporción inversa a la velocidad", () => {
  const texto = "jab, recto, gancho de izquierda";
  const normal = segundosHabla(texto);
  assert.equal(segundosHabla(texto, 1.1), normal);
  assert.ok(Math.abs(segundosHabla(texto, 0.9) - (normal * 1.1) / 0.9) < 1e-9);
  assert.ok(Math.abs(segundosHabla(texto, 1.3) - (normal * 1.1) / 1.3) < 1e-9);
});

test("validarConfig solo acepta las velocidades de Ajustes", () => {
  for (const velocidad of Object.values(VELOCIDADES)) assert.deepEqual(validarConfig({ ...BASE, velocidad }), []);
  assert.deepEqual(validarConfig(BASE), [], "sin velocidad vale la de por defecto");
  assert.equal(validarConfig({ ...BASE, velocidad: 2 }).length, 1);
});
