import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { biblioteca, espejoCombo, numero, textoHablado } from "../../static/motor/acciones.js";
import { crearAzar } from "../../static/motor/azar.js";
import {
  MEZCLAS, MIN_SOLO_PROPIAS, PROBABILIDAD_PROPIAS, SIN_REPETIR, SorteoBiblioteca, SorteoMezcla, cargarPerfil, identidad,
  mezclaEfectiva, propiasValidas,
} from "../../static/motor/sorteo.js";
import { cargarDatosDeDisco } from "./datos.mjs";
import { FIJOS, casos } from "./igual_que_antes.mjs";

cargarDatosDeDisco();

// La biblioteca con cada combinación dos veces: la copia, con otro número.
const duplicada = (combos) => [...combos, ...combos.map((c) => ({ ...c, n: c.n + 1000 }))];

test("cada combinación de la biblioteca se identifica por su número, que no se repite", () => {
  const numeros = biblioteca().map(identidad);
  assert.equal(new Set(numeros).size, biblioteca().length);
  assert.ok(numeros.every(Number.isInteger));
});

test("la ventana distingue dos combinaciones iguales por su número", () => {
  const jabRecto = biblioteca().find((c) => c.nivel === 1);
  const s = new SorteoBiblioteca(1, { azar: crearAzar(0) });
  s.combos = duplicada([jabRecto]);
  const elegida = s.siguiente();
  assert.deepEqual(s.candidatas().map((c) => c.acciones), [elegida.acciones]); // la otra, aunque sea igual
});

test("con la biblioteca duplicada salen las dos copias sin repetir número en la ventana", () => {
  for (const nivel of [1, 2, 3]) {
    const s = new SorteoBiblioteca(nivel, { azar: crearAzar(nivel) });
    s.combos = duplicada(s.combos);
    const sacadas = Array.from({ length: 3000 }, () => (s.siguiente(), s.recientes.at(-1)));
    sacadas.forEach((n, i) => assert.ok(!sacadas.slice(Math.max(0, i - SIN_REPETIR), i).includes(n), `${nivel}: ${i}`));
    assert.equal(new Set(sacadas).size, s.combos.length);
  }
});

// ---------- Sorteo mezclado con las propias (port de tests/test_mezcla.py) ----------

const propia = (i, ids) => ({ id: `p-${i}`, ids, creada: "2026-11-04T10:00:00Z" });
const TODAS = [
  propia(1, ["jab", "jab", "directo"]), propia(2, ["esquiva_der", "gancho_izq"]),
  propia(3, ["directo_cuerpo", "gancho_izq", "salir", "bloqueo"]),
  propia(4, ["jab", "directo", "gancho_izq", "gancho_der", "uppercut_izq", "uppercut_der"]),
  propia(5, ["jab", "rodar_izq", "directo", "pivote", "jab"]),
  propia(6, ["jab", "directo", "esquiva_izq", "gancho_izq", "directo", "rodar_der", "gancho_der", "paso_atras"]),
];
const sortear = (nivel, { propias = TODAS, mezcla = "mucho", n = 5000, semilla = 0, zurdo = false } = {}) => {
  const s = new SorteoMezcla(nivel, { zurdo, azar: crearAzar(semilla), propias, mezcla });
  return Array.from({ length: n }, () => s.siguiente());
};

test("propiasValidas ignora las que no se pueden sortear y da su nivel", () => {
  const malas = [propia(10, ["jab"]), propia(11, Array(11).fill("jab")), propia(12, ["jab", "patada"]),
    { ids: ["jab", "directo"] }, { id: "p-13" }, { id: 14, ids: ["jab", "directo"] }, null];
  const validas = propiasValidas([...malas, ...TODAS.slice(0, 3), propia(15, Array(10).fill("jab"))]);
  assert.deepEqual(validas.map((p) => [p.id, p.nivel]), [["p-1", 1], ["p-2", 1], ["p-3", 1], ["p-15", 3]]);
  assert.deepEqual(propiasValidas(undefined), []);
});

test("mezclaEfectiva: sin propias del nivel o «solo» con menos de 3, como «ninguna»", () => {
  const validas = propiasValidas(TODAS);
  assert.deepEqual(MEZCLAS, ["ninguna", "poco", "bastante", "mucho", "solo"]);
  assert.equal(MIN_SOLO_PROPIAS, 3);
  assert.equal(mezclaEfectiva("poco", validas, 2), "poco");
  assert.equal(mezclaEfectiva("mucho", validas.slice(0, 3), 2), "ninguna");
  assert.equal(mezclaEfectiva("solo", validas.slice(0, 3), 3), "solo");
  assert.equal(mezclaEfectiva("solo", validas.slice(3, 5), 2), "ninguna");
  assert.equal(mezclaEfectiva("otra", validas, 1), "ninguna");
});

