// Lo que se ve de cada paso de una combinación en la sesión: tipo, número del golpe y nombre
// corto. Sin DOM, para poder probarlo en Node. Los ids ya vienen en espejo para el zurdo (su 3
// es gancho_der) y el catálogo tiene las dos versiones; el número se lee por mano adelantada/trasera.
import { catalogo, nombreCorto, numero } from "../motor/acciones.js";

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
