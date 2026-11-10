// Port de tests/test_igual_que_antes.py: huella (sha256) de sorteos, coletillas y guiones con
// semilla, para comprobar que con la mezcla «Ninguna» todo sale exactamente igual que antes del
// creador de combinaciones. Regenerar (si cambia a propósito): node tests/js/igual_que_antes.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { perfilPorDefecto } from "../../static/almacen.js";
import { nuevoGuion } from "../../static/ajustes.js";
import { crearAzar } from "../../static/motor/azar.js";
import { SorteoBiblioteca, cargarPerfil } from "../../static/motor/sorteo.js";
import { CONFIG_POR_DEFECTO, construirGuion } from "../../static/motor/temporizador.js";
import { RAIZ, cargarDatosDeDisco } from "./datos.mjs";

export const FIJOS = join(RAIZ, "tests", "fijos", "igual_que_antes.json");
const PRACTICAR = [[], [{ movimiento: "6" }, { movimiento: "esquiva" }]];
const CONFIGS = [
  { nivel: 1 },
  { nivel: 2, modo_reaccion: true, ritmo: 5, voz: "ambos" },
  { nivel: 3, zurdo: true, voz: "numeros", ritmo: 1 },
  { asaltos: 2, duracion_asalto: 30, descanso: 10, nivel: 1, modo_reaccion: true },
];

// JSON con las claves ordenadas, como json.dumps(sort_keys=True).
function canonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor && typeof valor === "object") {
    return `{${Object.keys(valor).sort().map((k) => `${JSON.stringify(k)}:${canonico(valor[k])}`).join(",")}}`;
  }
  return JSON.stringify(valor);
}

export const huella = (valor) => createHash("sha256").update(canonico(valor)).digest("hex");

export const sorteoBiblioteca = (nivel, zurdo, azar, practicar) =>
  new SorteoBiblioteca(nivel, { perfil: { ...cargarPerfil(), practicar }, zurdo, azar });

// Huella de cada caso. `crearSorteo(nivel, zurdo, azar, practicar)` da el sorteo de los dos
// primeros bloques; `guionApp(config, azar)` el guion como lo pide la app.
export function casos(crearSorteo = sorteoBiblioteca,
  guionApp = (config, azar) => nuevoGuion(config, perfilPorDefecto(), azar)) {
  const resultado = {};
  for (const nivel of [1, 2, 3]) {
    for (const zurdo of [false, true]) {
      PRACTICAR.forEach((practicar, i) => {
        const s = crearSorteo(nivel, zurdo, crearAzar(10 * nivel + i), practicar);
        const sacadas = Array.from({ length: 60 }, () => s.siguiente().acciones.map((a) => a.id));
        const coletillas = s.coletillas().map((c) => c.acciones.map((a) => a.id));
        resultado[`sorteo-${nivel}-${zurdo}-${i}`] = huella([sacadas, coletillas]);
      });
    }
  }
  CONFIGS.forEach((extra, i) => {
    const config = { ...CONFIG_POR_DEFECTO, ...extra };
    for (let semilla = 0; semilla < 3; semilla++) {
      const azar = crearAzar(semilla); // el guion y el sorteo comparten azar, como en la app
      const s = crearSorteo(config.nivel, config.zurdo, azar, []);
      resultado[`guion-${i}-${semilla}`] = huella(construirGuion(config, azar, s));
      resultado[`app-${i}-${semilla}`] = huella(guionApp(config, crearAzar(semilla)));
    }
  });
  return resultado;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cargarDatosDeDisco();
  const datos = JSON.parse(readFileSync(FIJOS, "utf-8"));
  datos.js = casos();
  const ordenado = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  writeFileSync(FIJOS, `${JSON.stringify(ordenado({ ...datos, js: ordenado(datos.js) }), null, 1)}\n`);
}
