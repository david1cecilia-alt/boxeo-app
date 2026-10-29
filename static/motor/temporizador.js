// Port de motor/temporizador.py: construye el guion de una sesión (eventos con su segundo exacto).
// El reproductor (app.js) solo lanza estos eventos; aquí está toda la lógica de tiempos.
import { datos } from "./datos.js";
import { SorteoBiblioteca } from "./sorteo.js";
import { duracionEstimada, pausaEntreCombos, redondear } from "./ritmo.js";

export const PREPARACION = 3.0;        // segundos al inicio del asalto antes del primer combo
export const AVISO_ANTES_FIN = 10.0;   // aviso a los 10 s del final
export const DURACION_AVISO = 1.5;     // lo que ocupa decir "diez segundos"
export const DURACION_REACCION = 2.0;  // señal + tiempo para reaccionar
export const INTERVALO_REACCION = [8.0, 20.0]; // separación aleatoria entre señales de reacción
export const MARGEN = 0.5;             // hueco mínimo entre una combinación y una señal

export const CONFIG_POR_DEFECTO = {
  asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 1,
  zurdo: false, modo_reaccion: false, pausa: null, // null = la del nivel
};

// Mismos límites que PeticionGuion en app/esquemas.py.
const LIMITES = {
  asaltos: [1, 20, true], duracion_asalto: [20, 600, true], descanso: [0, 300, true],
  nivel: [1, 3, true], pausa: [0, 30, false],
};

// Errores de la configuración (lista vacía = válida).
export function validarConfig(config) {
  const errores = [];
  for (const [campo, [min, max, entero]] of Object.entries(LIMITES)) {
    const valor = config[campo];
    if (campo === "pausa" && valor === null) continue;
    if (typeof valor !== "number" || Number.isNaN(valor) || (entero && !Number.isInteger(valor))
        || valor < min || valor > max) {
      errores.push(`${campo} debe estar entre ${min} y ${max}`);
    }
  }
  return errores;
}

function evento(t, tipo, asalto, { duracion = 0.0, texto = "", ids = [] } = {}) {
  return { t, tipo, asalto, duracion, texto, ids };
}

function solapa(ini, fin, reservados) {
  for (const [rIni, rFin] of reservados) {
    if (ini < rFin + MARGEN && rIni - MARGEN < fin) return [rIni, rFin];
  }
  return null;
}

function reaccionesEntre(inicio, limite, azar, reacciones, asalto) {
  const eventos = [];
  let t = inicio + azar.uniform(...INTERVALO_REACCION);
  while (t + DURACION_REACCION <= limite) {
    const r = azar.choice(reacciones);
    eventos.push(evento(redondear(t), "reaccion", asalto,
      { duracion: DURACION_REACCION, texto: r.texto, ids: [r.id] }));
    t += DURACION_REACCION + azar.uniform(...INTERVALO_REACCION);
  }
  return eventos;
}

// `generador`: cualquier objeto con siguiente() (por defecto, el sorteo de la biblioteca).
export function construirGuion(config, azar, generador = null) {
  config = { ...CONFIG_POR_DEFECTO, ...config };
  generador = generador ?? new SorteoBiblioteca(config.nivel, { zurdo: config.zurdo, azar });
  const reacciones = datos().presets.reacciones;
  const pausa = pausaEntreCombos(config.nivel, config.pausa);
  let eventos = [];
  let tAsalto = 0.0;
  let pendiente = null; // la que no cupo al final del asalto: abre el siguiente (no se pierde)

  for (let n = 1; n <= config.asaltos; n++) {
    const [inicio, fin] = [tAsalto, tAsalto + config.duracion_asalto];
    eventos.push(evento(inicio, "inicio_asalto", n, { texto: `Asalto ${n}` }));

    const aviso = fin - AVISO_ANTES_FIN;
    let reservados = [[aviso, aviso + DURACION_AVISO]];
    if (config.modo_reaccion) {
      const senales = reaccionesEntre(inicio + PREPARACION, aviso - MARGEN, azar, reacciones, n);
      eventos = eventos.concat(senales);
      reservados = reservados.concat(senales.map((e) => [e.t, e.t + e.duracion]));
    }
    reservados.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (aviso > inicio) {
      eventos.push(evento(aviso, "aviso", n, { duracion: DURACION_AVISO, texto: "diez segundos" }));
    }

    // Colocar combinaciones en los huecos libres.
    let t = inicio + PREPARACION;
    while (true) {
      const combo = pendiente ?? generador.siguiente();
      pendiente = null;
      const d = duracionEstimada(combo.acciones);
      let choque;
      while ((choque = solapa(t, t + d, reservados))) t = choque[1] + MARGEN;
      if (t + d > fin) {
        pendiente = combo;
        break;
      }
      eventos.push(evento(redondear(t), "combo", n,
        { duracion: d, texto: combo.texto, ids: combo.acciones.map((a) => a.id) }));
      t = redondear(t + d + pausa);
    }

    eventos.push(evento(fin, "fin_asalto", n));
    tAsalto = fin;
    if (n < config.asaltos) {
      eventos.push(evento(fin, "descanso", n, { duracion: config.descanso, texto: "Descanso" }));
      tAsalto += config.descanso;
    }
  }

  eventos.push(evento(tAsalto, "fin_sesion", config.asaltos, { texto: "Fin del entrenamiento" }));
  // sort de JS es estable, como sorted de Python: a igual t se mantiene el orden de inserción.
  return eventos.sort((a, b) => a.t - b.t);
}
