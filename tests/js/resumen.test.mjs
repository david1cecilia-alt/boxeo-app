import assert from "node:assert/strict";
import { test } from "node:test";

import { lunes, porSemana, totales } from "../../static/vistas/resumen.js";

const HOY = new Date(2026, 9, 28, 18, 0); // miércoles 28 de octubre de 2026
const sesiones = [
  { clave: "local:a", fecha: "2026-10-26T09:00:00", asaltos: 3 }, // lunes de esta semana
  { clave: "local:b", fecha: "2026-10-28T08:00:00", asaltos: 2 }, // hoy
  { clave: "local:c", fecha: "2026-10-25T20:00:00", asaltos: 4 }, // domingo: semana anterior
  { clave: "local:d", fecha: "2026-09-30T20:00:00", asaltos: 6 }, // otro mes
  { clave: "local:e", fecha: "2026-01-01T10:00:00", asaltos: 1 }, // fuera de las 8 semanas
];
const valoraciones = { "local:a": { rpe: 6 }, "local:b": { rpe: 9 }, "local:c": { rpe: null } };

test("la semana empieza el lunes", () => {
  assert.deepEqual(lunes(HOY), new Date(2026, 9, 26));
  assert.deepEqual(lunes(new Date(2026, 9, 25, 23, 59)), new Date(2026, 9, 19));
});

test("totales de esta semana y de este mes, con el RPE medio de las valoradas", () => {
  assert.deepEqual(totales(sesiones, valoraciones, HOY), {
    semana: { sesiones: 2, asaltos: 5, rpe: 7.5 },
    mes: { sesiones: 3, asaltos: 9, rpe: 7.5 }, // la sin RPE no cuenta
  });
  assert.equal(totales(sesiones, {}, HOY).mes.rpe, null);
});

test("asaltos y RPE medio por semana, la más antigua primero", () => {
  const semanas = porSemana(sesiones, valoraciones, { hoy: HOY, n: 8 });
  assert.equal(semanas.length, 8);
  assert.deepEqual(semanas.at(-1), { inicio: new Date(2026, 9, 26), asaltos: 5, sesiones: 2, rpe: 7.5 });
  assert.deepEqual(semanas.at(-2), { inicio: new Date(2026, 9, 19), asaltos: 4, sesiones: 1, rpe: null });
  assert.equal(semanas.reduce((n, s) => n + s.asaltos, 0), 15); // la de enero no entra
});
