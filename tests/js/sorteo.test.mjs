import assert from "node:assert/strict";
import { test } from "node:test";

import { biblioteca } from "../../static/motor/acciones.js";
import { crearAzar } from "../../static/motor/azar.js";
import { SIN_REPETIR, SorteoBiblioteca, identidad } from "../../static/motor/sorteo.js";
import { cargarDatosDeDisco } from "./datos.mjs";

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
