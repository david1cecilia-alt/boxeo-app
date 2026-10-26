// Datos del motor (los mismos JSON de data/). Se inyectan: el navegador los carga
// con fetch y los tests de Node con fs, así el motor no sabe de dónde vienen.

const FICHEROS = ["acciones", "combos", "perfil", "presets"];

let actuales = null;

export function usarDatos(nuevos) {
  actuales = nuevos;
}

export async function cargarDatos(base = "data/") {
  const partes = await Promise.all(FICHEROS.map(async (nombre) => {
    const r = await fetch(`${base}${nombre}.json`);
    if (!r.ok) throw new Error(`No se pudo cargar ${nombre}.json`);
    return [nombre, await r.json()];
  }));
  usarDatos(Object.fromEntries(partes));
  return actuales;
}

export function datos() {
  if (!actuales) throw new Error("Datos del motor sin cargar: llama antes a cargarDatos()");
  return actuales;
}

// Cachea un cálculo mientras no cambien los datos (como lru_cache en Python).
export function segunDatos(calcular) {
  let fuente = null;
  let valor;
  return () => {
    if (fuente !== datos()) {
      fuente = datos();
      valor = calcular(fuente);
    }
    return valor;
  };
}
