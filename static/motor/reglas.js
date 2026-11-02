// Port de motor/reglas.py: reglas que debe cumplir toda combinación (en ortodoxo).
// Solo son estructurales: el boxeo es situacional, así que tras una defensa puede ir cualquier
// golpe, se puede acabar bloqueando y se puede repetir mano. El nivel lo da la longitud.
// validar() devuelve la lista de infracciones; lista vacía = combinación válida.

// Nivel por número total de acciones (golpes, defensas y salidas): 1 básico, 2 medio, 3 avanzado.
export const ACCIONES_POR_NIVEL = { 1: [2, 4], 2: [5, 6], 3: [7, 10] };
export const MAX_ACCIONES = 10;

// Ninguna acción tiene nivel mínimo: los golpes al cuerpo y todas las defensas valen desde básico.

function reglaTieneGolpe(combo) {
  if (!combo.some((a) => a.tipo === "golpe")) return "no hay ningún golpe";
}

export const REGLAS = [reglaTieneGolpe];

// Infracciones de la combinación (lista vacía si es válida).
export function validar(combo) {
  return REGLAS.map((regla) => regla(combo)).filter(Boolean);
}

export function esValida(combo) {
  return validar(combo).length === 0;
}

// Nivel de una combinación por su número de acciones: 2-4 básico, 5-6 medio, 7-10 avanzado.
// null si tiene menos de 2 o más de MAX_ACCIONES.
export function nivelDe(combo) {
  const nivel = Object.entries(ACCIONES_POR_NIVEL)
    .find(([, [minimo, maximo]]) => minimo <= combo.length && combo.length <= maximo);
  return nivel ? Number(nivel[0]) : null;
}

// El último GOLPE, aunque después vaya una salida (para los pesos del perfil).
export function ultimoGolpe(combo) {
  const golpes = combo.filter((a) => a.tipo === "golpe");
  return golpes.length ? golpes[golpes.length - 1] : null;
}
