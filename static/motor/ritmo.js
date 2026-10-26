// Port de motor/ritmo.py: cuánto se tarda en dictar y ejecutar una combinación, y pausas por nivel.

// Segundos que tarda la voz en decir cada acción (aprox., nombres de 1 a 4 palabras).
export const SEGUNDOS_HABLA_POR_ACCION = 0.6;
// Segundos para ejecutar cada acción después de oírla.
export const SEGUNDOS_EJECUCION = { golpe: 0.5, defensa: 0.8, movimiento: 1.0 };
// Pausa (recuperar guardia) entre el final de una combinación y la siguiente.
export const PAUSA_POR_NIVEL = { 1: 4.0, 2: 3.0, 3: 2.0 };

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

// Pausa configurada por el usuario o, si no hay, la del nivel.
export function pausaEntreCombos(nivel, pausa = null) {
  return pausa ?? PAUSA_POR_NIVEL[nivel];
}
