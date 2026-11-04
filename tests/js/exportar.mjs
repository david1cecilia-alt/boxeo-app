// Genera con el motor JS lo que valida tests/test_equivalencia_js.py: sorteos de la biblioteca
// por nivel y con "Practicar más", guiones de varias configuraciones, el espejo del catálogo y el nivel por número de
// acciones.
// Uso: node tests/js/exportar.mjs salida.json [combinaciones_por_nivel]
import { writeFileSync } from "node:fs";

import { nuevoGuion } from "../../static/ajustes.js";
import { perfilPorDefecto } from "../../static/almacen.js";
import { accionesPorIds, biblioteca, catalogo, espejo } from "../../static/motor/acciones.js";
import { crearAzar } from "../../static/motor/azar.js";
import { datos } from "../../static/motor/datos.js";
import { avisosCreador, nivelDe } from "../../static/motor/reglas.js";
import { VELOCIDAD_SENAL, segundosHabla } from "../../static/motor/ritmo.js";
import { SorteoBiblioteca, SorteoMezcla, cargarPerfil, identidad, movimientos, pesoPracticar } from "../../static/motor/sorteo.js";
import { construirGuion } from "../../static/motor/temporizador.js";
import { cargarDatosDeDisco } from "./datos.mjs";

cargarDatosDeDisco();

const N = Number(process.argv[3] ?? 5000); // combinaciones por nivel y guardia
const NIVELES = [1, 2, 3];

// Una acción con los mismos campos que la dataclass Accion de Python.
const accionPlana = (a) => ({ ...a });

// Sorteo de la biblioteca (lo que usa la sesión), con la misma semilla en ortodoxo y zurdo.
function sortear(nivel, zurdo, semilla, perfil = null) {
  const sorteo = new SorteoBiblioteca(nivel, { perfil, zurdo, azar: crearAzar(semilla) });
  return Array.from({ length: N }, () => sorteo.siguiente().acciones.map((a) => a.id));
}
const sorteos = {};
for (const nivel of NIVELES) {
  sorteos[nivel] = { ortodoxo: sortear(nivel, false, 300 + nivel), zurdo: sortear(nivel, true, 300 + nivel) };
}

// "Practicar más": sorteos de medio con varias elecciones y el peso de cada combinación.
const PRACTICAR = [
  [{ movimiento: "6", cuanto: "poco" }],
  [{ movimiento: "bloqueo", cuanto: "bastante" }],
  [{ movimiento: "cuerpo", cuanto: "poco" }, { movimiento: "esquiva", cuanto: "bastante" }],
  [{ movimiento: "1", cuanto: "bastante" }, { movimiento: "rodar", cuanto: "bastante" }, { movimiento: "pivote", cuanto: "poco" }],
];
const practicar = PRACTICAR.map((elegidos) => ({
  elegidos,
  sorteo: sortear(2, false, 200, { ...cargarPerfil(), practicar: elegidos }),
  pesos: biblioteca().map((c) => pesoPracticar(c.acciones, elegidos)),
}));

// Ventana por identidad: la biblioteca de cada nivel con cada combinación dos veces (la copia, con
// n + 1000). Se exporta el número de cada sacada.
const duplicadas = Object.fromEntries(NIVELES.map((nivel) => {
  const s = new SorteoBiblioteca(nivel, { azar: crearAzar(400 + nivel) });
  s.combos = [...s.combos, ...s.combos.map((c) => ({ ...c, n: c.n + 1000 }))];
  return [nivel, Array.from({ length: N }, () => (s.siguiente(), s.recientes.at(-1)))];
}));

