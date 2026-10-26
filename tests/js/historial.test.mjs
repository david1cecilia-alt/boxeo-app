import assert from "node:assert/strict";
import { test } from "node:test";

import { crearAlmacen } from "../../static/almacen.js";
import { crearHistorial } from "../../static/historial.js";

function almacenamiento() {
  const mapa = new Map();
  return { getItem: (k) => mapa.get(k) ?? null, setItem: (k, v) => mapa.set(k, v), removeItem: (k) => mapa.delete(k) };
}

// Sin servidor (fetch falla): el historial sale del almacén.
globalThis.fetch = async () => { throw new Error("sin red"); };

test("sin servidor, lista las sesiones locales de la más reciente a la más antigua", async () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  const historial = await crearHistorial(almacen);
  assert.equal(historial.origen, "local");
  for (const fecha of ["2026-10-26T18:15:00", "2026-10-20T09:00:00", "2026-10-26T11:23:00"]) {
    await historial.guardar({ fecha, asaltos: 1, combinaciones: [] });
  }
  const fechas = (await historial.listar()).map((s) => s.fecha);
  assert.deepEqual(fechas, ["2026-10-26T18:15:00", "2026-10-26T11:23:00", "2026-10-20T09:00:00"]);
});

test("borrar una sesión local borra también su valoración", async () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  const historial = await crearHistorial(almacen);
  const id = await historial.guardar({ asaltos: 1, combinaciones: [] });
  const [{ clave }] = await historial.listar();
  almacen.guardarValoracion(clave, { rpe: 5 });
  await historial.borrar(id);
  assert.deepEqual(await historial.listar(), []);
  assert.equal(almacen.valoracion(clave), null);
});
