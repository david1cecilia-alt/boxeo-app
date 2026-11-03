import assert from "node:assert/strict";
import { test } from "node:test";

import { crearAlmacen, perfilPorDefecto } from "../../static/almacen.js";
import {
  nuevoGuion, opcionesVoz, perfilSorteo, personalizadaValida, preferencias, recordarSesion, resumenElecciones, seguirBasicos,
} from "../../static/ajustes.js";
import { crearAzar } from "../../static/motor/azar.js";
import { cargarDatosDeDisco } from "./datos.mjs";

const datos = cargarDatosDeDisco();

function perfilCon(pesos) {
  return { ...perfilPorDefecto(), pesos };
}

test("sin pesos propios se usan los de data/perfil.json", () => {
  assert.equal(perfilSorteo(perfilPorDefecto()), datos.perfil);
});

test("los pesos del perfil sustituyen a los de data/perfil.json (no se mezclan)", () => {
  const pesos = { termina_en_gancho: 1.2, bloquear_y_devolver: 0.5, entrada_con_jab: 3 };
  const perfil = perfilSorteo(perfilCon(pesos));
  assert.deepEqual(perfil.pesos, pesos);
  assert.equal(perfil.guardia, datos.perfil.guardia);
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
  if (grupo === "basicos") seguirBasicos(p, campo);
  almacen.guardarPerfil(p);
}

test("sin nada elegido en Entrenar: Amateur, nivel y guardia del perfil, voz y ritmo de siempre", () => {
  const p = perfilPorDefecto();
  assert.deepEqual(preferencias(p), {
    asalto: "amateur", nivel: datos.perfil.nivel, zurdo: datos.perfil.guardia === "zurda", voz: "nombres", ritmo: 3,
    reaccion: false, personalizada: { asaltos: 3, duracion_asalto: 180, descanso: 60 },
  });
  p.basicos = { ...p.basicos, nivel: "3", guardia: "zurda" };
  assert.equal(preferencias(p).nivel, 3);
  assert.equal(preferencias(p).zurdo, true);
});

test("lo elegido en Entrenar manda sobre «Tus datos»", () => {
  const p = perfilPorDefecto();
  p.basicos = { ...p.basicos, nivel: "3", guardia: "zurda" };
  p.sesion = { ...p.sesion, nivel: 1, zurdo: false };
  assert.equal(preferencias(p).nivel, 1);
  assert.equal(preferencias(p).zurdo, false);
});

test("cada elección de Entrenar se guarda y se lee igual al recargar", () => {
  const eleccion = { asalto: "prueba", nivel: 3, ritmo: 4, voz: "numeros", zurdo: true, reaccion: true };
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
  const perfil = { ...perfilPorDefecto(), pesos: { termina_en_gancho: 2, bloquear_y_devolver: 1, entrada_con_jab: 1 } };
  const almacen = { datos: { perfil }, guardarPerfil: (p) => guardados.push(p) };
  recordarSesion(almacen, { voz: "numeros", ritmo: 1 });
  assert.deepEqual(guardados, [{ ...perfil, sesion: { ...perfil.sesion, voz: "numeros", ritmo: 1 } }]);
});

test("cambiar Guardia o Nivel en Perfil pone igual lo de Entrenar", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  recordarSesion(almacen, { nivel: 1, zurdo: false });
  cambiarEnPerfil(almacen, "basicos", "guardia", "zurda");
  assert.equal(preferencias(almacen.datos.perfil).zurdo, true);
  cambiarEnPerfil(almacen, "basicos", "nivel", "3");
  assert.equal(preferencias(almacen.datos.perfil).nivel, 3);
  // «No lo sé» vuelve a los de data/perfil.json.
  cambiarEnPerfil(almacen, "basicos", "nivel", "no_se");
  assert.equal(preferencias(almacen.datos.perfil).nivel, datos.perfil.nivel);
});

test("cambiar nivel o zurdo en Entrenar no cambia el Perfil", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  cambiarEnPerfil(almacen, "basicos", "guardia", "ortodoxa");
  cambiarEnPerfil(almacen, "basicos", "nivel", "2");
  recordarSesion(almacen, { nivel: 3, zurdo: true });
  assert.equal(almacen.datos.perfil.basicos.guardia, "ortodoxa");
  assert.equal(almacen.datos.perfil.basicos.nivel, "2");
  assert.equal(preferencias(almacen.datos.perfil).nivel, 3);
  assert.equal(preferencias(almacen.datos.perfil).zurdo, true);
});

test("tocar otras cosas del Perfil (pesos, estilo, medidas) no pisa el nivel ni el zurdo de Entrenar", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  cambiarEnPerfil(almacen, "basicos", "guardia", "ortodoxa");
  cambiarEnPerfil(almacen, "basicos", "nivel", "1");
  recordarSesion(almacen, { nivel: 3, zurdo: true });
  cambiarEnPerfil(almacen, "basicos", "altura_cm", 180);
  cambiarEnPerfil(almacen, "estilo", "cardio", "bueno");
  const p = structuredClone(almacen.datos.perfil);
  p.pesos = { termina_en_gancho: 3, bloquear_y_devolver: 1, entrada_con_jab: 1 };
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
