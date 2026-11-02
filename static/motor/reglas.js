// Port de motor/reglas.py: reglas que debe cumplir toda combinación (en ortodoxo).
// Solo son estructurales: el boxeo es situacional, así que tras una defensa puede ir cualquier
// golpe, se puede acabar bloqueando y se puede repetir mano. El nivel lo da la longitud.
// validar() devuelve la lista de infracciones; lista vacía = combinación válida.

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

// El último GOLPE, aunque después vaya una salida (para los pesos del perfil).
export function ultimoGolpe(combo) {
  const golpes = combo.filter((a) => a.tipo === "golpe");
  return golpes.length ? golpes[golpes.length - 1] : null;
}
