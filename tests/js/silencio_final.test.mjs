// Silencio al final de cada asalto: desde que acaba la última combinación hasta la campana (el
// aviso de «diez segundos» no lo rompe). Asaltos de
// 3 min en nivel medio, velocidad normal, con y sin Reacción. Además del guion (como
// tests/test_silencio_final.py), se reproduce la sesión con el dictado y una voz de mentira que
// tarda `factor` veces lo estimado (null = onend no llega nunca), como hace vistas/entrenar.js.
import assert from "node:assert/strict";
import { test } from "node:test";

import { PARA_REACCIONAR, crearDictado } from "../../static/dictado.js";
import { crearAzar } from "../../static/motor/azar.js";
import { RITMO_POR_DEFECTO, VELOCIDADES, VELOCIDAD_SENAL, rangoPausa, segundosHabla } from "../../static/motor/ritmo.js";
import { SorteoMezcla } from "../../static/motor/sorteo.js";
import { COMBINACIONES, DURACION_REACCION, PREPARACION, construirGuion } from "../../static/motor/temporizador.js";
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

// Con propias (como tests/test_silencio_final.py): la mezcla y «Solo las mías» con una sola corta,
// con varias y sin ninguna. Sin excepciones: el mismo máximo.
const propias = (...listas) => listas.map((ids, i) => ({ id: `p-${i}`, ids }));
const UNA_CORTA = propias(["jab", "directo"], ["jab", "directo", "gancho_izq", "gancho_der", "uppercut_izq"],
  ["jab", "rodar_der", "directo", "gancho_izq", "esquiva_izq", "directo"]);
const VARIAS_CORTAS = propias(["jab", "directo"], ["esquiva_der", "gancho_izq", "directo"], ["jab", "bloqueo"],
  ["jab", "jab", "directo", "pivote", "gancho_der"]);
const SIN_CORTAS = propias(Array(8).fill("jab"), ["jab", "directo", "jab", "directo", "jab", "directo", "jab", "directo"],
  ["jab", "directo", "rodar_der", "gancho_izq", "directo"]);
const MEZCLAS = {
  ninguna: [[], "ninguna"],
  mucho: [VARIAS_CORTAS, "mucho"],
  "solo, una corta": [UNA_CORTA, "solo"],
  "solo, varias cortas": [VARIAS_CORTAS, "solo"],
  "solo, sin cortas": [SIN_CORTAS, "solo"],
};
function guion(config, semilla, mezcla = "ninguna") {
  const azar = crearAzar(semilla);
  const [lista, cual] = MEZCLAS[mezcla];
  return construirGuion(config, azar, new SorteoMezcla(config.nivel, { azar, propias: lista, mezcla: cual }));
}

function silenciosDelGuion(eventos) {
  return eventos.filter((e) => e.tipo === "fin_asalto").map((fin) => {
    const dichos = eventos.filter((e) => e.asalto === fin.asalto && e.t < fin.t
      && (e.tipo === "combo" || e.tipo === "coletilla"));
    return fin.t - Math.max(...dichos.map((e) => e.t + e.duracion));
  });
}

// Reproduce la sesión entera. Devuelve, por asalto, el silencio desde la última combinación;
// además, lo que sonó (`voces`: { texto, combo, velocidad, ini, fin }), las señales de Reacción
// del guion, lo que se avisó con alDecir y lo que el dictado guarda (`dichas`).
async function reproducir(config, semilla, factor, mezcla = "ninguna") {
  const eventos = guion(config, semilla, mezcla);
  const combos = eventos.filter((e) => COMBINACIONES.includes(e.tipo));
  const fijos = eventos.filter((e) => !COMBINACIONES.includes(e.tipo));
  let ms = 0;
  let dictado;
  let ultimaVoz = 0;     // cuándo calla la última combinación
  let esCombo = false;   // alDecir avisa justo antes de decir una combinación
  const silencios = [];
  const voces = [];
  const avisadas = [];
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
      } else if (e.tipo === "reaccion") dictado.reaccion(e.texto); // como vistas/entrenar.js
      else if (e.tipo === "aviso") dictado.senal(e.texto);
      else if (e.tipo === "fin_asalto") {
        dictado.cortar();
        silencios.push(e.t - ultimaVoz);
      }
    },
  });
  const voz = {
    decir(texto, { velocidad = config.velocidad } = {}) {
      const dura = segundosHabla(texto, velocidad) * (factor ?? 1);
      const ini = reproductor.tiempo();
      voces.push({ texto, combo: esCombo, velocidad, ini, fin: ini + dura });
      if (esCombo) ultimaVoz = ini + dura; // sin onend suena igual: solo no avisa
      esCombo = false;
      return new Promise((ok) => { if (factor !== null) reproductor.programar(dura, () => ok("fin")); });
    },
    callar() {},
  };
  dictado = crearDictado({ reproductor, voz, config: { ritmo: RITMO_POR_DEFECTO, pausa: null, velocidad: config.velocidad },
    alDecir: (c) => { esCombo = true; avisadas.push(c); } });
  while (!reproductor.terminado) {
    ms += PASO;
    reproductor.tic();
    await vaciar();
  }
  const reacciones = fijos.filter((e) => e.tipo === "reaccion");
  return { silencios, voces, reacciones, avisadas, combos, dichas: dictado.dichas };
}

