// Port de motor/acciones.py: vocabulario de acciones y modo zurdo (espejo).
// Las acciones son objetos congelados con los mismos campos que la dataclass Accion.
import { segunDatos } from "./datos.js";

const PALABRA = { izq: "izquierda", der: "derecha" };
const PALABRA_CORTA = { izq: "izq.", der: "dcha." };
const LADO_CONTRARIO = { izq: "der", der: "izq" };
const CAMPOS = ["id", "familia", "plantilla", "tipo", "mano", "objetivo", "peso_despues",
  "nivel_minimo", "lado", "poder", "plantilla_corta"];

export function nombreHablado(a) {
  // El nombre se genera a partir de mano/lado, nunca reemplazando texto.
  return a.plantilla.replace("{mano}", PALABRA[a.mano] ?? "").replace("{lado}", PALABRA[a.lado] ?? "");
}

// Igual que el hablado pero abreviado ("gancho dcha."): lo que se lee en la sesión.
export function nombreCorto(a) {
  return a.plantilla_corta.replace("{mano}", PALABRA_CORTA[a.mano] ?? "").replace("{lado}", PALABRA_CORTA[a.lado] ?? "");
}

function desdeJson(d) {
  return Object.freeze({
    id: d.id, familia: d.familia, plantilla: d.nombre_hablado, tipo: d.tipo, mano: d.mano,
    objetivo: d.objetivo, peso_despues: d.peso_despues, nivel_minimo: d.nivel_minimo,
    lado: d.lado ?? "ninguno", poder: d.poder ?? false, plantilla_corta: d.nombre_corto,
  });
}

// Todas las acciones ortodoxas indexadas por id (en el orden del JSON).
export const catalogo = segunDatos((d) => new Map(d.acciones.acciones.map((a) => [a.id, desdeJson(a)])));

// Pares de la misma mano que sí están permitidos, como "id1|id2".
export const repeticionesPermitidas = segunDatos(
  (d) => new Set(d.acciones.repeticiones_permitidas.map((r) => r.ids.join("|"))));

export function accionesPorIds(ids) {
  const cat = catalogo();
  return ids.map((i) => cat.get(i));
}

// Biblioteca de combinaciones escritas a mano (data/combos.json).
export const combosClasicos = segunDatos((d) => d.combos.combos.map((c) => Object.freeze({
  nombre: c.nombre, nivel: c.nivel, acciones: accionesPorIds(c.ids),
})));

function contrario(valor) {
  return LADO_CONTRARIO[valor] ?? valor;
}

function igualesSalvoId(a, b) {
  return CAMPOS.every((campo) => campo === "id" || a[campo] === b[campo]);
}

/**
 * Refleja izquierda ↔ derecha (mano, lado y peso).
 * Si en el catálogo existe la acción simétrica (gancho_izq ↔ gancho_der) se devuelve
 * esa, con su id. Si no (jab, directo, paso atrás...) se devuelve la misma acción con
 * los campos reflejados: el jab de un zurdo es con la derecha pero se sigue llamando "jab".
 */
export function espejo(accion) {
  const reflejada = Object.freeze({
    ...accion, mano: contrario(accion.mano), lado: contrario(accion.lado),
    peso_despues: contrario(accion.peso_despues),
  });
  for (const candidata of catalogo().values()) {
    if (igualesSalvoId(reflejada, candidata)) return candidata;
  }
  return reflejada;
}

export function espejoCombo(combo) {
  return combo.map(espejo);
}
