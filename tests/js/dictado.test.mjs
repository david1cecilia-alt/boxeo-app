import assert from "node:assert/strict";
import { test } from "node:test";

import { MARGEN_VOZ, crearDictado } from "../../static/dictado.js";
import { segundosHabla } from "../../static/motor/ritmo.js";
import { crearReproductor } from "../../static/reproductor.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

const PASO = 100; // ms entre tics, como en la app
const TOLERANCIA = 0.11;
const vaciar = () => new Promise((ok) => setImmediate(ok));

// Voz de mentira: apunta qué se dice y cuándo; el test decide si llega onend, onerror o nada.
function montar({ pausa = 1.0, ritmo = 3, velocidad, combos = [], coletillas = [], reservados = [], fin = 180 } = {}) {
  let ms = 0;
  const reproductor = crearReproductor([], { alLanzar: () => {}, reloj: () => ms });
  const dichos = [];
  const voz = {
    decir(texto) {
      return new Promise((ok) => dichos.push({ texto, en: reproductor.tiempo(), onend: () => ok("fin"), onerror: () => ok("error") }));
    },
    callar() {},
  };
  const dictado = crearDictado({ reproductor, voz, config: { ritmo, pausa, velocidad } });
  async function hasta(segundo) {
    while (reproductor.tiempo() < segundo - 1e-9) {
      ms += PASO;
      reproductor.tic();
      await vaciar();
    }
  }
  if (combos.length) dictado.asalto({ cola: combos, coletillas, reservados, desde: combos[0].t, fin });
  return { reproductor, dictado, dichos, hasta, real: (n) => (ms += n) };
}

// Dos combinaciones: "jab, recto" y otra. Se golpea mientras se oye: tras la voz solo va el hueco
// (el que sorteó el guion para cada una).
const PAUSA = 1.0;
const COMBOS = [
  { t: 3, asalto: 1, duracion: 3.0, texto: "jab, recto", ids: ["jab", "directo"], hueco: PAUSA },
  { t: 99, asalto: 1, duracion: 3.0, texto: "uno, dos", ids: ["jab", "directo"], hueco: PAUSA },
];

const cerca = (real, esperado) => assert.ok(Math.abs(real - esperado) <= TOLERANCIA, `${real} vs ${esperado}`);

test("con onend: la pausa empieza cuando la voz termina, no a la hora prevista", async () => {
  const { dichos, hasta } = montar({ combos: COMBOS });
  await hasta(3.05);
  assert.equal(dichos.length, 1);
  cerca(dichos[0].en, 3);
  await hasta(6.5); // la voz tarda más de lo estimado (2,0 s)…
  assert.equal(dichos.length, 1, "no empieza otra mientras habla");
  dichos[0].onend();
  await hasta(6.5 + PAUSA + 0.2);
  assert.equal(dichos.length, 2);
  cerca(dichos[1].en, 6.5 + PAUSA);
});

test("sin onend: deja de esperar en la estimación + 3 s", async () => {
  const { dichos, hasta } = montar({ combos: COMBOS });
  const maximo = segundosHabla("jab, recto") + MARGEN_VOZ;
  await hasta(3 + maximo - 0.2);
  assert.equal(dichos.length, 1);
  await hasta(3 + maximo + PAUSA + 0.2);
  assert.equal(dichos.length, 2);
  cerca(dichos[1].en, 3 + maximo + PAUSA);
});

test("sin onend: el tope escala con la velocidad de la voz", async () => {
  for (const velocidad of [0.9, 1.3]) {
    const { dichos, hasta } = montar({ combos: COMBOS, velocidad });
    const maximo = segundosHabla("jab, recto", velocidad) + MARGEN_VOZ;
    assert.notEqual(maximo, segundosHabla("jab, recto") + MARGEN_VOZ);
    await hasta(3 + maximo - 0.2);
    assert.equal(dichos.length, 1, `a ${velocidad} aún espera`);
    await hasta(3 + maximo + PAUSA + 0.2);
    assert.equal(dichos.length, 2, `a ${velocidad} ya sigue`);
    cerca(dichos[1].en, 3 + maximo + PAUSA);
  }
});

