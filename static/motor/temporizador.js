// Port de motor/temporizador.py: construye el guion de una sesión (eventos con su segundo exacto).
// El reproductor (app.js) solo lanza estos eventos; aquí está toda la lógica de tiempos.
import { MODOS_VOZ, textoHablado } from "./acciones.js";
import { datos } from "./datos.js";
import { SorteoBiblioteca } from "./sorteo.js";
import { RITMO_POR_DEFECTO, duracionEstimada, pausaEntreCombos, redondear } from "./ritmo.js";

export const PREPARACION = 3.0;        // segundos al inicio del asalto antes del primer combo
export const AVISO_ANTES_FIN = 10.0;   // aviso a los 10 s del final
export const DURACION_AVISO = 1.5;     // lo que ocupa decir "diez segundos"
export const DURACION_REACCION = 2.0;  // señal + tiempo para reaccionar
export const INTERVALO_REACCION = [8.0, 20.0]; // separación aleatoria entre señales de reacción
export const MARGEN = 0.5;             // hueco mínimo entre una combinación y una señal
export const REINTENTOS = 5;           // combinaciones que se prueban si no cabe ninguna en un asalto aún vacío

export const CONFIG_POR_DEFECTO = {
  asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 1,
  zurdo: false, modo_reaccion: false,
  pausa: null, // pausa fija entre combinaciones; null = la del ritmo
  ritmo: RITMO_POR_DEFECTO, // 1 Calmado … 5 Intenso
  voz: "nombres", // cómo se dicen: uno de MODOS_VOZ
};

// Mismos límites que PeticionGuion en app/esquemas.py.
const LIMITES = {
  asaltos: [1, 20, true], duracion_asalto: [20, 600, true], descanso: [0, 300, true],
  nivel: [1, 3, true], pausa: [0, 30, false], ritmo: [1, 5, true],
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
  if (!MODOS_VOZ.includes(config.voz)) errores.push(`voz debe ser una de: ${MODOS_VOZ.join(", ")}`);
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

// Primer instante desde t en el que cabe una combinación de d segundos sin pisar señales.
function hueco(t, d, reservados) {
  let choque;
  while ((choque = solapa(t, t + d, reservados))) t = choque[1] + MARGEN;
  return t;
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
    let vacio = true;
    while (true) {
      let combo = pendiente ?? generador.siguiente();
      pendiente = null;
      let d = duracionEstimada(combo.acciones);
      let empieza = hueco(t, d, reservados);
      // Asalto muy corto y aún vacío: la que no cabe espera al siguiente y se prueba otra.
      for (let i = 0; vacio && i < REINTENTOS && empieza + d > fin; i++) {
        pendiente = pendiente ?? combo;
        combo = generador.siguiente();
        d = duracionEstimada(combo.acciones);
        empieza = hueco(t, d, reservados);
      }
      if (empieza + d > fin) {
        pendiente = pendiente ?? combo;
        break;
      }
      t = empieza;
      vacio = false;
      const texto = textoHablado(combo.acciones, config.voz, config.zurdo);
      eventos.push(evento(redondear(t), "combo", n, { duracion: d, texto, ids: combo.acciones.map((a) => a.id) }));
      t = redondear(t + d + pausaEntreCombos(config.ritmo, combo.acciones, azar, config.pausa));
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
