import assert from "node:assert/strict";
import { test } from "node:test";

import {
  alCambiarDeNivel, diaDeLaVista, diasDeSemana, escribirRuta, isoDia, leerRuta, mesesDelAno, rutaDeArriba, rutaDelDia,
  semanaDeLaVista, semanasDelMes, vecinos,
} from "../../static/vistas/galeria.js";

const HOY = new Date(2026, 9, 28, 18, 0); // miércoles 28 de octubre de 2026
const sesiones = [ // como las da el historial: la más reciente primero
  { clave: "local:a", fecha: "2026-10-28T19:00:00", asaltos: 3, duracion_asalto: 180 },
  { clave: "local:b", fecha: "2026-10-28T08:00:00", asaltos: 2, duracion_asalto: 120 },
  { clave: "local:c", fecha: "2026-10-26T09:00:00", asaltos: 4, duracion_asalto: 180 }, // lunes
  { clave: "local:d", fecha: "2026-10-01T20:00:00", asaltos: 6, duracion_asalto: 180 }, // jueves 1 oct
  { clave: "local:e", fecha: "2026-09-30T20:00:00", asaltos: 1, duracion_asalto: 180 }, // miércoles 30 sept
  { clave: "servidor:7", fecha: "2025-12-31T10:00:00", asaltos: 2, duracion_asalto: 180 },
];

test("las rutas se leen y se escriben", () => {
  assert.deepEqual(leerRuta("semana/2026-10-28", "semana", HOY), { nivel: "semana", inicio: new Date(2026, 9, 26) });
  assert.deepEqual(leerRuta("dia/2026-10-28", "semana", HOY), { nivel: "dia", inicio: new Date(2026, 9, 28) });
  assert.deepEqual(leerRuta("mes/2026-09", "semana", HOY), { nivel: "mes", inicio: new Date(2026, 8, 1) });
  assert.deepEqual(leerRuta("ano/2025", "semana", HOY), { nivel: "ano", inicio: new Date(2025, 0, 1) });
  assert.deepEqual(leerRuta("local:abc-1", "semana", HOY), { nivel: "sesion", clave: "local:abc-1" });
  for (const [nivel, fecha, ruta] of [["semana", new Date(2026, 9, 28), "semana/2026-10-26"], ["dia", new Date(2026, 9, 2), "dia/2026-10-02"],
    ["mes", new Date(2026, 0, 15), "mes/2026-01"], ["ano", new Date(2026, 5, 1), "ano/2026"]]) {
    assert.equal(escribirRuta(nivel, fecha), ruta);
  }
  assert.equal(isoDia(new Date(2026, 2, 5)), "2026-03-05");
});

test("sin ruta, o si no se entiende, se ve el periodo actual del nivel elegido", () => {
  assert.deepEqual(leerRuta("", "semana", HOY), { nivel: "semana", inicio: new Date(2026, 9, 26) });
  assert.deepEqual(leerRuta("", "mes", HOY), { nivel: "mes", inicio: new Date(2026, 9, 1) });
  assert.deepEqual(leerRuta("", "ano", HOY), { nivel: "ano", inicio: new Date(2026, 0, 1) });
  assert.deepEqual(leerRuta("", "otra", HOY), { nivel: "semana", inicio: new Date(2026, 9, 26) });
  for (const mala of ["semana/2026-02-31", "mes/2026-13", "ano/26", "dia/ayer", "semana/2026-10-26/x"]) {
    assert.deepEqual(leerRuta(mala, "mes", HOY), { nivel: "mes", inicio: new Date(2026, 9, 1) }, mala);
  }
});

test("la semana tiene siempre sus 7 días, de lunes a domingo, con sus sesiones", () => {
  const dias = diasDeSemana(sesiones, new Date(2026, 9, 28), HOY);
  assert.equal(dias.length, 7);
  assert.deepEqual(dias[0].fecha, new Date(2026, 9, 26));
  assert.deepEqual(dias[6].fecha, new Date(2026, 10, 1));
  assert.deepEqual(dias.map((d) => d.sesiones.length), [1, 0, 2, 0, 0, 0, 0]);
  assert.deepEqual(dias[2].sesiones.map((s) => s.clave), ["local:a", "local:b"]); // conserva el orden
  assert.deepEqual(dias.map((d) => d.hoy), [false, false, true, false, false, false, false]);
  assert.deepEqual(dias.map((d) => d.futuro), [false, false, false, true, true, true, true]);
  assert.equal(diasDeSemana([], new Date(2020, 0, 1), HOY).length, 7);
});

test("pulsar un día lleva a sus sesiones, o directamente al detalle si solo hay una", () => {
  const dias = diasDeSemana(sesiones, new Date(2026, 9, 26), HOY);
  assert.equal(rutaDelDia(dias[0]), "local:c");
  assert.equal(rutaDelDia(dias[2]), "dia/2026-10-28");
  assert.equal(rutaDelDia(dias[1]), null);
});

