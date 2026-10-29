import assert from "node:assert/strict";
import { test } from "node:test";

import { perfilPorDefecto } from "../../static/almacen.js";
import { nuevoGuion, perfilGenerador, preferencias } from "../../static/ajustes.js";
import { accionesPorIds } from "../../static/motor/acciones.js";
import { crearAzar } from "../../static/motor/azar.js";
import { ultimoGolpe } from "../../static/motor/reglas.js";
import { cargarDatosDeDisco } from "./datos.mjs";

const datos = cargarDatosDeDisco();
// Sesión larga (12 × 10 min): unas 1.000 combinaciones por guion. En nivel 3 (40 % con defensa):
// en básico solo el 15 % lleva defensa y el peso del bloqueo apenas tendría margen.
const CONFIG = { asaltos: 12, duracion_asalto: 600, descanso: 60, nivel: 3, zurdo: false, modo_reaccion: false, pausa: 0 };

function perfilCon(pesos) {
  return { ...perfilPorDefecto(), pesos };
}

// Proporción de combinaciones del guion que cumplen la condición (sobre las acciones ortodoxas).
function proporcion(perfilUsuario, condicion, semilla = 3) {
  const combos = nuevoGuion(CONFIG, perfilUsuario, crearAzar(semilla))
    .filter((e) => e.tipo === "combo").map((e) => accionesPorIds(e.ids));
  assert.ok(combos.length > 800, `solo ${combos.length} combinaciones`);
  return combos.filter(condicion).length / combos.length;
}

const terminaEnGancho = (c) => ultimoGolpe(c)?.familia === "gancho";
const bloquea = (c) => c.some((a) => a.familia === "bloqueo");
const empiezaConJab = (c) => c[0].id === "jab";
const NEUTRO = { termina_en_gancho: 1, bloquear_y_devolver: 1, entrada_con_jab: 1 };

test("sin pesos propios se usan los de data/perfil.json", () => {
  assert.equal(perfilGenerador(perfilPorDefecto()), datos.perfil);
});

test("los pesos del perfil sustituyen a los de data/perfil.json (no se mezclan)", () => {
  const pesos = { termina_en_gancho: 1.2, bloquear_y_devolver: 0.5, entrada_con_jab: 3 };
  const perfil = perfilGenerador(perfilCon(pesos));
  assert.deepEqual(perfil.pesos, pesos);
  assert.equal(perfil.proporcion_clasicos, datos.perfil.proporcion_clasicos);
});

for (const [peso, condicion] of [
  ["termina_en_gancho", terminaEnGancho],
  ["bloquear_y_devolver", bloquea],
  ["entrada_con_jab", empiezaConJab],
]) {
  test(`subir «${peso}» en el perfil hace más frecuentes esas combinaciones en el guion`, () => {
    const bajo = proporcion(perfilCon({ ...NEUTRO, [peso]: 0.5 }), condicion);
    const neutro = proporcion(perfilCon(NEUTRO), condicion);
    const alto = proporcion(perfilCon({ ...NEUTRO, [peso]: 4 }), condicion);
    assert.ok(bajo < neutro && neutro < alto, `${peso}: ${bajo.toFixed(2)} < ${neutro.toFixed(2)} < ${alto.toFixed(2)}`);
    assert.ok(alto - bajo > 0.1, `${peso}: la diferencia es solo de ${(alto - bajo).toFixed(2)}`);
  });
}

test("nivel y guardia del perfil se proponen al entrenar; «No lo sé» usa data/perfil.json", () => {
  const p = perfilPorDefecto();
  assert.deepEqual(preferencias(p), { nivel: datos.perfil.nivel, zurdo: datos.perfil.guardia === "zurda" });
  p.basicos = { ...p.basicos, nivel: "3", guardia: "zurda" };
  assert.deepEqual(preferencias(p), { nivel: 3, zurdo: true });
});
