// Port de motor/reglas.py: reglas que debe cumplir toda combinación (en ortodoxo).
// Solo son estructurales: el boxeo es situacional, así que tras una defensa puede ir cualquier
// golpe, se puede acabar bloqueando y se puede repetir mano. El nivel lo da la longitud.
// validar() devuelve la lista de infracciones; lista vacía = combinación válida.
import { accionesPorIds, biblioteca, catalogo } from "./acciones.js";

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

// ---------- Creador de combinaciones propias ----------

export const MAX_PROPIAS = 20; // cuántas combinaciones propias se pueden guardar
export const NOMBRE_NIVEL = { 1: "básico", 2: "medio", 3: "avanzado" };

// Lo que el creador dice de una combinación antes de guardarla (en ortodoxo).
// `propias`: las ya guardadas ([{ id, ids }], en su orden: la primera es «Combinación 1»);
// `editando`: el id de la que se edita, que ni cuenta para el máximo ni se compara consigo.
// Devuelve { nivel, avisos, puede_guardar, motivo }: los avisos ([{ tipo, texto, ... }]) no impiden
// guardar, solo se avisan; `motivo` dice por qué no se puede guardar (o null).
export function avisosCreador(ids, propias = [], editando = null) {
  const cat = catalogo();
  const conocidas = ids.every((i) => cat.has(i));
  const combo = conocidas ? accionesPorIds(ids) : [];
  const iguales = (a, b) => Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);
  const avisos = [];
  if (conocidas && ids.length && validar(combo).length) avisos.push({ tipo: "sin_golpes", texto: "No lleva ningún golpe." });
  const igual = biblioteca().find((c) => iguales(c.acciones.map((a) => a.id), ids));
  if (igual) {
    avisos.push({ tipo: "biblioteca", nivel: igual.nivel,
      texto: `Ya está en la biblioteca, en nivel ${NOMBRE_NIVEL[igual.nivel]}.` });
  }
  const repetida = propias.findIndex((p) => p.id !== editando && iguales(p.ids, ids));
  if (repetida >= 0) {
    avisos.push({ tipo: "propia", numero: repetida + 1, texto: `Es igual que tu combinación ${repetida + 1}.` });
  }
  const otras = propias.filter((p) => p.id !== editando).length;
  const minimo = ACCIONES_POR_NIVEL[1][0];
  let motivo = null;
  if (!conocidas) motivo = "Lleva una acción que la app no conoce.";
  else if (ids.length < minimo) motivo = `Añade al menos ${minimo} acciones.`;
  else if (ids.length > MAX_ACCIONES) motivo = `Como mucho ${MAX_ACCIONES} acciones.`;
  else if (otras >= MAX_PROPIAS) motivo = `Ya tienes ${MAX_PROPIAS} combinaciones: borra alguna para guardar otra.`;
  return { nivel: conocidas ? nivelDe(combo) : null, avisos, puede_guardar: motivo === null, motivo };
}
