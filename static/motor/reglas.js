// Port de motor/reglas.py: reglas técnicas que debe cumplir toda combinación (en ortodoxo).
// validar() devuelve la lista de infracciones; lista vacía = combinación válida.
import { espejoCombo, repeticionesPermitidas } from "./acciones.js";

// Número de acciones [mín, máx] por nivel.
export const LONGITUD = { 1: [2, 3], 2: [3, 4], 3: [4, 6] };

// Cargar y soltar: tras esta defensa, SI viene un golpe, debe ser uno de estos
// "familia|mano". Rodar se resuelve aparte: gancho del lado donde queda el peso.
export const SOLTAR_TRAS = {
  esquiva_der: new Set(["directo|der", "uppercut|der"]),
  esquiva_izq: new Set(["gancho|izq", "uppercut|izq"]),
  paso_atras: new Set(["directo|der"]),
};
// REVISAR CON ENTRENADOR: tras "parada" (para el jab) no impongo ningún golpe concreto.

// Acciones válidas para cerrar tras un golpe de poder en nivel 2 y 3.
export const FAMILIAS_SALIDA = new Set(["pivote", "paso_lateral", "esquiva", "rodar", "salir"]);

export const familiaMano = (a) => `${a.familia}|${a.mano}`;

function reglaLongitud(combo, nivel) {
  const [minimo, maximo] = LONGITUD[nivel];
  if (combo.length < minimo || combo.length > maximo) {
    return `longitud ${combo.length} fuera de ${minimo}-${maximo} para nivel ${nivel}`;
  }
}

function reglaNivelMinimo(combo, nivel) {
  const altas = combo.filter((a) => a.nivel_minimo > nivel).map((a) => a.id);
  if (altas.length) return `acciones de nivel superior: ${altas}`;
}

function reglaTieneGolpe(combo) {
  if (!combo.some((a) => a.tipo === "golpe")) return "no hay ningún golpe";
}

function reglaCargarYSoltar(combo) {
  for (let i = 0; i < combo.length - 1; i++) {
    const [defensa, siguiente] = [combo[i], combo[i + 1]];
    if (siguiente.tipo !== "golpe") continue; // solo obliga si después viene un golpe
    // REVISAR CON ENTRENADOR: rodar a la izquierda deja el peso a la izquierda → gancho de izquierda.
    const permitidos = defensa.familia === "rodar"
      ? new Set([`gancho|${defensa.peso_despues}`])
      : SOLTAR_TRAS[defensa.id];
    if (permitidos && !permitidos.has(familiaMano(siguiente))) {
      return `tras ${defensa.id} no va ${siguiente.id} (cargar y soltar)`;
    }
  }
}

function reglaBloquearYDevolver(combo) {
  for (let i = 0; i < combo.length; i++) {
    if (combo[i].familia !== "bloqueo") continue;
    if (i === combo.length - 1) return "la combinación termina en bloqueo";
    if (combo[i + 1].tipo !== "golpe") return `tras el bloqueo va ${combo[i + 1].id}, no un golpe`;
  }
}

function reglaAlternarManos(combo) {
  const permitidas = repeticionesPermitidas();
  for (let i = 0; i < combo.length - 1; i++) {
    const [a, b] = [combo[i], combo[i + 1]];
    if (a.tipo === "golpe" && b.tipo === "golpe" && a.mano === b.mano && !permitidas.has(`${a.id}|${b.id}`)) {
      return `${a.id} y ${b.id} repiten mano sin ser excepción`;
    }
  }
  for (let i = 0; i < combo.length - 2; i++) {
    const [a, b, c] = [combo[i], combo[i + 1], combo[i + 2]];
    if ([a, b, c].every((x) => x.tipo === "golpe") && a.mano === b.mano && b.mano === c.mano
        && !permitidas.has(`${a.id}|${b.id}|${c.id}`)) {
      return `tres golpes seguidos con la misma mano (${a.id}, ${b.id}, ${c.id})`;
    }
  }
}

function reglaSalidaTrasPoder(combo, nivel) {
  if (nivel < 2) return; // nivel 1: puede terminar en golpe de poder sin salida
  const ultima = combo[combo.length - 1];
  if (ultima.tipo === "golpe" && ultima.poder) {
    return `nivel ${nivel}: termina en golpe de poder (${ultima.id}) sin salida`;
  }
  if (ultima.tipo !== "golpe" && !FAMILIAS_SALIDA.has(ultima.familia)) {
    return `${ultima.id} no es una salida válida`;
  }
}

export const REGLAS = [
  reglaLongitud,
  reglaNivelMinimo,
  reglaTieneGolpe,
  reglaCargarYSoltar,
  reglaBloquearYDevolver,
  reglaAlternarManos,
  reglaSalidaTrasPoder,
];

// Las que debe pasar la biblioteca (data/combinaciones.json): la longitud y la salida tras
// golpe de poder solo valen para las combinaciones inventadas (decisión del usuario).
export const REGLAS_TECNICAS = [
  reglaNivelMinimo,
  reglaTieneGolpe,
  reglaCargarYSoltar,
  reglaBloquearYDevolver,
  reglaAlternarManos,
];

// Infracciones de la combinación. Si es zurda, se valida su espejo ortodoxo.
export function validar(combo, nivel, zurdo = false, reglas = REGLAS) {
  if (zurdo) combo = espejoCombo(combo);
  return reglas.map((regla) => regla(combo, nivel)).filter(Boolean);
}

export function esValida(combo, nivel, zurdo = false, reglas = REGLAS) {
  return validar(combo, nivel, zurdo, reglas).length === 0;
}

// El último GOLPE, aunque después vaya una salida (para los pesos del perfil).
export function ultimoGolpe(combo) {
  const golpes = combo.filter((a) => a.tipo === "golpe");
  return golpes.length ? golpes[golpes.length - 1] : null;
}
