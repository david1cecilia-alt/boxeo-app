import assert from "node:assert/strict";
import { test } from "node:test";

import { crearAlmacen, perfilPorDefecto } from "../../static/almacen.js";
import {
  MAX_PRACTICAR, OPCIONES_MEZCLA, PRESET_DE_TIPO, aPersonalizada, cambiarPracticar, configSesion, conPrueba, configGeneral, estadoMezcla, nuevoGuion, opcionesVoz, perfilSorteo, personalizadaValida, preferencias, recordarSesion, resumenElecciones,
} from "../../static/ajustes.js";
import { crearAzar } from "../../static/motor/azar.js";
import { validarConfig } from "../../static/motor/temporizador.js";
import { cargarDatosDeDisco } from "./datos.mjs";

const datos = cargarDatosDeDisco();

test("sin nada en «Practicar más» el sorteo usa data/perfil.json, que ya no lleva pesos", () => {
  assert.equal(perfilSorteo(perfilPorDefecto()), datos.perfil);
  assert.equal("pesos" in datos.perfil, false);
});

test("lo elegido en «Practicar más» pasa al sorteo sin tocar el resto de data/perfil.json", () => {
  const practicar = [{ movimiento: "6" }];
  const perfil = perfilSorteo({ ...perfilPorDefecto(), practicar });
  assert.deepEqual(perfil.practicar, practicar);
  assert.notEqual(perfil.practicar, practicar); // una copia: el sorteo no cambia el perfil
  assert.equal(perfil.guardia, datos.perfil.guardia);
  assert.equal("practicar" in datos.perfil, false);
});

test("cambiarPracticar elige (sin cuánto: un solo nivel), no repite y quita", () => {
  let p = cambiarPracticar([], "3", true);
  p = cambiarPracticar(p, "rodar", true);
  assert.deepEqual(p, [{ movimiento: "3" }, { movimiento: "rodar" }]);
  assert.equal(cambiarPracticar(p, "3", true), p); // ya elegido: nada cambia
  assert.deepEqual(cambiarPracticar(p, "3", false), [{ movimiento: "rodar" }]);
  assert.deepEqual(cambiarPracticar(p, "pivote", false), p);
});

