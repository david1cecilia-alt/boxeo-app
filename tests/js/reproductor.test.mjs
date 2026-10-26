import assert from "node:assert/strict";
import { test } from "node:test";

import { crearAzar } from "../../static/motor/azar.js";
import { construirGuion } from "../../static/motor/temporizador.js";
import { crearReproductor } from "../../static/reproductor.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

const PASO = 100; // ms entre tics, como en app.js

// Reloj falso en milisegundos que solo avanza cuando el test lo dice.
function relojFalso() {
  let ms = 0;
  return { reloj: () => ms, avanzar: (n) => (ms += n) };
}

// Reproduce el guion completo con pausas: [[segundo de sesión, duración de la pausa en s], ...].
function reproducir(eventos, pausas) {
  const { reloj, avanzar } = relojFalso();
  const lanzados = [];
  const r = crearReproductor(eventos, { reloj, alLanzar: (e) => lanzados.push({ e, en: r.tiempo() }) });
  const pendientes = [...pausas];
  let real = 0;
  while (!r.terminado) {
    r.tic();
    if (pendientes.length && r.tiempo() >= pendientes[0][0]) {
      const [, duracion] = pendientes.shift();
      r.pausar();
      const congelado = r.tiempo();
      for (let s = 0; s < duracion * 1000; s += PASO) { // durante la pausa no pasa nada
        avanzar(PASO); real += PASO; r.tic();
        assert.equal(r.tiempo(), congelado);
      }
      r.reanudar();
    }
    avanzar(PASO); real += PASO;
  }
  return { lanzados, real };
}

const CONFIGS = [
  { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 2, modo_reaccion: true },
  { asaltos: 2, duracion_asalto: 30, descanso: 10, nivel: 1 },
];

for (const config of CONFIGS) {
  test(`pausar y reanudar no desplaza ni duplica eventos (${config.asaltos}×${config.duracion_asalto} s)`, () => {
    const eventos = construirGuion(config, crearAzar(7));
    // Pausas en mitad de un asalto, justo en un combo, en el descanso y dos seguidas.
    const combo = eventos.find((e) => e.tipo === "combo" && e.t > 10);
    const descanso = eventos.find((e) => e.tipo === "descanso");
    const pausas = [[5.05, 12], [combo.t, 3.3], [descanso.t + 2, 40], [descanso.t + 2.1, 1]]
      .sort((a, b) => a[0] - b[0]);
    const { lanzados, real } = reproducir(eventos, pausas);

    // Cada evento exactamente una vez y en el mismo orden que el guion.
    assert.deepEqual(lanzados.map((l) => l.e), eventos);
    // Cada uno en su segundo de sesión (como mucho un tic tarde): la pausa no los desplaza.
    for (const { e, en } of lanzados) {
      assert.ok(en >= e.t && en < e.t + PASO / 1000 + 1e-9, `${e.tipo} en ${e.t} lanzado en ${en}`);
    }
    // El tiempo real es el del guion más las pausas.
    const total = eventos.at(-1).t + pausas.reduce((s, [, d]) => s + d, 0);
    assert.ok(Math.abs(real / 1000 - total) < 0.5, `${real / 1000} vs ${total}`);
  });
}

test("los efectos programados también se congelan durante la pausa", () => {
  const { reloj, avanzar } = relojFalso();
  const hechos = [];
  const r = crearReproductor([{ t: 0, tipo: "inicio_asalto" }], { reloj, alLanzar: () => {} });
  r.programar(1.2, () => hechos.push(r.tiempo()));
  avanzar(1000); r.tic();
  r.pausar(); avanzar(5000); r.tic();
  assert.deepEqual(hechos, []);
  r.reanudar(); avanzar(100); r.tic();
  assert.deepEqual(hechos, []);
  avanzar(100); r.tic();
  assert.equal(hechos.length, 1);
  assert.ok(Math.abs(hechos[0] - 1.2) < 1e-9);
});

test("detener descarta lo pendiente", () => {
  const { reloj, avanzar } = relojFalso();
  const lanzados = [];
  const r = crearReproductor([{ t: 0 }, { t: 5 }], { reloj, alLanzar: (e) => lanzados.push(e) });
  r.tic(); r.programar(1, () => lanzados.push("diferido"));
  r.detener(); avanzar(10000); r.tic();
  assert.equal(lanzados.length, 1);
  assert.equal(r.terminado, true);
});
