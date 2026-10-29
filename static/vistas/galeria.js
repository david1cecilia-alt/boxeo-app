// Historial como una galería de fotos (lógica pura, sin DOM): cada vista es un nivel de zoom.
// Año (12 meses) → Mes (sus semanas) → Semana (sus 7 días) → Día (sus sesiones) → detalle.
// La vista va en la ruta (#historial/<ruta>), así el gesto atrás del navegador también funciona:
//   semana/2026-10-26 · dia/2026-10-28 · mes/2026-10 · ano/2026 · <clave de la sesión>
// Sin ruta, el periodo actual del nivel elegido (perfil.historial.agrupar).
import { AGRUPACIONES, inicioPeriodo, lunes, minutosDeAsalto, moverPeriodo } from "./resumen.js";

const dosCifras = (n) => String(n).padStart(2, "0");
const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mismoDia = (a, b) => a.getTime() === b.getTime();
const diaDe = (s) => {
  const d = new Date(s.fecha);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// «2026-10-28» del día (en hora local).
export const isoDia = (d) => `${d.getFullYear()}-${dosCifras(d.getMonth() + 1)}-${dosCifras(d.getDate())}`;

function leerDia(texto) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isoDia(d) === texto ? d : null; // descarta «2026-02-31»
}

// Qué enseña la ruta: { nivel: "semana" | "mes" | "ano" | "dia", inicio } o { nivel: "sesion", clave }.
// Una ruta vacía o que no se entiende enseña el periodo actual de `porDefecto`.
export function leerRuta(ruta = "", porDefecto = "semana", hoy = new Date()) {
  const [tipo, valor = "", ...resto] = ruta.split("/");
  if (!resto.length) {
    if (tipo === "semana" || tipo === "dia") {
      const d = leerDia(valor);
      if (d) return { nivel: tipo, inicio: tipo === "semana" ? lunes(d) : d };
    }
    const mes = /^(\d{4})-(\d{2})$/.exec(valor);
    if (tipo === "mes" && mes && Number(mes[2]) >= 1 && Number(mes[2]) <= 12) {
      return { nivel: "mes", inicio: new Date(Number(mes[1]), Number(mes[2]) - 1, 1) };
    }
    if (tipo === "ano" && /^\d{4}$/.test(valor)) return { nivel: "ano", inicio: new Date(Number(valor), 0, 1) };
  }
  // Las claves de las sesiones son «origen:id» (local:…, servidor:…).
  if (ruta.includes(":")) return { nivel: "sesion", clave: ruta };
  const nivel = AGRUPACIONES.includes(porDefecto) ? porDefecto : "semana";
  return { nivel, inicio: inicioPeriodo(hoy, nivel) };
}

// La ruta de un periodo: escribirRuta("semana", fecha) → «semana/2026-10-26» (su lunes).
export function escribirRuta(nivel, fecha) {
  if (nivel === "ano") return `ano/${fecha.getFullYear()}`;
  if (nivel === "mes") return `mes/${fecha.getFullYear()}-${dosCifras(fecha.getMonth() + 1)}`;
  if (nivel === "dia") return `dia/${isoDia(fecha)}`;
  return `semana/${isoDia(lunes(fecha))}`;
}

const sesionesEntre = (sesiones, desde, hasta) =>
  sesiones.filter((s) => { const d = diaDe(s); return d >= desde && d < hasta; });

// Los 7 días de la semana (de lunes a domingo, siempre los 7):
// { fecha, sesiones, hoy, futuro }. Las sesiones conservan el orden de la lista.
export function diasDeSemana(sesiones, inicio, hoy = new Date()) {
  const hoyDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(lunes(inicio), i);
    return {
      fecha, sesiones: sesiones.filter((s) => mismoDia(diaDe(s), fecha)),
      hoy: mismoDia(fecha, hoyDia), futuro: fecha > hoyDia,
    };
  });
}

