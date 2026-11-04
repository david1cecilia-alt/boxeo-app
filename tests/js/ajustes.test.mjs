import assert from "node:assert/strict";
import { test } from "node:test";

import { crearAlmacen, perfilPorDefecto } from "../../static/almacen.js";
import {
  MAX_PRACTICAR, cambiarPracticar, nuevoGuion, opcionesVoz, perfilSorteo, personalizadaValida, preferencias, recordarSesion, resumenElecciones,
} from "../../static/ajustes.js";
import { crearAzar } from "../../static/motor/azar.js";
import { cargarDatosDeDisco } from "./datos.mjs";

const datos = cargarDatosDeDisco();

test("sin nada en «Practicar más» el sorteo usa data/perfil.json, que ya no lleva pesos", () => {
  assert.equal(perfilSorteo(perfilPorDefecto()), datos.perfil);
  assert.equal("pesos" in datos.perfil, false);
});

test("lo elegido en «Practicar más» pasa al sorteo sin tocar el resto de data/perfil.json", () => {
  const practicar = [{ movimiento: "6", cuanto: "bastante" }];
  const perfil = perfilSorteo({ ...perfilPorDefecto(), practicar });
  assert.deepEqual(perfil.practicar, practicar);
  assert.notEqual(perfil.practicar, practicar); // una copia: el sorteo no cambia el perfil
  assert.equal(perfil.guardia, datos.perfil.guardia);
  assert.equal("practicar" in datos.perfil, false);
});

test("cambiarPracticar elige con «un poco», cambia el cuánto en su sitio y quita", () => {
  let p = cambiarPracticar([], "3", "poco");
  p = cambiarPracticar(p, "rodar", "poco");
  assert.deepEqual(cambiarPracticar(p, "3", "bastante"),
    [{ movimiento: "3", cuanto: "bastante" }, { movimiento: "rodar", cuanto: "poco" }]);
  assert.deepEqual(cambiarPracticar(p, "3", null), [{ movimiento: "rodar", cuanto: "poco" }]);
  assert.deepEqual(cambiarPracticar(p, "pivote", null), p);
});

test(`cambiarPracticar no deja elegir más de ${MAX_PRACTICAR}, pero sí cambiar o quitar los elegidos`, () => {
  const llenos = ["1", "cuerpo", "bloqueo"].map((movimiento) => ({ movimiento, cuanto: "poco" }));
  assert.equal(llenos.length, MAX_PRACTICAR);
  assert.deepEqual(cambiarPracticar(llenos, "6", "poco"), llenos);
  assert.equal(cambiarPracticar(llenos, "bloqueo", "bastante")[2].cuanto, "bastante");
  assert.equal(cambiarPracticar(llenos, "1", null).length, MAX_PRACTICAR - 1);
});

// localStorage falso, para guardar y releer como al recargar la página.
function almacenamiento() {
  const mapa = new Map();
  return { getItem: (k) => mapa.get(k) ?? null, setItem: (k, v) => mapa.set(k, String(v)), removeItem: (k) => mapa.delete(k) };
}

// Lo que hace la pestaña Perfil al cambiar un campo.
function cambiarEnPerfil(almacen, grupo, campo, valor) {
  const p = structuredClone(almacen.datos.perfil);
  p[grupo][campo] = valor;
  almacen.guardarPerfil(p);
}

test("sin nada elegido en Entrenar: Amateur, nivel y guardia de data/perfil.json, voz y ritmo de siempre", () => {
  const p = perfilPorDefecto();
  assert.deepEqual(preferencias(p), {
    asalto: "amateur", nivel: datos.perfil.nivel, zurdo: datos.perfil.guardia === "zurda", voz: "nombres", ritmo: 3,
    reaccion: false, mezcla: "ninguna", personalizada: { asaltos: 3, duracion_asalto: 180, descanso: 60 },
  });
  // Lo que quede de «Tus datos» (datos escritos a mano) ya no cuenta: solo Entrenar.
  p.basicos = { ...p.basicos, nivel: "3", guardia: "zurda" };
  assert.equal(preferencias(p).nivel, datos.perfil.nivel);
  p.sesion = { ...p.sesion, nivel: 1, zurdo: true };
  assert.equal(preferencias(p).nivel, 1);
  assert.equal(preferencias(p).zurdo, true);
});