test(`cambiarPracticar no deja elegir más de ${MAX_PRACTICAR}, pero sí cambiar o quitar los elegidos`, () => {
  const llenos = ["1", "cuerpo", "bloqueo"].map((movimiento) => ({ movimiento }));
  assert.equal(llenos.length, MAX_PRACTICAR);
  assert.deepEqual(cambiarPracticar(llenos, "6", true), llenos);
  assert.deepEqual(cambiarPracticar(llenos, "bloqueo", true), llenos);
  assert.equal(cambiarPracticar(llenos, "1", false).length, MAX_PRACTICAR - 1);
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

test("sin nada elegido en Entrenar: General, nivel y guardia de data/perfil.json, voz y ritmo de siempre", () => {
  const p = perfilPorDefecto();
  assert.deepEqual(preferencias(p), {
    tipo: "general", nivel: datos.perfil.nivel, zurdo: datos.perfil.guardia === "zurda", voz: "nombres", ritmo: 3,
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
  const eleccion = { tipo: "personalizada", nivel: 3, ritmo: 4, voz: "numeros", zurdo: true, reaccion: true, mezcla: "mucho" };
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

test("la personalizada se guarda y no se pierde al elegir la General", () => {
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  recordarSesion(almacen, { tipo: "personalizada", personalizada: { asaltos: 4, duracion_asalto: 120, descanso: 45 } });
  recordarSesion(almacen, { tipo: "general" });
  const leidas = preferencias(crearAlmacen({ storage }).datos.perfil);
  assert.equal(leidas.tipo, "general");
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

test("un tipo desconocido (o «prueba», que nunca se guarda) vale la General", () => {
  const p = perfilPorDefecto();
  for (const tipo of ["olimpico", "prueba", undefined]) {
    p.sesion = { ...p.sesion, tipo };
    assert.equal(preferencias(p).tipo, "general", String(tipo));
  }
  assert.equal("asalto" in preferencias(p), false);
});

test("configGeneral: 3 × 3:00 con 1:00 de descanso de data/presets.json y lo fijo de la General", () => {
  const amateur = datos.presets.presets.find((p) => p.id === "amateur");
  assert.equal(PRESET_DE_TIPO.general, "amateur");
  assert.deepEqual(configGeneral(), {
    asaltos: amateur.asaltos, duracion_asalto: amateur.duracion_asalto, descanso: amateur.descanso,
    nivel: datos.perfil.nivel, ritmo: 3, mezcla: "ninguna", reaccion: false, practicar: [],
  });
  assert.deepEqual([amateur.asaltos, amateur.duracion_asalto, amateur.descanso], [3, 180, 60]);
  assert.equal(datos.perfil.nivel, 1); // Básico
  // Es una copia nueva cada vez: tocarla no cambia la General.
  configGeneral().practicar.push({ movimiento: "3" });
  assert.deepEqual(configGeneral().practicar, []);
});

test("configGeneral no depende de lo guardado: con una Personalizada elegida da lo mismo", () => {
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  const antes = configGeneral();
  recordarSesion(almacen, { tipo: "personalizada", nivel: 3, ritmo: 5, mezcla: "mucho", reaccion: true,
    personalizada: { asaltos: 4, duracion_asalto: 120, descanso: 45 } });
  assert.deepEqual(configGeneral(), antes);
});

test("conPrueba: solo con ?prueba en la URL; sin URL (Node) o con una URL rara, no", () => {
  assert.equal(conPrueba("http://boxeo.local/index.html?prueba#entrenar"), true);
  assert.equal(conPrueba("http://boxeo.local/index.html?x=1&prueba=1"), true);
  assert.equal(conPrueba("http://boxeo.local/index.html#entrenar"), false);
  assert.equal(conPrueba("http://boxeo.local/index.html#entrenar?prueba"), false); // en el hash no cuenta
  assert.equal(conPrueba("http://boxeo.local/index.html?pruebas"), false);
  assert.equal(conPrueba("no es una url"), false);
  assert.equal(conPrueba(), false); // en Node no hay location
});

test("preferencias con ?prueba propone Prueba sin tocar lo guardado; sin él, lo guardado", () => {
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  recordarSesion(almacen, { tipo: "personalizada", personalizada: { asaltos: 4, duracion_asalto: 120, descanso: 45 } });
  const perfil = crearAlmacen({ storage }).datos.perfil;
  assert.equal(preferencias(perfil, { prueba: true }).tipo, "prueba");
  assert.equal(preferencias(perfil).tipo, "personalizada");
  assert.deepEqual(preferencias(perfil, { prueba: true }).personalizada, { asaltos: 4, duracion_asalto: 120, descanso: 45 });
  assert.equal(JSON.parse(storage.getItem("boxeo")).perfil.sesion.tipo, "personalizada");
});

test("recordarSesion guarda solo lo que llega y conserva el resto del perfil", () => {
  const guardados = [];
  const perfil = { ...perfilPorDefecto(), practicar: [{ movimiento: "2" }] };
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
  p.practicar = [{ movimiento: "flexion" }];
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

test("«Tus combinaciones»: cinco opciones con el porcentaje de motor/sorteo.js", () => {
  assert.deepEqual(OPCIONES_MEZCLA.map((o) => `${o.nombre} ${o.porcentaje}`),
    ["Ninguna 0", "Poco 20", "Bastante 35", "Mucho 50", "Solo las mías 100"]);
});

test("estadoMezcla: sin propias, con menos de 3 y con «Solo las mías»", () => {
  const sin = estadoMezcla("ninguna", [], 2);
  assert.deepEqual(sin, { total: 0, efectiva: "ninguna", motivoSolo: null, aviso: null, nivelCuenta: true });
  // Una guardada que ya no vale (ids fuera del catálogo) no cuenta.
  assert.equal(estadoMezcla("mucho", [{ id: "p-x", ids: ["jab", "patada"] }], 1).total, 0);

  const dos = PROPIAS.slice(0, 2);
  assert.equal(estadoMezcla("ninguna", dos, 1).motivoSolo, "«Solo las mías» necesita al menos 3 combinaciones (tienes 2).");
  const soloConDos = estadoMezcla("solo", dos, 1);
  assert.equal(soloConDos.efectiva, "ninguna");
  assert.match(soloConDos.motivoSolo, /tienes 2\): de momento salen las de la biblioteca\.$/);
  assert.equal(soloConDos.nivelCuenta, true);

  const solo = estadoMezcla("solo", PROPIAS, 3);
  assert.deepEqual(solo, { total: 3, efectiva: "solo", motivoSolo: null, aviso: null, nivelCuenta: false });
});

test("estadoMezcla: avisa sin propias del nivel y con «Solo las mías» sin ninguna de 2-3 acciones", () => {
  assert.equal(estadoMezcla("bastante", PROPIAS, 1).aviso, null);
  assert.equal(estadoMezcla("bastante", PROPIAS, 2).aviso,
    "No tienes combinaciones de nivel medio: solo saldrán las de la biblioteca.");
  assert.equal(estadoMezcla("bastante", PROPIAS, 2).efectiva, "ninguna");
  const largas = [["jab", "directo", "gancho_izq", "directo"], ["jab", "jab", "directo", "bloqueo"],
    ["directo", "gancho_izq", "directo", "esquiva_izq"]].map((ids, i) => ({ id: `p-${i}`, ids }));
  assert.equal(estadoMezcla("solo", largas, 2).aviso, "Añade alguna de 2-3 acciones para que el final del asalto sea solo tuyo.");
  assert.equal(estadoMezcla("ninguna", largas, 2).aviso, null);
});

test("el resumen de «Tu sesión» dice la mezcla efectiva y, con «Solo las mías», no el nivel", () => {
  const base = { nivel: 2, ritmo: 4, voz: "numeros", zurdo: false, modo_reaccion: false };
  assert.equal(resumenElecciones({ ...base, mezcla: "ninguna" }), "Medio · Vivo · Números");
  assert.equal(resumenElecciones({ ...base, mezcla: "mucho" }), "Medio · Mucho de las tuyas · Vivo · Números");
  assert.equal(resumenElecciones({ ...base, mezcla: "solo", zurdo: true }), "Solo las tuyas · Vivo · Números · Zurdo");
});

// ---------- La sesión elegida (configSesion) y el paso a la Personalizada (D3) ----------

// Una Personalizada guardada que no se parece en nada a la General (la de 6.2 del plan).
function conPersonalizada(tipo) {
  const p = perfilPorDefecto();
  p.sesion = {
    ...p.sesion, tipo, nivel: 2, ritmo: 4, mezcla: "poco", reaccion: true, voz: "ambos", zurdo: true,
    personalizada: { asaltos: 4, duracion_asalto: 120, descanso: 45 },
  };
  p.practicar = [{ movimiento: "3" }];
  p.voz = { ...p.voz, velocidad: "lenta" };
  return p;
}

test("configSesion General: lo de D1 aunque la Personalizada guardada sea otra; voz y guardia, las de Ajustes", () => {
  const c = configSesion(conPersonalizada("general"), { prueba: false });
  assert.deepEqual(c, {
    tipo: "general", asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: datos.perfil.nivel, ritmo: 3,
    mezcla: "ninguna", modo_reaccion: false, practicar: [], zurdo: true, voz: "ambos", pausa: null,
    velocidad: opcionesVoz({ voz: { velocidad: "lenta" } }).velocidad,
  });
});

test("configSesion Personalizada: lo guardado, «Practicar más» incluido (en copia)", () => {
  const p = conPersonalizada("personalizada");
  const c = configSesion(p, { prueba: false });
  assert.equal(c.tipo, "personalizada");
  assert.deepEqual([c.asaltos, c.duracion_asalto, c.descanso, c.nivel, c.ritmo, c.mezcla, c.modo_reaccion],
    [4, 120, 45, 2, 4, "poco", true]);
  assert.deepEqual(c.practicar, [{ movimiento: "3" }]);
  assert.notEqual(c.practicar[0], p.practicar[0]);
});

test("configSesion Prueba (solo con ?prueba): 2 × 0:30 con las elecciones de la Personalizada", () => {
  const c = configSesion(conPersonalizada("general"), { prueba: true });
  assert.equal(c.tipo, "prueba");
  assert.deepEqual([c.asaltos, c.duracion_asalto, c.descanso, c.nivel, c.ritmo, c.mezcla], [2, 30, 10, 2, 4, "poco"]);
  // Elegir otro tipo a mano (la interfaz) manda sobre ?prueba.
  assert.equal(configSesion(conPersonalizada("general"), { prueba: true, tipo: "general" }).nivel, datos.perfil.nivel);
});

test("las tres configs pasan validarConfig y el resumen de la General dice su nivel, no el de la Personalizada", () => {
  for (const [tipo, prueba] of [["general", false], ["personalizada", false], ["general", true]]) {
    const c = configSesion(conPersonalizada(tipo), { prueba });
    assert.deepEqual(validarConfig(c), [], `${c.tipo}`);
  }
  const general = configSesion(conPersonalizada("general"), { prueba: false });
  assert.ok(resumenElecciones(general).startsWith("Básico · Constante"), resumenElecciones(general));
});

test("la General no usa el «Practicar más» guardado: su guion es el de un perfil sin él", () => {
  const p = conPersonalizada("general");
  const c = configSesion(p, { prueba: false });
  const sin = { ...p, practicar: [] };
  assert.deepEqual(nuevoGuion(c, p, crearAzar(4)), nuevoGuion(c, sin, crearAzar(4)));
  // Y la Personalizada sí lo usa.
  const cp = configSesion(conPersonalizada("personalizada"), { prueba: false });
  assert.notDeepEqual(nuevoGuion({ ...cp, asaltos: 3 }, p, crearAzar(4)), nuevoGuion({ ...cp, asaltos: 3, practicar: [] }, p, crearAzar(4)));
});

test("D3: tocar algo con la General elegida guarda la Personalizada guardada + ese cambio, y volver a General no borra nada", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  const p = conPersonalizada("general");
  almacen.guardarPerfil(p);
  recordarSesion(almacen, aPersonalizada({ nivel: 3 }));
  const s = almacen.datos.perfil.sesion;
  assert.equal(s.tipo, "personalizada");
  assert.deepEqual([s.nivel, s.ritmo, s.mezcla, s.reaccion, s.personalizada], [3, 4, "poco", true, p.sesion.personalizada]);
  assert.deepEqual(almacen.datos.perfil.practicar, [{ movimiento: "3" }]);
  recordarSesion(almacen, { tipo: "general" });
  const c = configSesion(almacen.datos.perfil, { prueba: false, tipo: "personalizada" });
  assert.deepEqual([c.asaltos, c.duracion_asalto, c.descanso, c.nivel], [4, 120, 45, 3]);
  assert.equal(configSesion(almacen.datos.perfil, { prueba: false }).nivel, datos.perfil.nivel);
});
