// Genera con el motor JS lo que valida tests/test_equivalencia_js.py:
// combinaciones por nivel, guiones de varias configuraciones y el espejo del catálogo.
// Uso: node tests/js/exportar.mjs salida.json
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { catalogo, espejo } from "../../static/motor/acciones.js";
import { crearAzar } from "../../static/motor/azar.js";
import { usarDatos } from "../../static/motor/datos.js";
import { GeneradorCombos } from "../../static/motor/generador.js";
import { construirGuion } from "../../static/motor/temporizador.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const leer = (nombre) => JSON.parse(readFileSync(join(RAIZ, "data", `${nombre}.json`), "utf-8"));
usarDatos({ acciones: leer("acciones"), combos: leer("combos"), perfil: leer("perfil"), presets: leer("presets") });

const N = 1000;
const NIVELES = [1, 2, 3];

// Una acción con los mismos campos que la dataclass Accion de Python.
const accionPlana = (a) => ({ ...a });

function generar(nivel, zurdo, semilla) {
  const gen = new GeneradorCombos(nivel, { zurdo, azar: crearAzar(semilla) });
  return Array.from({ length: N }, () => {
    const c = gen.siguiente();
    return { origen: c.origen, texto: c.texto, acciones: c.acciones.map(accionPlana) };
  });
}

// Misma semilla para ortodoxo y zurdo: el zurdo debe ser exactamente su espejo.
const combos = {};
for (const nivel of NIVELES) {
  combos[nivel] = { ortodoxo: generar(nivel, false, 100 + nivel), zurdo: generar(nivel, true, 100 + nivel) };
}

const CONFIGS = [
  { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 1 },
  { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 2, modo_reaccion: true },
  { asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 3, modo_reaccion: true, zurdo: true },
  { asaltos: 2, duracion_asalto: 30, descanso: 10, nivel: 1, modo_reaccion: true },
  { asaltos: 5, duracion_asalto: 120, descanso: 30, nivel: 2, pausa: 1.5 },
  { asaltos: 1, duracion_asalto: 20, descanso: 0, nivel: 3, modo_reaccion: true, pausa: 0 },
  { asaltos: 12, duracion_asalto: 600, descanso: 300, nivel: 3, zurdo: true, modo_reaccion: true, pausa: 30 },
];
const guiones = [];
CONFIGS.forEach((config, i) => {
  for (let semilla = 0; semilla < 5; semilla++) {
    guiones.push({ config, semilla, eventos: construirGuion(config, crearAzar(1000 * i + semilla)) });
  }
});

const espejos = Object.fromEntries([...catalogo().values()].map((a) => [a.id, accionPlana(espejo(a))]));

writeFileSync(process.argv[2], JSON.stringify({ combos, guiones, espejos }));
