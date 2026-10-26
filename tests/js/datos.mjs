// Carga los JSON de data/ en el motor JS (en el navegador lo hace cargarDatos con fetch).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { usarDatos } from "../../static/motor/datos.js";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function leerJson(nombre) {
  return JSON.parse(readFileSync(join(RAIZ, "data", `${nombre}.json`), "utf-8"));
}

export function cargarDatosDeDisco() {
  const datos = Object.fromEntries(["acciones", "combos", "perfil", "presets"].map((n) => [n, leerJson(n)]));
  usarDatos(datos);
  return datos;
}