// Sorteo mezclado con unas propias de cada nivel: de cada sacada, su identidad (n o id) y sus ids.
const PROPIAS = [
  ["jab", "jab", "directo"], ["esquiva_der", "gancho_izq"], ["directo_cuerpo", "gancho_izq", "salir", "bloqueo"],
  ["jab", "directo", "gancho_izq", "gancho_der", "uppercut_izq", "uppercut_der"],
  ["jab", "rodar_izq", "directo", "pivote", "jab"],
  ["jab", "directo", "esquiva_izq", "gancho_izq", "directo", "rodar_der", "gancho_der", "paso_atras"],
].map((ids, i) => ({ id: `p-${i}`, ids }));
function mezclar(nivel, mezcla, zurdo, semilla) {
  const s = new SorteoMezcla(nivel, { zurdo, azar: crearAzar(semilla), propias: PROPIAS, mezcla });
  return Array.from({ length: N }, () => {
    const c = s.siguiente();
    const grupo = c.origen === "propia" ? s.propias : s.biblioteca;
    // Con ventana 0 (una sola en el grupo) no se apunta nada: es esa.
    return [grupo.recientes.at(-1) ?? identidad(grupo.combos[0]), c.acciones.map((a) => a.id)];
  });
}
const mezclas = { propias: PROPIAS, sorteos: {} };
for (const mezcla of ["poco", "bastante", "mucho", "solo"]) {
  for (const nivel of NIVELES) mezclas.sorteos[`${mezcla}-${nivel}`] = mezclar(nivel, mezcla, false, 500 + nivel);
}
mezclas.zurdo = { ortodoxo: mezclar(2, "mucho", false, 600), zurdo: mezclar(2, "mucho", true, 600) };

const CONFIGS = [
  { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 1 },
  { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 1, ritmo: 1, voz: "numeros", zurdo: true },
  { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 2, modo_reaccion: true, ritmo: 5, voz: "ambos" },
  { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 3, modo_reaccion: true, zurdo: true, voz: "ambos" },
  { asaltos: 2, duracion_asalto: 30, descanso: 10, nivel: 1, modo_reaccion: true },
  { asaltos: 5, duracion_asalto: 120, descanso: 30, nivel: 2, pausa: 1.5 },
  { asaltos: 1, duracion_asalto: 20, descanso: 0, nivel: 3, modo_reaccion: true, pausa: 0 },
  { asaltos: 12, duracion_asalto: 600, descanso: 300, nivel: 3, zurdo: true, modo_reaccion: true, pausa: 30 },
  { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 2, voz: "ambos", velocidad: 0.9 },
  { asaltos: 3, duracion_asalto: 120, descanso: 30, nivel: 3, modo_reaccion: true, ritmo: 5, velocidad: 1.3 },
];
const guiones = [];
CONFIGS.forEach((config, i) => {
  for (let semilla = 0; semilla < 5; semilla++) {
    guiones.push({ config, semilla, eventos: construirGuion(config, crearAzar(1000 * i + semilla)) });
  }
});

// Cobertura en dos pasos: 200 sesiones «Amateur 3×3 min» por nivel; de cada una, los ids de lo dicho.
const cobertura = Object.fromEntries(NIVELES.map((nivel) => [nivel, Array.from({ length: 200 }, (_, semilla) =>
  construirGuion({ asaltos: 3, duracion_asalto: 180, descanso: 60, nivel }, crearAzar(9000 + 1000 * nivel + semilla))
    .filter((e) => e.tipo === "combo").map((e) => e.ids))]));

// Guiones con propias: cada mezcla, con y sin Reacción, en ortodoxo y zurdo. «Solo las mías» también
// con unas propias sin ninguna corta (las coletillas son entonces las de la biblioteca).
const SIN_CORTAS = PROPIAS.filter((p) => p.ids.length > 3);
const guionesMezcla = [];
[
  ["poco", PROPIAS, { nivel: 2 }],
  ["bastante", PROPIAS, { nivel: 1, modo_reaccion: true, zurdo: true, voz: "numeros" }],
  ["mucho", PROPIAS, { nivel: 3, modo_reaccion: true, voz: "ambos" }],
  ["solo", PROPIAS, { nivel: 2, modo_reaccion: true }],
  ["solo", PROPIAS, { nivel: 1, zurdo: true, ritmo: 5 }],
  ["solo", SIN_CORTAS, { nivel: 3, modo_reaccion: true, voz: "ambos" }],
  ["mucho", PROPIAS, { asaltos: 2, duracion_asalto: 30, descanso: 10, nivel: 2, modo_reaccion: true }],
].forEach(([mezcla, propias, extra], i) => {
  const config = { asaltos: 3, duracion_asalto: 180, descanso: 60, ...extra };
  for (let semilla = 0; semilla < 4; semilla++) {
    const azar = crearAzar(7000 + 10 * i + semilla);
    const sorteo = new SorteoMezcla(config.nivel, { zurdo: config.zurdo ?? false, azar, propias, mezcla });
    guionesMezcla.push({ config, semilla, mezcla, propias, eventos: construirGuion(config, azar, sorteo) });
  }
});