test("el mes son las semanas que lo tocan, con las sesiones y minutos de toda la semana", () => {
  const semanas = semanasDelMes(sesiones, new Date(2026, 9, 1), HOY);
  assert.deepEqual(semanas.map((s) => isoDia(s.inicio)), ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.deepEqual(semanas[0].fin, new Date(2026, 9, 4));
  assert.deepEqual(semanas[0].sesiones.map((s) => s.clave), ["local:d", "local:e"]); // el 30 sept también
  assert.equal(semanas[0].minutos, 21);
  assert.deepEqual(semanas.map((s) => s.actual), [false, false, false, false, true]);
  assert.equal(semanas.at(-1).minutos, 9 + 4 + 12);
  // Agosto de 2026 empieza en sábado y acaba en lunes: toca 6 semanas.
  assert.equal(semanasDelMes([], new Date(2026, 7, 1), HOY).length, 6);
  assert.equal(semanasDelMes([], new Date(2021, 1, 1), HOY).length, 4); // febrero de 2021: 4 justas
  assert.ok(semanasDelMes([], new Date(2026, 10, 1), HOY).slice(1).every((s) => s.futuro));
});

test("el año son sus 12 meses con sus sesiones y minutos", () => {
  const meses = mesesDelAno(sesiones, new Date(2026, 0, 1), HOY);
  assert.equal(meses.length, 12);
  assert.deepEqual(meses.map((m) => m.sesiones.length), [0, 0, 0, 0, 0, 0, 0, 0, 1, 4, 0, 0]);
  assert.equal(meses[9].minutos, 9 + 4 + 12 + 18);
  assert.deepEqual(meses.map((m) => m.actual).indexOf(true), 9);
  assert.deepEqual(meses.map((m) => m.futuro), [...Array(10).fill(false), true, true]);
});

test("las flechas van de la sesión más antigua al periodo actual", () => {
  assert.deepEqual(vecinos(sesiones, "semana", new Date(2026, 9, 26), HOY),
    { anterior: new Date(2026, 9, 19), siguiente: null });
  assert.deepEqual(vecinos(sesiones, "semana", new Date(2025, 11, 29), HOY),
    { anterior: null, siguiente: new Date(2026, 0, 5) });
  assert.deepEqual(vecinos(sesiones, "mes", new Date(2026, 0, 1), HOY),
    { anterior: new Date(2025, 11, 1), siguiente: new Date(2026, 1, 1) });
  assert.deepEqual(vecinos(sesiones, "ano", new Date(2026, 0, 1), HOY), { anterior: new Date(2025, 0, 1), siguiente: null });
  assert.deepEqual(vecinos(sesiones, "dia", new Date(2026, 9, 28), HOY).siguiente, null); // el día se mueve por semanas
  assert.deepEqual(vecinos([], "mes", new Date(2026, 9, 1), HOY), { anterior: null, siguiente: null });
});

test("el selector Semana / Mes / Año va al periodo actual o al que contiene el que se ve", () => {
  const actual = { nivel: "semana", inicio: new Date(2026, 9, 26) };
  assert.equal(alCambiarDeNivel(actual, "mes", HOY), "mes/2026-10");
  assert.equal(alCambiarDeNivel(actual, "ano", HOY), "ano/2026");
  assert.equal(alCambiarDeNivel({ nivel: "mes", inicio: new Date(2026, 9, 1) }, "semana", HOY), "semana/2026-10-26");
  assert.equal(alCambiarDeNivel({ nivel: "mes", inicio: new Date(2026, 8, 1) }, "semana", HOY), "semana/2026-08-31");
  assert.equal(alCambiarDeNivel({ nivel: "semana", inicio: new Date(2025, 11, 29) }, "ano", HOY), "ano/2025");
  assert.equal(alCambiarDeNivel({ nivel: "ano", inicio: new Date(2025, 0, 1) }, "mes", HOY), "mes/2025-01");
  assert.equal(alCambiarDeNivel({ nivel: "dia", inicio: new Date(2026, 9, 28) }, "mes", HOY), "mes/2026-10");
});

test("volver sube un nivel: detalle → día → semana", () => {
  assert.equal(rutaDeArriba({ nivel: "sesion", clave: "local:a" }, sesiones), "dia/2026-10-28");
  assert.equal(rutaDeArriba({ nivel: "sesion", clave: "local:c" }, sesiones), "semana/2026-10-26"); // sola ese día
  assert.equal(rutaDeArriba({ nivel: "dia", inicio: new Date(2026, 9, 28) }, sesiones), "semana/2026-10-26");
  assert.equal(rutaDeArriba({ nivel: "sesion", clave: "local:no-existe" }, sesiones), "");
  assert.equal(rutaDeArriba({ nivel: "semana", inicio: new Date(2026, 9, 26) }, sesiones), null);
});

test("en un día o un detalle se pinta su semana con su día abierto", () => {
  const vista = { nivel: "sesion", clave: "local:d" };
  assert.deepEqual(semanaDeLaVista(vista, sesiones), new Date(2026, 8, 28));
  assert.deepEqual(diaDeLaVista(vista, sesiones), new Date(2026, 9, 1));
  assert.deepEqual(semanaDeLaVista({ nivel: "dia", inicio: new Date(2026, 9, 28) }, sesiones), new Date(2026, 9, 26));
  assert.equal(diaDeLaVista({ nivel: "semana", inicio: new Date(2026, 9, 26) }, sesiones), null);
  assert.equal(semanaDeLaVista({ nivel: "sesion", clave: "local:x" }, sesiones), null);
});
