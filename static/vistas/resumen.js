// Cálculos del resumen del historial (lógica pura, sin DOM): totales de la semana y
// del mes (sesiones, asaltos y RPE medio), y asaltos y RPE medio por semana (de lunes a domingo).

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
