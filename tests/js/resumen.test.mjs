import assert from "node:assert/strict";
import { test } from "node:test";

import { lunes, minutosDeAsalto, moverPeriodo, porPeriodo, porSemana, textoMinutos, tituloGrupo, totales } from "../../static/vistas/resumen.js";

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

// ---- Gráfico por meses y años ----

test("asaltos y RPE medio por mes: los últimos 12, el más antiguo primero", () => {
  const meses = porPeriodo(sesiones, valoraciones, "mes", { hoy: HOY });
  assert.equal(meses.length, 12);
  assert.deepEqual(meses[0].inicio, new Date(2025, 10, 1));
  assert.deepEqual(meses.at(-1), { inicio: new Date(2026, 9, 1), asaltos: 9, sesiones: 3, rpe: 7.5 });
  assert.deepEqual(meses.at(-2), { inicio: new Date(2026, 8, 1), asaltos: 6, sesiones: 1, rpe: null });
  assert.equal(meses[2].asaltos, 1); // enero
});

test("por año: del primero con sesiones al actual, al menos 3 y como mucho 10", () => {
  const anos = porPeriodo(sesiones, valoraciones, "ano", { hoy: HOY });
  assert.deepEqual(anos.map((a) => a.inicio.getFullYear()), [2024, 2025, 2026]);
  assert.equal(anos.at(-1).asaltos, 16);
  const antigua = [{ clave: "x", fecha: "2001-05-01T10:00:00", asaltos: 1 }];
  assert.equal(porPeriodo(antigua, {}, "ano", { hoy: HOY }).length, 10);
  const desde2020 = [{ clave: "x", fecha: "2020-05-01T10:00:00", asaltos: 1 }];
  assert.deepEqual(porPeriodo(desde2020, {}, "ano", { hoy: HOY })[0], { inicio: new Date(2020, 0, 1), asaltos: 1, sesiones: 1, rpe: null });
});

test("mover un periodo adelante o atrás", () => {
  assert.deepEqual(moverPeriodo(new Date(2026, 9, 26), "semana", -1), new Date(2026, 9, 19));
  assert.deepEqual(moverPeriodo(new Date(2026, 0, 1), "mes", -1), new Date(2025, 11, 1));
  assert.deepEqual(moverPeriodo(new Date(2026, 0, 1), "ano", 2), new Date(2028, 0, 1));
});

test("los minutos son solo de asalto: asaltos completados × duración, sin descansos", () => {
  assert.equal(minutosDeAsalto([{ asaltos: 3, duracion_asalto: 180 }]), 9);
  assert.equal(minutosDeAsalto([{ asaltos: 2, duracion_asalto: 120 }, { asaltos: 4, duracion_asalto: 180 }]), 16);
  assert.equal(minutosDeAsalto([{ asaltos: 1, duracion_asalto: 90 }]), 2); // 1,5 se redondea
  assert.equal(minutosDeAsalto([]), 0);
});

test("títulos de los periodos y minutos en texto", () => {
  assert.equal(tituloGrupo(new Date(2026, 9, 26), "semana", HOY), "Semana del 26 oct");
  assert.equal(tituloGrupo(new Date(2025, 11, 29), "semana", HOY), "Semana del 29 dic 2025");
  assert.equal(tituloGrupo(new Date(2026, 9, 1), "mes", HOY), "Octubre 2026");
  assert.equal(tituloGrupo(new Date(2025, 0, 1), "ano", HOY), "2025");
  assert.equal(textoMinutos(54), "54 min");
  assert.equal(textoMinutos(120), "2 h");
  assert.equal(textoMinutos(192), "3 h 12 min");
  assert.equal(textoMinutos(0), "0 min");
});
