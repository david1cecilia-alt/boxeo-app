// Lo que se ve de cada paso de una combinación en la sesión: tipo, número del golpe y nombre
// corto. Sin DOM, para poder probarlo en Node. Los ids ya vienen en espejo para el zurdo (su 3
// es gancho_der) y el catálogo tiene las dos versiones; el número se lee por mano adelantada/trasera.
import { catalogo, nombreCorto, numero, palabraHablada, palabrasNumero } from "../motor/acciones.js";

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

// Cómo se dictó una sesión guardada: la voz que guardó o, si no la guardó, deducida UNA vez de
// todas sus combinaciones (no de cada una: una sin golpes con número no delata nada). Solo
// cuentan las que llevan algún golpe del 1 al 6: los únicos con número cuando no se guardaba la
// voz (una de solo golpes al cuerpo se dictaba con su nombre en todos los modos). Si no hay
// ninguna o no coinciden, «ambos»: en pantalla da el número y el nombre, así no se pierde nada.
export function vozDeSesion(sesion, combinaciones) {
  if (sesion.voz) return sesion.voz;
  const de1a6 = (id) => catalogo().get(id)?.objetivo === "cabeza" && catalogo().get(id)?.numero != null;
  const votos = new Set(combinaciones
    .filter((c) => c.ids.some(de1a6))
    .map((c) => vozDelTexto(c.texto)));
  return votos.size === 1 ? [...votos][0] : "ambos";
}

// Lo que se ve de una acción en una lista: como se dice, pero con el número en cifra ("1 jab", "3").
function palabraEscrita(accion, voz, zurdo) {
  const nombre = palabraHablada(accion, "nombres", zurdo);
  const n = numero(accion, zurdo);
  if (n === null || voz === "nombres") return nombre;
  return voz === "numeros" ? String(n) : `${n} ${nombre}`;
}

// Combinaciones guardadas listas para verlas (Historial, valoración): el texto se rehace desde
// los ids con los nombres de hoy (antes el crochet se llamaba «gancho») y los números en cifra,
// con una sola voz para toda la sesión. Los ids ya vienen en espejo para el zurdo. Si algún id no
// está en el catálogo, esa combinación se queda con su texto guardado.
export function combinacionesParaVer(sesion, combinaciones) {
  const voz = vozDeSesion(sesion, combinaciones);
  return combinaciones.map((c) => {
    const acciones = c.ids.map((id) => catalogo().get(id));
    if (!acciones.length || acciones.includes(undefined)) return c;
    return { ...c, texto: acciones.map((a) => palabraEscrita(a, voz, Boolean(sesion.zurdo))).join(", ") };
  });
}
