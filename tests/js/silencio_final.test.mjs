// Silencio al final de cada asalto: desde que acaba la última combinación hasta la campana (el
// aviso de «diez segundos» no lo rompe). Asaltos de
// 3 min en nivel medio, velocidad normal, con y sin Reacción. Además del guion (como
// tests/test_silencio_final.py), se reproduce la sesión con el dictado y una voz de mentira que
// tarda `factor` veces lo estimado (null = onend no llega nunca), como hace vistas/entrenar.js.
import assert from "node:assert/strict";
import { test } from "node:test";

import { PARA_REACCIONAR, crearDictado } from "../../static/dictado.js";
import { crearAzar } from "../../static/motor/azar.js";
import { RITMO_POR_DEFECTO, VELOCIDADES, rangoPausa, segundosHabla } from "../../static/motor/ritmo.js";
import { COMBINACIONES, PREPARACION, construirGuion } from "../../static/motor/temporizador.js";
import { crearReproductor } from "../../static/reproductor.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

// Como mucho el hueco mínimo del ritmo (el por defecto) más 3 s: 5 s.
const SILENCIO_MAXIMO = rangoPausa(RITMO_POR_DEFECTO)[0] + 3.0;
const SEMILLAS = [1, 2, 3, 4, 5, 6, 7, 8];
const PASO = 100; // ms entre tics, como en la app
const vaciar = () => new Promise((ok) => setImmediate(ok));

const configDe = (modo_reaccion) => ({
  asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 2, modo_reaccion, velocidad: VELOCIDADES.normal,
});

function silenciosDelGuion(eventos) {
  return eventos.filter((e) => e.tipo === "fin_asalto").map((fin) => {
    const dichos = eventos.filter((e) => e.asalto === fin.asalto && e.t < fin.t
      && (e.tipo === "combo" || e.tipo === "coletilla"));
    return fin.t - Math.max(...dichos.map((e) => e.t + e.duracion));
  });
}

// Reproduce la sesión entera y devuelve, por asalto, el silencio desde la última combinación.
async function silenciosDelDictado(config, semilla, factor) {
  const eventos = construirGuion(config, crearAzar(semilla));
  const combos = eventos.filter((e) => COMBINACIONES.includes(e.tipo));
  const fijos = eventos.filter((e) => !COMBINACIONES.includes(e.tipo));
  let ms = 0;
  let dictado;
  let ultimaVoz = 0;     // cuándo calla la última combinación
  let esCombo = false;   // alDecir avisa justo antes de decir una combinación
  const silencios = [];
  const reproductor = crearReproductor(fijos, {
    reloj: () => ms,
    alLanzar(e) {
      if (e.tipo === "inicio_asalto") {
        reproductor.programar(1.2, () => dictado.senal(e.texto));
        dictado.asalto({
          cola: combos.filter((c) => c.asalto === e.asalto && c.tipo !== "coletilla"),
          coletillas: combos.filter((c) => c.asalto === e.asalto && c.tipo === "coletilla" && c.t >= e.t + config.duracion_asalto),
          desde: e.t + PREPARACION,
          reservados: fijos.filter((f) => f.asalto === e.asalto && (f.tipo === "aviso" || f.tipo === "reaccion"))
            .map((f) => [f.t, f.t + f.duracion]),
          fin: e.t + config.duracion_asalto,
        });
      } else if (e.tipo === "reaccion") dictado.senal(e.texto, PARA_REACCIONAR);
      else if (e.tipo === "aviso") dictado.senal(e.texto);
      else if (e.tipo === "fin_asalto") {
        dictado.cortar();
        silencios.push(e.t - ultimaVoz);
      }
    },
  });
  const voz = {
    decir(texto) {
      const dura = segundosHabla(texto, config.velocidad) * (factor ?? 1);
      if (esCombo) ultimaVoz = reproductor.tiempo() + dura; // sin onend suena igual: solo no avisa
      esCombo = false;
      return new Promise((ok) => { if (factor !== null) reproductor.programar(dura, () => ok("fin")); });
    },
    callar() {},
  };
  dictado = crearDictado({ reproductor, voz, config: { ritmo: RITMO_POR_DEFECTO, pausa: null, velocidad: config.velocidad },
    alDecir: () => { esCombo = true; } });
  while (!reproductor.terminado) {
    ms += PASO;
    reproductor.tic();
    await vaciar();
  }
  return silencios;
}

const resumen = (s) => `media ${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1)} s, máximo ${Math.max(...s).toFixed(1)} s`;

for (const modoReaccion of [false, true]) {
  const nombre = modoReaccion ? "con Reacción" : "sin Reacción";

  test(`guion ${nombre}: silencio final corto`, () => {
    const s = SEMILLAS.flatMap((semilla) => silenciosDelGuion(construirGuion(configDe(modoReaccion), crearAzar(semilla))));
    console.log(`guion ${nombre}: ${resumen(s)}`);
    assert.ok(Math.max(...s) <= SILENCIO_MAXIMO, resumen(s));
  });

  // 1 = la voz tarda lo estimado; 0,85 y 0,7 = más rápida (la estimación lleva margen y es de
  // Microsoft Helena en Windows); null = onend no llega y manda el tope.
  for (const factor of [1, 0.85, 0.7, null]) {
    test(`dictado ${nombre}, voz ${factor ?? "sin onend"}: silencio final corto`, async () => {
      const s = [];
      for (const semilla of SEMILLAS) s.push(...await silenciosDelDictado(configDe(modoReaccion), semilla, factor));
      console.log(`dictado ${nombre}, voz ${factor ?? "sin onend"}: ${resumen(s)}`);
      assert.ok(Math.max(...s) <= SILENCIO_MAXIMO, resumen(s));
    });
  }
}
