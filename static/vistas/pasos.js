// Lo que se ve de cada paso de una combinación en la sesión: tipo, número del golpe y nombre
// corto. Sin DOM, para poder probarlo en Node. Los ids ya vienen en espejo para el zurdo (su 3
// es gancho_der) y el catálogo tiene las dos versiones; el número se lee por mano adelantada/trasera.
import { catalogo, nombreCorto, numero, palabrasNumero, textoHablado } from "../motor/acciones.js";

// null si algún id no está en el catálogo (p. ej. datos de una versión vieja).
export function pasosCombo(ids, { voz, zurdo }) {
  const acciones = ids.map((id) => catalogo().get(id));
  if (acciones.includes(undefined)) return null;
  return acciones.map((a) => ({
    tipo: a.tipo,
    numero: voz === "nombres" ? null : numero(a, zurdo),
    texto: nombreCorto(a),
  }));
}

// Cómo se dictó un texto guardado: las sesiones del servidor (y las locales más antiguas) no
// guardan la voz, pero sus números la delatan ("uno, dos": Números; "uno jab": Ambos).
export function vozDelTexto(texto) {
  const palabras = new Set(Object.values(palabrasNumero()));
  const partes = texto.split(", ");
  if (partes.some((p) => palabras.has(p))) return "numeros";
  if (partes.some((p) => palabras.has(p.split(" ")[0]))) return "ambos";
  return "nombres";
}

// Texto de una combinación guardada, rehecho desde sus ids con los nombres de hoy: el de una
// sesión vieja puede decir otra cosa (antes el crochet se llamaba «gancho»). Los ids ya vienen en
// espejo para el zurdo. Si algún id no está en el catálogo, el texto guardado.
export function textoGuardado(combo, { voz, zurdo }) {
  const acciones = combo.ids.map((id) => catalogo().get(id));
  if (!acciones.length || acciones.includes(undefined)) return combo.texto;
  return textoHablado(acciones, voz ?? vozDelTexto(combo.texto), Boolean(zurdo));
}
