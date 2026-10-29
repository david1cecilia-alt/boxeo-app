import assert from "node:assert/strict";
import { test } from "node:test";

import { MARGEN_VOZ, crearDictado } from "../../static/dictado.js";
import { crearAzar } from "../../static/motor/azar.js";
import { segundosHabla } from "../../static/motor/ritmo.js";
import { crearReproductor } from "../../static/reproductor.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

const PASO = 100; // ms entre tics, como en la app
const TOLERANCIA = 0.11;
const vaciar = () => new Promise((ok) => setImmediate(ok));

// Voz de mentira: apunta qué se dice y cuándo; el test decide si llega onend, onerror o nada.
function montar({ pausa = 1.0, combos = [], reservados = [], fin = 180 } = {}) {
  let ms = 0;
  const reproductor = crearReproductor([], { alLanzar: () => {}, reloj: () => ms });
  const dichos = [];
  const voz = {
    decir(texto) {
      return new Promise((ok) => dichos.push({ texto, en: reproductor.tiempo(), onend: () => ok("fin"), onerror: () => ok("error") }));
    },
    callar() {},
  };
  const dictado = crearDictado({ reproductor, voz, config: { ritmo: 3, pausa }, azar: crearAzar(1) });
  async function hasta(segundo) {
    while (reproductor.tiempo() < segundo - 1e-9) {
      ms += PASO;
      reproductor.tic();
      await vaciar();
    }
  }
  if (combos.length) dictado.asalto({ combos, reservados, fin });
  return { reproductor, dictado, dichos, hasta, real: (n) => (ms += n) };
}

// Dos combinaciones: "jab, recto" (ejecución 0,5 + 0,5 s) y otra.
const COMBOS = [
  { t: 3, asalto: 1, duracion: 3.0, texto: "jab, recto", ids: ["jab", "directo"] },
  { t: 99, asalto: 1, duracion: 3.0, texto: "uno, dos", ids: ["jab", "directo"] },
];
const EJECUCION = 1.0;
const PAUSA = 1.0;

const cerca = (real, esperado) => assert.ok(Math.abs(real - esperado) <= TOLERANCIA, `${real} vs ${esperado}`);

test("con onend: la pausa empieza cuando la voz termina, no a la hora prevista", async () => {
  const { dichos, hasta } = montar({ combos: COMBOS });
  await hasta(3.05);
  assert.equal(dichos.length, 1);
  cerca(dichos[0].en, 3);
  await hasta(6.5); // la voz tarda más de lo estimado (2,0 s)…
  assert.equal(dichos.length, 1, "no empieza otra mientras habla");
  dichos[0].onend();
  await hasta(6.5 + EJECUCION + PAUSA + 0.2);
  assert.equal(dichos.length, 2);
  cerca(dichos[1].en, 6.5 + EJECUCION + PAUSA);
});

test("sin onend: deja de esperar en la estimación + 3 s", async () => {
  const { dichos, hasta } = montar({ combos: COMBOS });
  const maximo = segundosHabla("jab, recto") + MARGEN_VOZ;
  await hasta(3 + maximo - 0.2);
  assert.equal(dichos.length, 1);
  await hasta(3 + maximo + EJECUCION + PAUSA + 0.2);
  assert.equal(dichos.length, 2);
  cerca(dichos[1].en, 3 + maximo + EJECUCION + PAUSA);
});

test("con onerror: cuenta como terminada", async () => {
  const { dichos, hasta } = montar({ combos: COMBOS });
  await hasta(4);
  dichos[0].onerror();
  await hasta(4 + EJECUCION + PAUSA + 0.2);
  assert.equal(dichos.length, 2);
  cerca(dichos[1].en, 4 + EJECUCION + PAUSA);
});

test("el tope sin onend también se congela en la pausa", async () => {
  const { dichos, hasta, reproductor, real } = montar({ combos: COMBOS });
  await hasta(3.5);
  reproductor.pausar();
  real(60_000); // un minuto en pausa
  reproductor.reanudar();
  const maximo = segundosHabla("jab, recto") + MARGEN_VOZ;
  await hasta(3 + maximo + EJECUCION + PAUSA + 0.2);
  assert.equal(dichos.length, 2);
  cerca(dichos[1].en, 3 + maximo + EJECUCION + PAUSA);
});

test("tras una señal, la combinación espera a que se calle y al tiempo para reaccionar", async () => {
  const { dichos, dictado, hasta } = montar();
  await hasta(2.5);
  dictado.senal("¡esquiva!", 1.0);
  dictado.asalto({ combos: COMBOS, reservados: [], fin: 180 });
  await hasta(5);
  assert.deepEqual(dichos.map((d) => d.texto), ["¡esquiva!"]);
  dichos[0].onend();
  await hasta(5.9);
  assert.equal(dichos.length, 1);
  await hasta(6.2);
  assert.equal(dichos[1].texto, "jab, recto");
  cerca(dichos[1].en, 6);
});

test("tras el aviso, la combinación espera a que se calle (también si onend no llega)", async () => {
  const { dichos, dictado, hasta } = montar();
  await hasta(2.9);
  dictado.senal("diez segundos");
  dictado.asalto({ combos: COMBOS, reservados: [], fin: 180 });
  const maximo = segundosHabla("diez segundos") + MARGEN_VOZ;
  await hasta(2.9 + maximo - 0.2);
  assert.equal(dichos.length, 1);
  await hasta(2.9 + maximo + 0.2);
  assert.equal(dichos.length, 2);
});

test("no empieza una combinación que pisaría una señal prevista, ni si ya no cabe en el asalto", async () => {
  const pisa = montar({ combos: COMBOS, reservados: [[5, 6.5]] });
  await pisa.hasta(6.9);
  assert.equal(pisa.dichos.length, 0);
  await pisa.hasta(7.1);
  cerca(pisa.dichos[0].en, 7);

  const corto = montar({ combos: COMBOS, fin: 5.5 });
  await corto.hasta(10);
  assert.equal(corto.dichos.length, 0);
});

test("al cortar (fin del asalto o parar) no se dicta nada más", async () => {
  const { dichos, dictado, hasta } = montar({ combos: COMBOS });
  await hasta(3.5);
  dictado.cortar();
  dichos[0].onend();
  await hasta(20);
  assert.equal(dichos.length, 1);
});
