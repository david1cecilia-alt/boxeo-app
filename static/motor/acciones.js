// Port de motor/acciones.py: vocabulario de acciones y modo zurdo (espejo).
// Las acciones son objetos congelados con los mismos campos que la dataclass Accion.
import { segunDatos } from "./datos.js";

const PALABRA = { izq: "izquierda", der: "derecha" };
const PALABRA_CORTA = { izq: "izq.", der: "dcha." };
const LADO_CONTRARIO = { izq: "der", der: "izq" };
const CAMPOS = ["id", "familia", "plantilla", "tipo", "mano", "objetivo", "peso_despues",
  "nivel_minimo", "lado", "poder", "plantilla_corta", "numero", "orden"];

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
    numero: d.numero ?? null, orden: d.orden ?? "",
  });
}

// Todas las acciones ortodoxas indexadas por id (en el orden del JSON).
export const catalogo = segunDatos((d) => new Map(d.acciones.acciones.map((a) => [a.id, desdeJson(a)])));

// Pares (o tríos) de la misma mano que sí están permitidos, como "id1|id2".
export const repeticionesPermitidas = segunDatos(
  (d) => new Set(d.acciones.repeticiones_permitidas.map((r) => r.ids.join("|"))));

export const palabrasNumero = segunDatos((d) => d.acciones.palabras_numero);

export function accionesPorIds(ids) {
  const cat = catalogo();
  return ids.map((i) => cat.get(i));
}

// Combinaciones escritas a mano (data/combinaciones.json), en ortodoxo.
export const biblioteca = segunDatos((d) => d.combinaciones.combinaciones.map((c) => {
  const acciones = accionesPorIds(c.ids);
  return Object.freeze({
    notacion: c.notacion, nivel: c.nivel, acciones, nombre: c.nombre ?? null,
    conDefensa: acciones.some((a) => a.tipo === "defensa"),
  });
}));

// Proporción de combinaciones con defensa en la sesión, por nivel.
export const defensaPorNivel = segunDatos((d) => d.combinaciones.defensa_por_nivel);

// Como "1-2-esquiva-2": número de cada golpe (en ortodoxo), orden de cada defensa o su id.
export function notacion(acciones) {
  return acciones.map((a) => (a.numero ? String(a.numero) : a.orden || a.id)).join("-");
}

function contrario(valor) {
  return LADO_CONTRARIO[valor] ?? valor;
}

// El número no cuenta: el de gancho_izq (3) y el de gancho_der (4) son distintos.
function igualesSalvoId(a, b) {
  return CAMPOS.every((campo) => campo === "id" || campo === "numero" || a[campo] === b[campo]);
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

// Cómo se dicen las combinaciones en la sesión ("Cómo te las digo").
export const MODOS_VOZ = ["numeros", "nombres", "ambos"];

// Número del golpe por mano adelantada/trasera. El de un zurdo se lee de su espejo
// ortodoxo: su gancho de derecha es el gancho adelantado, el 3.
export function numero(accion, zurdo = false) {
  return (zurdo ? espejo(accion) : accion).numero;
}

// Lo que se dice de una acción: las defensas, su orden corta; los golpes con número,
// el número, el nombre o los dos ("uno jab").
export function palabraHablada(accion, modo = "nombres", zurdo = false) {
  const nombre = accion.orden || nombreHablado(accion);
  const n = numero(accion, zurdo);
  if (n === null || modo === "nombres") return nombre;
  const palabra = palabrasNumero()[n];
  return modo === "numeros" ? palabra : `${palabra} ${nombre}`;
}

export function textoHablado(acciones, modo = "nombres", zurdo = false) {
  return acciones.map((a) => palabraHablada(a, modo, zurdo)).join(", ");
}
