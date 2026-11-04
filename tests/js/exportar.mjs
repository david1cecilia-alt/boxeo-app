// Genera con el motor JS lo que valida tests/test_equivalencia_js.py: sorteos de la biblioteca
// por nivel y con "Practicar más", guiones de varias configuraciones, el espejo del catálogo y el nivel por número de
// acciones.
// Uso: node tests/js/exportar.mjs salida.json [combinaciones_por_nivel]
import { writeFileSync } from "node:fs";

import { accionesPorIds, biblioteca, catalogo, espejo } from "../../static/motor/acciones.js";
import { crearAzar } from "../../static/motor/azar.js";
import { datos } from "../../static/motor/datos.js";
import { nivelDe } from "../../static/motor/reglas.js";
import { VELOCIDAD_SENAL, segundosHabla } from "../../static/motor/ritmo.js";
import { SorteoBiblioteca, cargarPerfil, movimientos, pesoPracticar } from "../../static/motor/sorteo.js";
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

writeFileSync(process.argv[2], JSON.stringify({ guiones, espejos, niveles, sorteos, senales, practicar, duplicadas, movimientos: movimientos() }));