test("cada elección de Entrenar se guarda y se lee igual al recargar", () => {
  const eleccion = { asalto: "prueba", nivel: 3, ritmo: 4, voz: "numeros", zurdo: true, reaccion: true, mezcla: "mucho" };
  for (const [campo, valor] of Object.entries(eleccion)) {
    const storage = almacenamiento();
    recordarSesion(crearAlmacen({ storage }), { [campo]: valor });
    assert.equal(preferencias(crearAlmacen({ storage }).datos.perfil)[campo], valor, campo);
  }
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  for (const [campo, valor] of Object.entries(eleccion)) recordarSesion(almacen, { [campo]: valor });
  const { personalizada, ...leidas } = preferencias(crearAlmacen({ storage }).datos.perfil);
  assert.deepEqual(leidas, eleccion);
});

test("la personalizada se guarda y no se pierde al elegir Amateur o Prueba", () => {
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  recordarSesion(almacen, { asalto: "personalizado", personalizada: { asaltos: 4, duracion_asalto: 120, descanso: 45 } });
  recordarSesion(almacen, { asalto: "prueba" });
  recordarSesion(almacen, { asalto: "amateur" });
  const leidas = preferencias(crearAlmacen({ storage }).datos.perfil);
  assert.equal(leidas.asalto, "amateur");
  assert.deepEqual(leidas.personalizada, { asaltos: 4, duracion_asalto: 120, descanso: 45 });
});

test("una personalizada que no pasa validarConfig vuelve a 3 × 180 s con 60 s de descanso", () => {
  const p = perfilPorDefecto();
  for (const mala of [{ asaltos: 0, duracion_asalto: 120, descanso: 45 }, { asaltos: 4, duracion_asalto: 5, descanso: 45 },
    { asaltos: 4, duracion_asalto: 120, descanso: -1 }, { asaltos: "4", duracion_asalto: 120, descanso: 45 }, null]) {
    p.sesion = { ...p.sesion, personalizada: mala };
    assert.equal(personalizadaValida(mala), false);
    assert.deepEqual(preferencias(p).personalizada, { asaltos: 3, duracion_asalto: 180, descanso: 60 });
  }
  assert.equal(personalizadaValida({ asaltos: 4, duracion_asalto: 120, descanso: 45 }), true);
});

test("un asalto desconocido vuelve al primero (Amateur)", () => {
  const p = perfilPorDefecto();
  p.sesion = { ...p.sesion, asalto: "olimpico" };
  assert.equal(preferencias(p).asalto, "amateur");
});

test("recordarSesion guarda solo lo que llega y conserva el resto del perfil", () => {
  const guardados = [];
  const perfil = { ...perfilPorDefecto(), practicar: [{ movimiento: "2", cuanto: "poco" }] };
  const almacen = { datos: { perfil }, guardarPerfil: (p) => guardados.push(p) };
  recordarSesion(almacen, { voz: "numeros", ritmo: 1 });
  assert.deepEqual(guardados, [{ ...perfil, sesion: { ...perfil.sesion, voz: "numeros", ritmo: 1 } }]);
});

test("tocar otras cosas del Perfil («Practicar más», estilo, medidas) no pisa el nivel ni el zurdo de Entrenar", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  recordarSesion(almacen, { nivel: 3, zurdo: true });
  cambiarEnPerfil(almacen, "basicos", "altura_cm", 180);
  cambiarEnPerfil(almacen, "estilo", "cardio", "bueno");
  const p = structuredClone(almacen.datos.perfil);
  p.practicar = [{ movimiento: "flexion", cuanto: "bastante" }];
  almacen.guardarPerfil(p);
  assert.equal(preferencias(almacen.datos.perfil).nivel, 3);
  assert.equal(preferencias(almacen.datos.perfil).zurdo, true);
});

test("la línea de elecciones de «Tu sesión»: nivel · ritmo · voz, y Zurdo y Reacción solo si están", () => {
  const base = { nivel: 2, ritmo: 4, voz: "numeros", zurdo: false, modo_reaccion: false };
  assert.equal(resumenElecciones(base), "Medio · Vivo · Números");
  assert.equal(resumenElecciones({ ...base, modo_reaccion: true }), "Medio · Vivo · Números · Reacción");
  assert.equal(resumenElecciones({ ...base, zurdo: true }), "Medio · Vivo · Números · Zurdo");
  assert.equal(resumenElecciones({ nivel: 1, ritmo: 1, voz: "nombres", zurdo: true, modo_reaccion: true }),
    "Básico · Calmado · Nombres · Zurdo · Reacción");
  assert.equal(resumenElecciones({ ...base, nivel: 3, ritmo: 5, voz: "ambos" }), "Avanzado · Intenso · Ambos");
});

test("la voz de Ajustes: automática a velocidad normal (1,1) por defecto", () => {
  assert.deepEqual(opcionesVoz(perfilPorDefecto()), { id: null, velocidad: 1.1 });
});

