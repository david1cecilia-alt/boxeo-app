// Cálculos del resumen del historial (lógica pura, sin DOM): totales de la semana y
// del mes, y asaltos y RPE medio por semana (de lunes a domingo).

export function lunes(fecha) {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const mismoDia = (a, b) => a.getTime() === b.getTime();

// sesiones: [{ clave, fecha, asaltos }]; valoraciones: { clave: { rpe } }.
export function totales(sesiones, hoy = new Date()) {
  const semana = lunes(hoy);
  const enSemana = sesiones.filter((s) => mismoDia(lunes(new Date(s.fecha)), semana));
  const enMes = sesiones.filter((s) => {
    const d = new Date(s.fecha);
    return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth();
  });
  const sumar = (lista) => lista.reduce((n, s) => n + s.asaltos, 0);
  return {
    semana: { sesiones: enSemana.length, asaltos: sumar(enSemana) },
    mes: { sesiones: enMes.length, asaltos: sumar(enMes) },
  };
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
  return semanas.map(({ rpes, ...s }) => ({
    ...s, rpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
  }));
}