test("con onerror: cuenta como terminada", async () => {
  const { dichos, hasta } = montar({ combos: COMBOS });
  await hasta(4);
  dichos[0].onerror();
  await hasta(4 + PAUSA + 0.2);
  assert.equal(dichos.length, 2);
  cerca(dichos[1].en, 4 + PAUSA);
});

test("el tope sin onend también se congela en la pausa", async () => {
  const { dichos, hasta, reproductor, real } = montar({ combos: COMBOS });
  await hasta(3.5);
  reproductor.pausar();
  real(60_000); // un minuto en pausa
  reproductor.reanudar();
  const maximo = segundosHabla("jab, recto") + MARGEN_VOZ;
  await hasta(3 + maximo + PAUSA + 0.2);
  assert.equal(dichos.length, 2);
  cerca(dichos[1].en, 3 + maximo + PAUSA);
});

test("tras una señal, la combinación espera a que se calle y al tiempo para reaccionar", async () => {
  const { dichos, dictado, hasta } = montar();
  await hasta(2.5);
  dictado.senal("¡esquiva!", 1.0);
  dictado.asalto({ cola: COMBOS, reservados: [], desde: 3, fin: 180 });
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
  dictado.asalto({ cola: COMBOS, reservados: [], desde: 3, fin: 180 });
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

test("el hueco es el del guion, no uno sorteado otra vez", async () => {
  const combos = [{ ...COMBOS[0], hueco: 2.5 }, COMBOS[1]];
  const { dichos, hasta } = montar({ pausa: null, ritmo: 5, combos }); // Intenso sortearía 1 s
  await hasta(4);
  dichos[0].onend();
  await hasta(4 + 2.3);
  assert.equal(dichos.length, 1);
  await hasta(4 + 2.7);
  assert.equal(dichos.length, 2);
  cerca(dichos[1].en, 4 + 2.5);
});

test("si la voz va rápida y se acaban las del guion, sigue con las reservas en su orden", async () => {
  const reservas = [
    { t: 180, asalto: 1, duracion: 3.0, texto: "reserva uno", ids: ["jab", "gancho_izq"], hueco: PAUSA, tipo: "reserva" },
    { t: 180, asalto: 1, duracion: 3.0, texto: "reserva dos", ids: ["directo", "gancho_izq"], hueco: PAUSA, tipo: "reserva" },
  ];
  const { dichos, hasta } = montar({ combos: [...COMBOS, ...reservas] });
  for (let k = 0; k < 4; k++) {
    await hasta(3 + k * 2 + 1);
    dichos[k].onend(); // cada una dura 1 s de verdad, aunque se estimen 3
  }
  assert.deepEqual(dichos.map((d) => d.texto), ["jab, recto", "uno, dos", "reserva uno", "reserva dos"]);
});

test("al final, si no cabe la siguiente, dice una coletilla que quepa y que no sea reciente", async () => {
  const larga = { t: 3, asalto: 1, duracion: 6.0, texto: "larga", ids: ["jab", "directo", "gancho_izq"], hueco: PAUSA };
  const coletillas = [
    { t: 20, asalto: 1, duracion: 2.0, texto: "reciente", ids: ["jab", "directo", "gancho_izq"], hueco: PAUSA, tipo: "coletilla" },
    { t: 20, asalto: 1, duracion: 4.5, texto: "no cabe", ids: ["jab", "jab"], hueco: PAUSA, tipo: "coletilla" },
    { t: 20, asalto: 1, duracion: 2.0, texto: "corta", ids: ["directo", "jab"], hueco: PAUSA, tipo: "coletilla" },
  ];
  const { dichos, hasta } = montar({ combos: [larga], coletillas, fin: 9 });
  await hasta(4);
  dichos[0].onend(); // a las 5 no queda ninguna del nivel: «no cabe» acabaría en 9,5 y «reciente» lo es
  await hasta(6);
  dichos[1].onend();
  await hasta(9);
  assert.deepEqual(dichos.map((d) => d.texto), ["larga", "corta"]);
});