// Las semanas que tocan el mes (de 4 a 6, de lunes a domingo, como un calendario):
// { inicio, fin (domingo), sesiones (de toda la semana), minutos, actual, futuro }.
export function semanasDelMes(sesiones, inicio, hoy = new Date()) {
  const primero = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const siguiente = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
  const actual = lunes(hoy);
  const semanas = [];
  for (let l = lunes(primero); l < siguiente; l = sumarDias(l, 7)) {
    const de = sesionesEntre(sesiones, l, sumarDias(l, 7));
    semanas.push({ inicio: l, fin: sumarDias(l, 6), sesiones: de, minutos: minutosDeAsalto(de),
      actual: mismoDia(l, actual), futuro: l > actual });
  }
  return semanas;
}

// Los 12 meses del año: { inicio, sesiones, minutos, actual, futuro }.
export function mesesDelAno(sesiones, inicio, hoy = new Date()) {
  const actual = inicioPeriodo(hoy, "mes");
  return Array.from({ length: 12 }, (_, i) => {
    const mes = new Date(inicio.getFullYear(), i, 1);
    const de = sesionesEntre(sesiones, mes, new Date(inicio.getFullYear(), i + 1, 1));
    return { inicio: mes, sesiones: de, minutos: minutosDeAsalto(de), actual: mismoDia(mes, actual), futuro: mes > actual };
  });
}

// Hasta dónde llevan las flechas ‹ ›: del periodo de la sesión más antigua al actual (no se
// navega al futuro). Devuelve { anterior, siguiente }: el inicio de cada uno o null.
export function vecinos(sesiones, nivel, inicio, hoy = new Date()) {
  const escala = nivel === "dia" ? "semana" : nivel;
  const desde = inicioPeriodo(inicio, escala);
  const actual = inicioPeriodo(hoy, escala);
  const fechas = sesiones.map((s) => diaDe(s).getTime());
  const primero = fechas.length ? inicioPeriodo(new Date(Math.min(...fechas)), escala) : actual;
  return {
    anterior: desde > primero ? moverPeriodo(desde, escala, -1) : null,
    siguiente: desde < actual ? moverPeriodo(desde, escala, 1) : null,
  };
}

// Al cambiar de nivel con el selector Semana / Mes / Año: si se está viendo el periodo actual
// (o algo dentro de él), el actual del nivel nuevo; si no, el que contiene el inicio del que se ve.
export function alCambiarDeNivel(vista, nivel, hoy = new Date()) {
  const fecha = vista.inicio ?? hoy;
  const escala = vista.nivel === "dia" ? "semana" : vista.nivel;
  const actual = AGRUPACIONES.includes(escala) && mismoDia(inicioPeriodo(fecha, escala), inicioPeriodo(hoy, escala));
  return escribirRuta(nivel, actual ? hoy : fecha);
}

// El nivel de arriba (botón «Volver» y tras borrar una sesión): detalle → su día (o su semana si
// ese día solo tiene esa sesión, que se abrió directamente) → semana. Null si no hay nivel de arriba.
export function rutaDeArriba(vista, sesiones) {
  if (vista.nivel === "dia") return escribirRuta("semana", vista.inicio);
  if (vista.nivel !== "sesion") return null;
  const sesion = sesiones.find((s) => s.clave === vista.clave);
  if (!sesion) return "";
  const dia = diaDe(sesion);
  const delDia = sesiones.filter((s) => mismoDia(diaDe(s), dia)).length;
  return escribirRuta(delDia > 1 ? "dia" : "semana", dia);
}

// A dónde lleva pulsar un día: a sus sesiones o, si solo tiene una, directamente a su detalle.
export function rutaDelDia(dia) {
  if (!dia.sesiones.length) return null;
  return dia.sesiones.length === 1 ? dia.sesiones[0].clave : escribirRuta("dia", dia.fecha);
}

// La semana que se pinta en una vista de día o de detalle (la del día o la de la sesión).
export function semanaDeLaVista(vista, sesiones) {
  if (vista.nivel === "semana" || vista.nivel === "dia") return lunes(vista.inicio);
  const sesion = vista.nivel === "sesion" && sesiones.find((s) => s.clave === vista.clave);
  return sesion ? lunes(diaDe(sesion)) : null;
}

// El día abierto en la vista: el de la ruta o el de la sesión elegida.
export function diaDeLaVista(vista, sesiones) {
  if (vista.nivel === "dia") return vista.inicio;
  const sesion = vista.nivel === "sesion" && sesiones.find((s) => s.clave === vista.clave);
  return sesion ? diaDe(sesion) : null;
}