const silenciosDelDictado = async (config, semilla, factor, mezcla) =>
  (await reproducir(config, semilla, factor, mezcla)).silencios;

const resumen = (s) => `media ${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1)} s, máximo ${Math.max(...s).toFixed(1)} s`;

for (const modoReaccion of [false, true]) {
  const nombre = modoReaccion ? "con Reacción" : "sin Reacción";

  for (const mezcla of Object.keys(MEZCLAS)) {
    test(`guion ${nombre}, propias «${mezcla}»: silencio final corto`, () => {
      const s = SEMILLAS.flatMap((semilla) => silenciosDelGuion(guion(configDe(modoReaccion), semilla, mezcla)));
      console.log(`guion ${nombre}, propias «${mezcla}»: ${resumen(s)}`);
      assert.ok(Math.max(...s) <= SILENCIO_MAXIMO, resumen(s));
    });
  }

  // «Solo las mías» con la voz de verdad: tarda lo estimado o no avisa al acabar.
  for (const mezcla of ["solo, una corta", "solo, sin cortas"]) {
    for (const factor of [0.7, null]) {
      test(`dictado ${nombre}, propias «${mezcla}», voz ${factor ?? "sin onend"}: silencio final corto`, async () => {
        const s = [];
        for (const semilla of SEMILLAS) s.push(...await silenciosDelDictado(configDe(modoReaccion), semilla, factor, mezcla));
        assert.ok(Math.max(...s) <= SILENCIO_MAXIMO, resumen(s));
      });
    }
  }

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

// Reacción activa con el guion de verdad (reservas y coletillas, señales en `reservados`).
for (const factor of [1, 0.7, null]) {
  test(`Reacción y reservas, voz ${factor ?? "sin onend"}: señales a 1,4 en su reserva de 2 s + 1 s libre, sin pisarse, y se guarda solo lo dicho`, async () => {
    const config = configDe(true);
    let reservasSinDecir = 0;
    for (const semilla of SEMILLAS) {
      const { silencios, voces, reacciones, avisadas, combos, dichas } = await reproducir(config, semilla, factor);
      assert.ok(reacciones.length > 0, `semilla ${semilla}: sin señales`);
      assert.ok(combos.some((c) => c.tipo === "reserva") && combos.some((c) => c.tipo === "coletilla"));
      const habladas = voces.filter((v) => !v.combo);
      const dichos = voces.filter((v) => v.combo);
      for (const r of reacciones) {
        assert.equal(r.duracion, DURACION_REACCION);
        const voz = habladas.find((v) => v.texto === r.texto && Math.abs(v.ini - r.t) < 0.15);
        assert.ok(voz, `semilla ${semilla}: «${r.texto}» no sonó a las ${r.t}`);
        assert.equal(voz.velocidad, VELOCIDAD_SENAL);
        assert.ok(segundosHabla(r.texto, VELOCIDAD_SENAL) <= DURACION_REACCION);
        // Ninguna combinación suena dentro de la reserva ni hasta 1 s después de que calle la señal.
        const libreHasta = Math.max(r.t + r.duracion, voz.fin + PARA_REACCIONAR) - 1e-6;
        for (const c of dichos) {
          assert.ok(c.fin <= r.t + 1e-6 || c.ini >= libreHasta,
            `semilla ${semilla}: «${c.texto}» [${c.ini.toFixed(2)}, ${c.fin.toFixed(2)}] pisa «${r.texto}» a las ${r.t}`);
        }
      }
      // Solo se guarda lo que se dijo, en su orden; las reservas que sobran no.
      assert.deepEqual(dichas.map((d) => d.texto), dichos.map((v) => v.texto));
      assert.deepEqual(dichas, avisadas.map((c) => ({ asalto: c.asalto, texto: c.texto, ids: c.ids })));
      reservasSinDecir += combos.filter((c) => c.tipo === "reserva" && !avisadas.includes(c)).length;
      assert.ok(Math.max(...silencios) <= SILENCIO_MAXIMO, `semilla ${semilla}: ${silencios}`);
    }
    assert.ok(reservasSinDecir > 0, "ninguna reserva se quedó sin decir: el test no comprueba nada");
  });
}
