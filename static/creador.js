// Lógica de la pantalla «Mis combinaciones» (el creador), sin DOM para poder probarla en Node.
// El editor trabaja en guardia ortodoxa: lo que se ve son los ids tal cual (el zurdo los recibe en
// espejo en la sesión). Los textos de baldosas y fichas salen del catálogo (data/acciones.json), los
// avisos y si se puede guardar, de motor/reglas.js. Aquí solo se decide qué se enseña y cómo se dice.
import { accionesPorIds, catalogo, nombreCorto, numero, textoHablado } from "./motor/acciones.js";
import { ACCIONES_POR_NIVEL, MAX_ACCIONES, MAX_PROPIAS, NOMBRE_NIVEL, avisosCreador, nivelDe } from "./motor/reglas.js";

export const MIN_ACCIONES = ACCIONES_POR_NIVEL[1][0];
export const GRUPOS = { golpe: "Golpes", defensa: "Defensas", movimiento: "Salidas" };

export const TEXTO_MINIMO = `Mínimo ${MIN_ACCIONES}`;
export const TEXTO_MAXIMO = `Máximo ${MAX_ACCIONES} acciones`;
export const TEXTO_LLENO = `Ya tienes ${MAX_PROPIAS} combinaciones: borra alguna para crear otra.`;

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const acciones = (n) => `${n} ${n === 1 ? "acción" : "acciones"}`;

// Nombre del nivel para la pantalla («Básico»), o null.
export const nombreNivel = (nivel) => (nivel ? mayuscula(NOMBRE_NIVEL[nivel]) : null);

// Lo que se ve de una acción: tipo (golpe, defensa, movimiento), número (solo golpes) y nombre corto.
export function ficha(id) {
  const a = catalogo().get(id);
  return { id, tipo: a.tipo, numero: numero(a), texto: nombreCorto(a) };
}

// Las baldosas de un grupo, en el orden de data/acciones.json. En Golpes, las seis a la cara o, con
// «Al cuerpo», las seis al cuerpo.
export function baldosas(grupo, alCuerpo = false) {
  return [...catalogo().values()]
    .filter((a) => a.tipo === grupo && (grupo !== "golpe" || (a.objetivo === "cuerpo") === alCuerpo))
    .map((a) => ficha(a.id));
}

// Cómo la oye un lector de pantalla: con los nombres enteros («recto al cuerpo»).
export const textoParaLectores = (ids) => textoHablado(accionesPorIds(ids), "nombres", false);

// ---------- Estado del editor (inmutable: cada cambio devuelve uno nuevo) ----------

export function editorNuevo(ids = []) {
  return { ids: [...ids], original: [...ids], alCuerpo: false, grupo: "golpe" };
}

// Añade al final (como mucho MAX_ACCIONES). «Al cuerpo» se apaga solo después de cada golpe.
export function anadir(estado, id) {
  if (estado.ids.length >= MAX_ACCIONES || !catalogo().has(id)) return estado;
  const golpe = catalogo().get(id).tipo === "golpe";
  return { ...estado, ids: [...estado.ids, id], alCuerpo: golpe ? false : estado.alCuerpo };
}

export function quitar(estado, indice) {
  if (indice < 0 || indice >= estado.ids.length) return estado;
  return { ...estado, ids: estado.ids.filter((_, i) => i !== indice) };
}

export const quitarUltima = (estado) => quitar(estado, estado.ids.length - 1);

export const cambiarCuerpo = (estado, alCuerpo) => ({ ...estado, alCuerpo });
export const elegirGrupo = (estado, grupo) => ({ ...estado, grupo });

export const hayCambios = (estado) =>
  estado.ids.length !== estado.original.length || estado.ids.some((id, i) => id !== estado.original[i]);

// Todo lo que el editor enseña de la combinación: nivel, contador, si se puede guardar (y por qué
// no), si la paleta está llena y los avisos del motor. `editando`: id de la propia que se edita.
export function resumen(ids, propias, editando = null) {
  const r = avisosCreador(ids, propias, editando);
  const lleno = ids.length >= MAX_ACCIONES;
  let motivo = null;
  if (ids.length < MIN_ACCIONES) motivo = TEXTO_MINIMO;
  else if (!r.puede_guardar) motivo = r.motivo;
  return {
    nivel: r.nivel,
    textoNivel: nombreNivel(r.nivel),
    contador: `${ids.length} de ${MAX_ACCIONES} acciones`,
    puedeGuardar: r.puede_guardar,
    motivo,
    lleno,
    motivoPaleta: lleno ? TEXTO_MAXIMO : null,
    avisos: r.avisos,
  };
}

// Lo que oye el lector de pantalla tras añadir o quitar: «Añadido recto abajo. 3 acciones, básico.»
export function anuncio(verbo, id, ids) {
  const nivel = nivelDe(ids);
  return `${verbo} ${ficha(id).texto}. ${acciones(ids.length)}${nivel ? `, ${NOMBRE_NIVEL[nivel]}` : ""}.`;
}

// ---------- Listado ----------

// Se puede crear otra mientras haya menos de MAX_PROPIAS.
export function puedeCrear(propias) {
  const puede = propias.length < MAX_PROPIAS;
  return { puede, motivo: puede ? null : TEXTO_LLENO };
}

// Cada propia, lista para el listado: «Combinación N», su nivel y sus fichas. Las que lleven un id
// que la app no conoce (copia de otra versión) se enseñan sin esas acciones.
export function combinacionesParaListar(propias) {
  return propias.map((p, i) => {
    const ids = p.ids.filter((id) => catalogo().has(id));
    return {
      id: p.id, numero: i + 1, titulo: `Combinación ${i + 1}`,
      nivel: nivelDe(ids), textoNivel: nombreNivel(nivelDe(ids)),
      fichas: ids.map(ficha), hablado: textoParaLectores(ids),
    };
  });
}

// Confirmación de borrar la combinación `numero` de `total`: si no es la última, las siguientes se
// renumeran y se dice.
export function textoBorrar(numero_, total) {
  const titulo = `¿Borrar la combinación ${numero_}?`;
  if (numero_ >= total) return { titulo, detalle: "No se puede deshacer." };
  const siguiente = numero_ + 1;
  const detalle = siguiente === total
    ? `No se puede deshacer. La combinación ${siguiente} pasará a ser la ${numero_}.`
    : `No se puede deshacer. Las siguientes se renumeran: la ${siguiente} pasará a ser la ${numero_}, y así hasta la ${total}.`;
  return { titulo, detalle };
}
