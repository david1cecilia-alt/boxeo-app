// Port de motor/ritmo.py: cuánto se tarda en dictar y ejecutar una combinación, y pausas según
// el ritmo (1-5).

// Segundos que tarda la voz en decir cada acción (aprox., nombres de 1 a 4 palabras).
export const SEGUNDOS_HABLA_POR_ACCION = 0.6;
// Segundos para ejecutar cada acción después de oírla.
export const SEGUNDOS_EJECUCION = { golpe: 0.5, defensa: 0.8, movimiento: 1.0 };
// Pausa (recuperar guardia) entre el final de una combinación y la siguiente, según el ritmo
// elegido: se sortea en el rango [mín, máx]. 1 = Calmado … 5 = Intenso.
export const PAUSA_POR_RITMO = { 1: [6.0, 8.0], 2: [4.9, 6.6], 3: [3.8, 5.3], 4: [2.6, 3.9], 5: [1.5, 2.5] };
export const RITMO_POR_DEFECTO = 3;
// Las combinaciones largas piden recuperar más: segundos de más por cada acción a partir de la 4.ª.
export const ACCIONES_SIN_EXTRA = 3;
export const EXTRA_POR_ACCION = 0.3;

export function redondear(x, decimales = 2) {
  const f = 10 ** decimales;
  return Math.round(x * f) / f;
}

// Tiempo desde que empieza el dictado hasta que se termina de ejecutar.
export function duracionEstimada(combo) {
  const habla = SEGUNDOS_HABLA_POR_ACCION * combo.length;
  const ejecucion = combo.reduce((s, a) => s + SEGUNDOS_EJECUCION[a.tipo], 0);
  return redondear(habla + ejecucion);
}

export function extraPorLongitud(combo) {
  return EXTRA_POR_ACCION * Math.max(0, combo.length - ACCIONES_SIN_EXTRA);
}

// Pausa tras `combo`: la fija del usuario o, si no hay, una al azar del ritmo más lo que
// pida su longitud.
export function pausaEntreCombos(ritmo, combo, azar, pausa = null) {
  if (pausa !== null) return pausa;
  return redondear(azar.uniform(...PAUSA_POR_RITMO[ritmo]) + extraPorLongitud(combo));
}
