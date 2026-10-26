// Reproduce un guion (lista de eventos con su segundo) en tiempo de sesión.
// El tiempo de sesión es el real menos las pausas: pausar congela el reloj y,
// al reanudar, el guion sigue exactamente donde estaba (ni salta ni repite eventos).
// No sabe nada de pantallas ni de voz: quien lo usa decide qué hacer en alLanzar.

export function crearReproductor(eventos, { alLanzar, reloj = () => performance.now() }) {
  let inicio = reloj();
  let pausadoDesde = null;
  let siguiente = 0;   // índice del próximo evento del guion
  let diferidos = [];  // [{ t, accion }] efectos programados en tiempo de sesión

  function tiempo() {
    return ((pausadoDesde ?? reloj()) - inicio) / 1000;
  }

  return {
    tiempo,
    get pausado() { return pausadoDesde !== null; },
    get terminado() { return siguiente >= eventos.length && diferidos.length === 0; },

    // Lanza todo lo que ya toca, en orden de tiempo. Llamar a menudo (p. ej. cada 100 ms).
    tic() {
      if (pausadoDesde !== null) return;
      const ahora = tiempo();
      while (pausadoDesde === null) {
        const evento = siguiente < eventos.length && eventos[siguiente].t <= ahora ? eventos[siguiente] : null;
        const i = diferidos.findIndex((d) => d.t <= ahora);
        const diferido = i >= 0 ? diferidos[i] : null;
        if (!evento && !diferido) break;
        if (evento && (!diferido || evento.t <= diferido.t)) {
          siguiente++;
          alLanzar(evento);
        } else {
          diferidos.splice(i, 1);
          diferido.accion();
        }
      }
    },

    // Ejecuta `accion` dentro de `segundos` de sesión (las pausas también lo congelan).
    programar(segundos, accion) {
      diferidos.push({ t: tiempo() + segundos, accion });
      diferidos.sort((a, b) => a.t - b.t);
    },

    pausar() {
      if (pausadoDesde === null) pausadoDesde = reloj();
    },

    reanudar() {
      if (pausadoDesde === null) return;
      inicio += reloj() - pausadoDesde;
      pausadoDesde = null;
    },

    // Para del todo: descarta lo pendiente.
    detener() {
      siguiente = eventos.length;
      diferidos = [];
    },
  };
}