// Guiones de Entrenar tal cual (nuevoGuion, con «Practicar más»): «Mucho» y «Solo las mías» (también
// sin ninguna corta), con y sin Reacción, en ortodoxo y zurdo. Asaltos de 3 min en medio, velocidad
// normal: los del test de silencio final.
const PRACTICAR_ENTRENAR = [{ movimiento: "esquiva", cuanto: "bastante" }];
const guionesEntrenar = [];
[
  ["mucho", PROPIAS, {}],
  ["mucho", PROPIAS, { modo_reaccion: true, zurdo: true }],
  ["solo", PROPIAS, {}],
  ["solo", PROPIAS, { modo_reaccion: true, zurdo: true, voz: "numeros" }],
  ["solo", SIN_CORTAS, {}],
  ["solo", SIN_CORTAS, { modo_reaccion: true, voz: "ambos" }],
].forEach(([mezcla, propias, extra], i) => {
  const config = { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 2, ritmo: 3, pausa: null, voz: "nombres",
    zurdo: false, modo_reaccion: false, velocidad: 1.1, ...extra };
  const perfil = { ...perfilPorDefecto(), practicar: PRACTICAR_ENTRENAR };
  for (let semilla = 0; semilla < 10; semilla++) {
    const eventos = nuevoGuion({ ...config, mezcla }, perfil, crearAzar(8000 + 20 * i + semilla), propias);
    guionesEntrenar.push({ config, semilla, mezcla, propias, eventos });
  }
});

// Avisos del creador: cada combinación de la biblioteca y unas cuantas propias, con 0, 3 y 20 guardadas.
const GUARDADAS = [[], PROPIAS.slice(0, 3), Array.from({ length: 20 }, (_, i) => ({ id: `p-${i}`, ids: PROPIAS[i % 6].ids }))];
const CREADAS = [
  ...biblioteca().map((c) => c.acciones.map((a) => a.id)), ...PROPIAS.map((p) => p.ids),
  [], ["jab"], Array(10).fill("jab"), Array(11).fill("jab"), ["esquiva_der", "bloqueo", "pivote"], ["jab", "patada"],
];
const avisos = GUARDADAS.flatMap((propias) => CREADAS.flatMap((ids) => [null, "p-1"].map((editando) =>
  ({ ids, propias, editando, resultado: avisosCreador(ids, propias, editando) }))));

const espejos = Object.fromEntries([...catalogo().values()].map((a) => [a.id, accionPlana(espejo(a))]));

// Nivel de combinaciones de 0 a 12 acciones, alternando golpes, defensas y salidas.
const MEZCLA = ["jab", "rodar_der", "gancho_izq", "salir", "uppercut_der", "bloqueo"];
const niveles = Array.from({ length: 13 }, (_, n) => {
  const ids = Array.from({ length: n }, (_, i) => MEZCLA[i % MEZCLA.length]);
  return { ids, nivel: nivelDe(accionesPorIds(ids)) };
});

// Señales de Reacción: la velocidad fija a la que se dicen y lo que se estima que tardan.
const senales = {
  velocidad: VELOCIDAD_SENAL,
  segundos: Object.fromEntries(datos().presets.reacciones.map((r) => [r.texto, segundosHabla(r.texto, VELOCIDAD_SENAL)])),
};

writeFileSync(process.argv[2], JSON.stringify({ guiones, espejos, niveles, sorteos, senales, practicar, duplicadas, mezclas, guiones_mezcla: guionesMezcla, guiones_entrenar: guionesEntrenar, avisos, movimientos: movimientos(), cobertura }));
