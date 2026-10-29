// Cálculos del resumen del historial (lógica pura, sin DOM): totales de la semana y
// del mes (sesiones, asaltos y RPE medio), asaltos y RPE medio por semana (de lunes a domingo),
// mes o año para el gráfico, y los minutos de asalto.

export function lunes(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const mismoDia = (a, b) => a.getTime() === b.getTime();

const media = (lista) => (lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : null);

// sesiones: [{ clave, fecha, asaltos }]; valoraciones: { clave: { rpe } }.
// rpe: media de las sesiones valoradas, o null si no hay ninguna.
export function totales(sesiones, valoraciones = {}, hoy = new Date()) {
  const semana = lunes(hoy);
  const enSemana = sesiones.filter((s) => mismoDia(lunes(new Date(s.fecha)), semana));
  const enMes = sesiones.filter((s) => {
    const d = new Date(s.fecha);
    return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
  });
  const resumir = (lista) => ({
    sesiones: lista.length,
    asaltos: lista.reduce((n, s) => n + s.asaltos, 0),
    rpe: media(lista.map((s) => valoraciones[s.clave]?.rpe).filter((r) => r != null)),
  });
  return { semana: resumir(enSemana), mes: resumir(enMes) };
}

// Las últimas `n` semanas, la más antigua primero: { inicio, asaltos, sesiones, rpe (media o null) }.
export function porSemana(sesiones, valoraciones, { hoy = new Date(), n = 8 } = {}) {
  return porPeriodo(sesiones, valoraciones, "semana", { hoy, n });
}

// Cuántos periodos enseña el gráfico del Historial en cada escala. Los años van desde el
// primero con sesiones hasta el actual (al menos ANOS_MINIMOS, como mucho ANOS_MAXIMOS).
export const PERIODOS_GRAFICO = { semana: 8, mes: 12 };
const ANOS_MINIMOS = 3;
const ANOS_MAXIMOS = 10;

function anosGrafico(sesiones, hoy) {
  const primero = Math.min(hoy.getFullYear(), ...sesiones.map((s) => new Date(s.fecha).getFullYear()));
  return Math.min(Math.max(hoy.getFullYear() - primero + 1, ANOS_MINIMOS), ANOS_MAXIMOS);
}

// Los últimos `n` periodos (semanas, meses o años), el más antiguo primero:
// { inicio, asaltos, sesiones, rpe (media o null) }.
export function porPeriodo(sesiones, valoraciones, escala, { hoy = new Date(), n = PERIODOS_GRAFICO[escala] ?? anosGrafico(sesiones, hoy) } = {}) {
  const actual = inicioPeriodo(hoy, escala);
  const periodos = Array.from({ length: n }, (_, i) => ({
    inicio: moverPeriodo(actual, escala, i - (n - 1)), asaltos: 0, sesiones: 0, rpes: [],
  }));
  for (const s of sesiones) {
    const inicio = inicioPeriodo(new Date(s.fecha), escala);
    const periodo = periodos.find((x) => mismoDia(x.inicio, inicio));
    if (!periodo) continue;
    periodo.asaltos += s.asaltos;
    periodo.sesiones += 1;
    const rpe = valoraciones[s.clave]?.rpe;
    if (rpe != null) periodo.rpes.push(rpe);
  }
  return periodos.map(({ rpes, ...p }) => ({ ...p, rpe: media(rpes) }));
}

// El inicio del periodo `pasos` periodos antes (negativo) o después (positivo).
export function moverPeriodo(inicio, escala, pasos) {
  if (escala === "ano") return new Date(inicio.getFullYear() + pasos, 0, 1);
  if (escala === "mes") return new Date(inicio.getFullYear(), inicio.getMonth() + pasos, 1);
  return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 7 * pasos);
}

// ---- Periodos del Historial ----

export const AGRUPACIONES = ["semana", "mes", "ano"];

// Inicio del periodo (semana de lunes a domingo, mes o año natural) al que pertenece la fecha.
export function inicioPeriodo(fecha, modo) {
  if (modo === "mes") return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  if (modo === "ano") return new Date(fecha.getFullYear(), 0, 1);
  return lunes(fecha);
}

// Minutos de asalto de unas sesiones: asaltos completados × duración del asalto, sin descansos
// (de un asalto cortado a medias no se guarda cuánto duró). Redondeados al minuto.
export function minutosDeAsalto(sesiones) {
  return Math.round(sesiones.reduce((n, s) => n + (s.asaltos * (s.duracion_asalto ?? 0)) / 60, 0));
}

// «54 min», «2 h», «3 h 12 min».
export function textoMinutos(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const MES_CORTO = new Intl.DateTimeFormat("es-ES", { month: "short" });
const MES_LARGO = new Intl.DateTimeFormat("es-ES", { month: "long" });

// Título del periodo: «Semana del 26 oct» (con el año si no es el actual), «Octubre 2026» o «2026».
export function tituloGrupo(inicio, modo, hoy = new Date()) {
  if (modo === "ano") return String(inicio.getFullYear());
  if (modo === "mes") {
    const mes = MES_LARGO.format(inicio);
    return `${mes[0].toUpperCase()}${mes.slice(1)} ${inicio.getFullYear()}`;
  }
  const ano = inicio.getFullYear() === hoy.getFullYear() ? "" : ` ${inicio.getFullYear()}`;
  return `Semana del ${inicio.getDate()} ${MES_CORTO.format(inicio).replace(".", "")}${ano}`;
}