test("la proporción de propias es la de la mezcla y solo salen las del nivel", () => {
  for (const [mezcla, p] of Object.entries(PROBABILIDAD_PROPIAS)) {
    const propias = sortear(2, { mezcla, semilla: 7 }).filter((c) => c.origen === "propia");
    assert.ok(Math.abs(propias.length / 5000 - p) <= 0.03, `${mezcla}: ${propias.length}`);
    assert.deepEqual(new Set(propias.map((c) => c.acciones.length)), new Set([6, 5]));
  }
});

test("«Solo las mías» saca todas las propias, de cualquier nivel, y nunca las nombra", () => {
  const sacadas = sortear(3, { mezcla: "solo", n: 2000 });
  assert.ok(sacadas.every((c) => c.origen === "propia" && c.nombre === null && c.texto === textoHablado(c.acciones)));
  assert.equal(new Set(sacadas.map((c) => c.acciones.map((a) => a.id).join())).size, TODAS.length);
});

test("con «Ninguna» y propias sale exactamente lo de antes", () => {
  const crear = (nivel, zurdo, azar, practicar) =>
    new SorteoMezcla(nivel, { perfil: { ...cargarPerfil(), practicar }, zurdo, azar, propias: TODAS, mezcla: "ninguna" });
  assert.deepEqual(casos(crear), JSON.parse(readFileSync(FIJOS, "utf-8")).js);
});

test("la ventana de las propias es de mín(5, n − 1)", () => {
  for (const cuantas of [1, 2, 3, 6]) {
    const propias = Array.from({ length: cuantas }, (_, i) => propia(i, Array(2 + (i % 3)).fill("jab")));
    const s = new SorteoMezcla(1, { azar: crearAzar(cuantas), propias, mezcla: "mucho" });
    const deGrupo = [];
    for (let i = 0; i < 3000; i++) if (s.siguiente().origen === "propia") deGrupo.push(s.propias.recientes.at(-1) ?? "p-0");
    const k = Math.min(SIN_REPETIR, cuantas - 1);
    deGrupo.forEach((id, i) => assert.ok(!deGrupo.slice(Math.max(0, i - k), i).includes(id), `${cuantas}: ${i}`));
    assert.equal(new Set(deGrupo).size, cuantas);
  }
});

test("los golpes de las propias cuentan para la cobertura del 1 al 6", () => {
  const s = new SorteoMezcla(2, { azar: crearAzar(1), propias: [TODAS[3]], mezcla: "mucho" });
  while (s.siguiente().origen !== "propia");
  assert.equal(s.biblioteca.faltan.size, 0);
});

test("en zurdo la propia sale en espejo, con los mismos números", () => {
  const orto = sortear(2, { mezcla: "solo", n: 300, semilla: 8 });
  const zurdo = sortear(2, { mezcla: "solo", n: 300, semilla: 8, zurdo: true });
  orto.forEach((o, i) => {
    assert.deepEqual(zurdo[i].acciones, espejoCombo(o.acciones));
    assert.deepEqual(zurdo[i].acciones.map((a) => numero(a, true)), o.acciones.map((a) => numero(a)));
  });
});

test("coletillas: con la mezcla, las propias cortas entre las de la biblioteca; con «solo», delante", () => {
  const clave = (c) => c.acciones.map((a) => a.id).join();
  const deBiblioteca = new SorteoBiblioteca(1, { azar: crearAzar(0) }).coletillas().map(clave);
  const cortas = ["jab,jab,directo", "esquiva_der,gancho_izq"];
  const mezcla = new SorteoMezcla(2, { azar: crearAzar(0), propias: TODAS, mezcla: "mucho" }).coletillas();
  assert.equal(mezcla.length, deBiblioteca.length + cortas.length);
  assert.deepEqual(new Set(mezcla.map(clave)), new Set([...deBiblioteca, ...cortas]));
  const solo = new SorteoMezcla(2, { azar: crearAzar(0), propias: TODAS, mezcla: "solo" }).coletillas();
  assert.deepEqual(new Set(solo.slice(0, 2).map(clave)), new Set(cortas));
  assert.ok(solo.slice(0, 2).every((c) => c.origen === "propia" && c.nombre === null));
  assert.deepEqual(new Set(solo.slice(2).map(clave)), new Set(deBiblioteca));
  const sinCortas = new SorteoMezcla(2, { azar: crearAzar(0), propias: TODAS.slice(3), mezcla: "solo" }).coletillas();
  assert.ok(sinCortas.every((c) => c.origen === "biblioteca"));
  const primeras = Array.from({ length: 3000 }, (_, s) =>
    new SorteoMezcla(2, { azar: crearAzar(s), propias: TODAS, mezcla: "poco" }).coletillas()[0].origen);
  assert.ok(Math.abs(primeras.filter((o) => o === "propia").length / 3000 - PROBABILIDAD_PROPIAS.poco) <= 0.03);
});
