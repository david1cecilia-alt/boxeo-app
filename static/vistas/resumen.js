// Cálculos del resumen del historial (lógica pura, sin DOM): totales de la semana y
// del mes (sesiones, asaltos y RPE medio), asaltos y RPE medio por semana (de lunes a domingo)
// y la lista agrupada por semana, mes o año con sus sesiones y minutos.

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
  const actual = lunes(hoy);
  const semanas = Array.from({ length: n }, (_, i) => {
    const inicio = new Date(actual);
    inicio.setDate(inicio.getDate() - 7 * (n - 1 - i));
    return { inicio, asaltos: 0, sesiones: 0, rpes: [] };
  });
  for (const s of sesiones) {
    const semana = semanas.find((x) => mismoDia(x.inicio, lunes(new Date(s.fecha))));
    if (!semana) continue;
    semana.asaltos += s.asaltos;
    semana.sesiones += 1;
    const rpe = valoraciones[s.clave]?.rpe;
    if (rpe != null) semana.rpes.push(rpe);
  }
  return semanas.map(({ rpes, ...s }) => ({ ...s, rpe: media(rpes) }));
}

// ---- Agrupación de la lista del Historial ----

export const AGRUPACIONES = ["semana", "mes", "ano"];

// Inicio del periodo (semana de lunes a domingo, mes o año natural) al que pertenece la fecha.
export function inicioPeriodo(fecha, modo) {
  if (modo === "mes") return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  if (modo === "ano") return new Date(fecha.getFullYear(), 0, 1);
  return lunes(fecha);
}

const dosCifras = (n) => String(n).padStart(2, "0");
function clavePeriodo(inicio, modo) {
  const ano = inicio.getFullYear();
  if (modo === "ano") return String(ano);
  if (modo === "mes") return `${ano}-${dosCifras(inicio.getMonth() + 1)}`;
  return `${ano}-${dosCifras(inicio.getMonth() + 1)}-${dosCifras(inicio.getDate())}`;
}

// Minutos de asalto de una sesión: asaltos completados × duración del asalto, sin descansos
// (de un asalto cortado a medias no se guarda cuánto duró).
const minutosAsalto = (s) => (s.asaltos * (s.duracion_asalto ?? 0)) / 60;

// Grupos de la lista, el más reciente primero: { clave, inicio, actual, sesiones, minutos }.
// El periodo actual sale siempre (arriba, aunque esté vacío); los pasados, solo si tienen sesiones.
// Dentro de cada grupo las sesiones conservan el orden de la lista (la más reciente primero).
export function agrupar(sesiones, modo, hoy = new Date()) {
  const actual = inicioPeriodo(hoy, modo);
  const grupos = new Map([[clavePeriodo(actual, modo), { inicio: actual, sesiones: [] }]]);
  for (const s of sesiones) {
    const inicio = inicioPeriodo(new Date(s.fecha), modo);
    const clave = clavePeriodo(inicio, modo);
    if (!grupos.has(clave)) grupos.set(clave, { inicio, sesiones: [] });
    grupos.get(clave).sesiones.push(s);
  }
  return [...grupos.entries()]
    .map(([clave, g]) => ({
      clave, inicio: g.inicio, actual: mismoDia(g.inicio, actual), sesiones: g.sesiones,
      minutos: Math.round(g.sesiones.reduce((n, s) => n + minutosAsalto(s), 0)),
    }))
    .sort((a, b) => b.inicio - a.inicio);
}

// Grupos desplegados al abrir: el actual y, si está vacío, el más reciente con sesiones.
export function clavesAbiertas(grupos) {
  const actual = grupos.find((g) => g.actual);
  const abiertas = new Set(actual ? [actual.clave] : []);
  if (!actual?.sesiones.length) {
    const reciente = grupos.find((g) => g.sesiones.length);
    if (reciente) abiertas.add(reciente.clave);
  }
  return abiertas;
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

// Título del grupo: «Semana del 26 oct» (con el año si no es el actual), «Octubre 2026» o «2026».
export function tituloGrupo(inicio, modo, hoy = new Date()) {
  if (modo === "ano") return String(inicio.getFullYear());
  if (modo === "mes") {
    const mes = MES_LARGO.format(inicio);
    return `${mes[0].toUpperCase()}${mes.slice(1)} ${inicio.getFullYear()}`;
  }
  const ano = inicio.getFullYear() === hoy.getFullYear() ? "" : ` ${inicio.getFullYear()}`;
  return `Semana del ${inicio.getDate()} ${MES_CORTO.format(inicio).replace(".", "")}${ano}`;
}