test("la voz de Ajustes: la elegida y su velocidad en número para la voz y el motor", () => {
  const p = { ...perfilPorDefecto(), voz: { id: "urn:helena", velocidad: "lenta" } };
  assert.deepEqual(opcionesVoz(p), { id: "urn:helena", velocidad: 0.9 });
  assert.equal(opcionesVoz({ ...p, voz: { id: null, velocidad: "rapida" } }).velocidad, 1.3);
  assert.equal(opcionesVoz({ ...p, voz: { id: null, velocidad: "turbo" } }).velocidad, 1.1, "una desconocida, la normal");
});

test("el guion de Entrenar usa la velocidad de Ajustes", () => {
  const perfil = { ...perfilPorDefecto(), voz: { id: null, velocidad: "lenta" } };
  const config = { asaltos: 1, duracion_asalto: 60, descanso: 0, nivel: 1, ritmo: 3, pausa: null, voz: "nombres",
    zurdo: false, modo_reaccion: false, velocidad: opcionesVoz(perfil).velocidad };
  const lento = nuevoGuion(config, perfil, crearAzar(1)).filter((e) => e.tipo === "combo");
  const normal = nuevoGuion({ ...config, velocidad: 1.1 }, perfil, crearAzar(1)).filter((e) => e.tipo === "combo");
  assert.equal(lento[0].texto, normal[0].texto);
  assert.ok(lento[0].duracion > normal[0].duracion);
});

// ---------- «Tus combinaciones» en el guion ----------

const PROPIAS = [["jab", "directo"], ["jab", "esquiva_izq", "gancho_izq"], ["bloqueo", "directo", "gancho_izq", "directo"]]
  .map((ids, i) => ({ id: `p-${i}`, ids, creada: "2026-11-04T10:00:00Z" }));
const CONFIG = { asaltos: 2, duracion_asalto: 90, descanso: 30, nivel: 2, ritmo: 3, pausa: null, voz: "nombres",
  zurdo: false, modo_reaccion: false, velocidad: 1.1 };
const dichas = (eventos) => eventos.filter((e) => e.tipo === "combo" || e.tipo === "coletilla");
const esPropia = (ids) => PROPIAS.some((p) => p.ids.join() === ids.join());

test("una mezcla que no se recuerda vale «Ninguna»", () => {
  const p = perfilPorDefecto();
  for (const mezcla of ["ninguna", "poco", "bastante", "mucho", "solo"]) {
    assert.equal(preferencias({ ...p, sesion: { ...p.sesion, mezcla } }).mezcla, mezcla);
  }
  assert.equal(preferencias({ ...p, sesion: { ...p.sesion, mezcla: "todo" } }).mezcla, "ninguna");
});

test("el guion de Entrenar usa la mezcla: «Ninguna» sale igual que sin propias", () => {
  const p = perfilPorDefecto();
  const sin = nuevoGuion(CONFIG, p, crearAzar(3));
  assert.deepEqual(nuevoGuion({ ...CONFIG, mezcla: "ninguna" }, p, crearAzar(3), PROPIAS), sin);
});

test("«Solo las mías»: todas las combinaciones son propias, de cualquier nivel, y nunca se nombran", () => {
  const eventos = nuevoGuion({ ...CONFIG, mezcla: "solo" }, perfilPorDefecto(), crearAzar(5), PROPIAS);
  const combos = eventos.filter((e) => e.tipo === "combo");
  assert.ok(combos.length > 5);
  for (const e of combos) assert.ok(esPropia(e.ids), e.ids.join());
  assert.ok(new Set(combos.map((e) => e.ids.join())).size === PROPIAS.length, "salen las de los tres niveles");
});

test("«Mucho» mezcla propias del nivel y biblioteca; en zurdo, las propias salen en espejo", () => {
  // Las tres son de básico (2-4 acciones): en medio, «Mucho» no tiene propias del nivel.
  const basico = dichas(nuevoGuion({ ...CONFIG, nivel: 1, asaltos: 6, mezcla: "mucho" }, perfilPorDefecto(), crearAzar(8), PROPIAS));
  assert.ok(basico.some((e) => esPropia(e.ids)) && basico.some((e) => !esPropia(e.ids)));
  const medio = nuevoGuion({ ...CONFIG, mezcla: "mucho" }, perfilPorDefecto(), crearAzar(8), PROPIAS);
  assert.deepEqual(medio, nuevoGuion(CONFIG, perfilPorDefecto(), crearAzar(8)));
  const zurdo = dichas(nuevoGuion({ ...CONFIG, asaltos: 6, zurdo: true, mezcla: "solo" }, perfilPorDefecto(), crearAzar(8), PROPIAS));
  assert.ok(zurdo.some((e) => e.ids.includes("esquiva_der") && e.ids.includes("gancho_der")), "esquiva y crochet cambian de lado");
});
