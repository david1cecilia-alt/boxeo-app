import assert from "node:assert/strict";
import { test } from "node:test";

import { crearAlmacen, perfilPorDefecto } from "../../static/almacen.js";
import {
  nuevoGuion, perfilGenerador, personalizadaValida, preferencias, recordarSesion, seguirBasicos,
} from "../../static/ajustes.js";
import { accionesPorIds } from "../../static/motor/acciones.js";
import { crearAzar } from "../../static/motor/azar.js";
import { ultimoGolpe } from "../../static/motor/reglas.js";
import { cargarDatosDeDisco } from "./datos.mjs";

const datos = cargarDatosDeDisco();
// Sesión larga (12 × 10 min): unas 1.000 combinaciones por guion. En nivel 3 (40 % con defensa):
// en básico solo el 15 % lleva defensa y el peso del bloqueo apenas tendría margen.
const CONFIG = { asaltos: 12, duracion_asalto: 600, descanso: 60, nivel: 3, zurdo: false, modo_reaccion: false, pausa: 0 };

function perfilCon(pesos) {
  return { ...perfilPorDefecto(), pesos };
}

// Proporción de combinaciones del guion que cumplen la condición (sobre las acciones ortodoxas).
function proporcion(perfilUsuario, condicion, semilla = 3) {
  const combos = nuevoGuion(CONFIG, perfilUsuario, crearAzar(semilla))
    .filter((e) => e.tipo === "combo").map((e) => accionesPorIds(e.ids));
  assert.ok(combos.length > 800, `solo ${combos.length} combinaciones`);
  return combos.filter(condicion).length / combos.length;
}

const terminaEnGancho = (c) => ultimoGolpe(c)?.familia === "gancho";
const bloquea = (c) => c.some((a) => a.familia === "bloqueo");
const empiezaConJab = (c) => c[0].id === "jab";
const NEUTRO = { termina_en_gancho: 1, bloquear_y_devolver: 1, entrada_con_jab: 1 };

test("sin pesos propios se usan los de data/perfil.json", () => {
  assert.equal(perfilGenerador(perfilPorDefecto()), datos.perfil);
});

test("los pesos del perfil sustituyen a los de data/perfil.json (no se mezclan)", () => {
  const pesos = { termina_en_gancho: 1.2, bloquear_y_devolver: 0.5, entrada_con_jab: 3 };
  const perfil = perfilGenerador(perfilCon(pesos));
  assert.deepEqual(perfil.pesos, pesos);
  assert.equal(perfil.proporcion_clasicos, datos.perfil.proporcion_clasicos);
});

for (const [peso, condicion] of [
  ["termina_en_gancho", terminaEnGancho],
  ["bloquear_y_devolver", bloquea],
  ["entrada_con_jab", empiezaConJab],
]) {
  test(`subir «${peso}» en el perfil hace más frecuentes esas combinaciones en el guion`, () => {
    const bajo = proporcion(perfilCon({ ...NEUTRO, [peso]: 0.5 }), condicion);
    const neutro = proporcion(perfilCon(NEUTRO), condicion);
    const alto = proporcion(perfilCon({ ...NEUTRO, [peso]: 4 }), condicion);
    assert.ok(bajo < neutro && neutro < alto, `${peso}: ${bajo.toFixed(2)} < ${neutro.toFixed(2)} < ${alto.toFixed(2)}`);
    assert.ok(alto - bajo > 0.1, `${peso}: la diferencia es solo de ${(alto - bajo).toFixed(2)}`);
  });
}

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
  const perfil = { ...perfilPorDefecto(), focos: ["jab"] };
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

test("tocar otras cosas del Perfil (pesos, focos, estilo, medidas) no pisa el nivel ni el zurdo de Entrenar", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  cambiarEnPerfil(almacen, "basicos", "guardia", "ortodoxa");
  cambiarEnPerfil(almacen, "basicos", "nivel", "1");
  recordarSesion(almacen, { nivel: 3, zurdo: true });
  cambiarEnPerfil(almacen, "basicos", "altura_cm", 180);
  cambiarEnPerfil(almacen, "estilo", "cardio", "bueno");
  const p = structuredClone(almacen.datos.perfil);
  p.pesos = { termina_en_gancho: 3, bloquear_y_devolver: 1, entrada_con_jab: 1 };
  p.focos.push("jab doble");
  almacen.guardarPerfil(p);
  assert.equal(preferencias(almacen.datos.perfil).nivel, 3);
  assert.equal(preferencias(almacen.datos.perfil).zurdo, true);
});
