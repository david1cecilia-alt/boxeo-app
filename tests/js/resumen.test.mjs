import assert from "node:assert/strict";
import { test } from "node:test";

import { SEMANAS_POR_TANDA, agrupar, clavesAbiertas, lunes, porSemana, recortarSemanas, textoMinutos, tituloGrupo, totales } from "../../static/vistas/resumen.js";

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

// ---- Agrupación de la lista ----

const conDuracion = [
  { clave: "local:a", fecha: "2026-10-26T09:00:00", asaltos: 3, duracion_asalto: 180 }, // esta semana
  { clave: "local:b", fecha: "2026-10-20T08:00:00", asaltos: 2, duracion_asalto: 120 }, // semana anterior
  { clave: "local:c", fecha: "2026-10-19T20:00:00", asaltos: 4, duracion_asalto: 180 }, // misma semana
  { clave: "local:d", fecha: "2026-09-30T20:00:00", asaltos: 6, duracion_asalto: 180 }, // septiembre
  { clave: "local:e", fecha: "2025-12-29T10:00:00", asaltos: 1, duracion_asalto: 90 },  // 2025
];

test("agrupa por semana: la actual arriba y los periodos pasados vacíos no salen", () => {
  const grupos = agrupar(conDuracion, "semana", HOY);
  assert.deepEqual(grupos.map((g) => g.clave), ["2026-10-26", "2026-10-19", "2026-09-28", "2025-12-29"]);
  assert.deepEqual(grupos.map((g) => g.actual), [true, false, false, false]);
  assert.deepEqual(grupos[1].sesiones.map((s) => s.clave), ["local:b", "local:c"]); // conserva el orden
  assert.deepEqual(grupos[1].inicio, new Date(2026, 9, 19));
});

test("los minutos son solo de asalto: asaltos completados × duración, sin descansos", () => {
  const [actual, anterior] = agrupar(conDuracion, "semana", HOY);
  assert.equal(actual.minutos, 9);       // 3 × 3:00
  assert.equal(anterior.minutos, 16);    // 2 × 2:00 + 4 × 3:00
  assert.equal(agrupar([{ fecha: "2026-10-26T09:00:00", asaltos: 1, duracion_asalto: 90 }], "semana", HOY)[0].minutos, 2); // 1,5 se redondea
});

test("agrupa por mes y por año", () => {
  const meses = agrupar(conDuracion, "mes", HOY);
  assert.deepEqual(meses.map((g) => [g.clave, g.sesiones.length, g.minutos]),
    [["2026-10", 3, 25], ["2026-09", 1, 18], ["2025-12", 1, 2]]);
  const anos = agrupar(conDuracion, "ano", HOY);
  assert.deepEqual(anos.map((g) => [g.clave, g.sesiones.length]), [["2026", 4], ["2025", 1]]);
  assert.deepEqual(anos[0].inicio, new Date(2026, 0, 1));
});

test("el periodo actual sale aunque esté vacío, y sin sesiones solo sale él", () => {
  const grupos = agrupar(conDuracion.slice(1), "semana", HOY);
  assert.equal(grupos[0].actual, true);
  assert.deepEqual(grupos[0].sesiones, []);
  assert.equal(grupos[0].minutos, 0);
  assert.deepEqual(agrupar([], "mes", HOY).map((g) => g.clave), ["2026-10"]);
});

test("al abrir se despliega el actual y, si está vacío, también el más reciente con sesiones", () => {
  assert.deepEqual([...clavesAbiertas(agrupar(conDuracion, "semana", HOY))], ["2026-10-26"]);
  assert.deepEqual([...clavesAbiertas(agrupar(conDuracion.slice(1), "semana", HOY))], ["2026-10-26", "2026-10-19"]);
  assert.deepEqual([...clavesAbiertas(agrupar([], "semana", HOY))], ["2026-10-26"]);
});

test("títulos de los grupos y minutos en texto", () => {
  assert.equal(tituloGrupo(new Date(2026, 9, 26), "semana", HOY), "Semana del 26 oct");
  assert.equal(tituloGrupo(new Date(2025, 11, 29), "semana", HOY), "Semana del 29 dic 2025");
  assert.equal(tituloGrupo(new Date(2026, 9, 1), "mes", HOY), "Octubre 2026");
  assert.equal(tituloGrupo(new Date(2025, 0, 1), "ano", HOY), "2025");
  assert.equal(textoMinutos(54), "54 min");
  assert.equal(textoMinutos(120), "2 h");
  assert.equal(textoMinutos(192), "3 h 12 min");
  assert.equal(textoMinutos(0), "0 min");
});

// Una sesión por semana durante `n` semanas seguidas, empezando `desde` semanas antes de la actual.
function semanales(n, desde = 0) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(2026, 9, 26 - 7 * (desde + i), 19);
    return { clave: `local:${desde + i}`, fecha: d.toISOString(), asaltos: 3, duracion_asalto: 180 };
  });
}

test("por semana se ven las últimas 12 con sesiones y se pueden pedir 12 más", () => {
  assert.equal(SEMANAS_POR_TANDA, 12);
  const grupos = agrupar(semanales(30), "semana", HOY);
  const primera = recortarSemanas(grupos);
  assert.equal(primera.grupos.length, 12);
  assert.deepEqual([primera.limite, primera.quedan], [12, 18]);
  assert.equal(primera.grupos[0].actual, true);
  const segunda = recortarSemanas(grupos, primera.limite + SEMANAS_POR_TANDA);
  assert.deepEqual([segunda.grupos.length, segunda.quedan], [24, 6]);
  const tercera = recortarSemanas(grupos, 36);
  assert.deepEqual([tercera.grupos.length, tercera.quedan], [30, 0]);
});

test("la semana actual vacía sale siempre y no cuenta entre las 12", () => {
  const grupos = agrupar(semanales(20, 1), "semana", HOY); // nada esta semana
  const { grupos: vistos, quedan } = recortarSemanas(grupos);
  assert.equal(vistos.length, 13);
  assert.deepEqual([vistos[0].actual, vistos[0].sesiones.length], [true, 0]);
  assert.equal(quedan, 8);
});

test("si hay que enseñar una semana más antigua, el límite llega hasta ella sin dejar huecos", () => {
  const grupos = agrupar(semanales(30), "semana", HOY);
  const antigua = grupos[19].clave; // la 20.ª semana con sesiones
  const r = recortarSemanas(grupos, 12, antigua);
  assert.deepEqual([r.limite, r.grupos.length, r.quedan], [20, 20, 10]);
  assert.equal(r.grupos.at(-1).clave, antigua);
  assert.equal(recortarSemanas(grupos, 12, grupos[3].clave).limite, 12); // dentro de las 12: no cambia
  assert.equal(recortarSemanas(grupos, 12, "no-existe").limite, 12);
});

test("con pocas semanas no queda nada por ver", () => {
  const r = recortarSemanas(agrupar(semanales(5), "semana", HOY));
  assert.deepEqual([r.grupos.length, r.quedan], [5, 0]);
});
