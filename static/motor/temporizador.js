// Port de motor/temporizador.py: construye el guion de una sesión (eventos con su segundo exacto).
// El reproductor (app.js) solo lanza estos eventos; aquí está toda la lógica de tiempos.
import { MODOS_VOZ, textoHablado } from "./acciones.js";
import { datos } from "./datos.js";
import { SIN_REPETIR, SorteoBiblioteca } from "./sorteo.js";
import {
  RITMO_POR_DEFECTO, VELOCIDAD_MEDIDA, VELOCIDADES, duracionEstimada, pausaEntreCombos, rangoPausa, redondear,
} from "./ritmo.js";

export const PREPARACION = 3.0;        // segundos al inicio del asalto antes del primer combo
export const AVISO_ANTES_FIN = 10.0;   // aviso a los 10 s del final
export const DURACION_AVISO = 1.5;     // lo que ocupa decir "diez segundos"
export const DURACION_REACCION = 2.0;  // señal + tiempo para reaccionar
export const INTERVALO_REACCION = [8.0, 20.0]; // separación aleatoria entre señales de reacción
export const MARGEN = 0.5;             // hueco mínimo entre una combinación y una señal
export const REINTENTOS = 5;           // combinaciones que se prueban si no cabe ninguna en un asalto aún vacío
// El dictado cuenta los huecos desde que la voz calla de verdad: si habla más rápido que la
// estimación, se come las combinaciones del guion antes de tiempo. Las reservas alcanzan aunque la
// voz tardara solo esta fracción de lo estimado.
export const FACTOR_VOZ_RAPIDA = 0.5;

// Las reservas no tienen hora: van al final del asalto (t = fin) y solo se dicen si el dictado
// llega a ellas, tras las combinaciones del asalto y en su orden. Las coletillas (cortas, para
// rellenar el final donde ya no cabe una del nivel) llevan su hora si el guion las dice y, las
// demás, t = fin; el dictado decide de nuevo cuáles dice, en este mismo orden.
export const COMBINACIONES = ["combo", "reserva", "coletilla"];

export const CONFIG_POR_DEFECTO = {
  asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 1,
  zurdo: false, modo_reaccion: false,
  pausa: null, // pausa fija entre combinaciones; null = la del ritmo
  ritmo: RITMO_POR_DEFECTO, // 1 Calmado … 5 Intenso
  voz: "nombres", // cómo se dicen: uno de MODOS_VOZ
  velocidad: VELOCIDAD_MEDIDA, // de la voz: uno de VELOCIDADES
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
  const velocidades = Object.values(VELOCIDADES);
  if (config.velocidad !== undefined && !velocidades.includes(config.velocidad)) {
    errores.push(`velocidad debe ser una de: ${velocidades.join(", ")}`);
  }
  return errores;
}

// `hueco`, en las combinaciones: pausa desde que se calla hasta la siguiente.
function evento(t, tipo, asalto, { duracion = 0.0, texto = "", ids = [], hueco = 0.0 } = {}) {
  return { t, tipo, asalto, duracion, texto, ids, hueco };
}

function solapa(ini, fin, reservados) {
  for (const [rIni, rFin] of reservados) {
    if (ini < rFin + MARGEN && rIni - MARGEN < fin) return [rIni, rFin];
  }
  return null;
}

const cabe = (t, d, reservados, fin) => t + d <= fin && solapa(t, t + d, reservados) === null;
const clave = (ids) => ids.join(" ");

// Qué combinación decir desde el segundo t y cuándo: [combinación, empieza], o null si ya no cabe
// ninguna en el asalto. La usan el guion (con lo estimado) y el dictado (con la voz real).
// `siguiente`: la próxima del asalto (null si no quedan); `coletillas`: las cortas aún sin decir,
// en su orden al azar; `recientes`: ids de las últimas dichas, que una coletilla no repite;
// `reservados`: señales previstas, ordenadas (la última es el aviso).
// Si la siguiente no cabe (pisaría una señal o se pasa del final) y ya solo queda el aviso por
// delante, se dice la primera coletilla que quepa; si tampoco, se espera a que pase la señal.
export function elegirSiguiente(t, siguiente, coletillas, reservados, fin, recientes) {
  const usadas = new Set(recientes.map(clave));
  while (true) {
    if (siguiente && cabe(t, siguiente.duracion, reservados, fin)) return [siguiente, t];
    if (reservados.slice(0, -1).every(([ini]) => ini <= t)) {
      const corta = coletillas.find((c) => !usadas.has(clave(c.ids)) && cabe(t, c.duracion, reservados, fin));
      if (corta) return [corta, t];
    }
    const despues = reservados.map(([, f]) => f + MARGEN).filter((x) => x > t);
    if (!despues.length) return null;
    t = Math.min(...despues);
  }
}

// Como elegirSiguiente tras callar la voz en finVoz y esperar el hueco. Si con ese hueco ya no
// cabe nada en el asalto, se prueba con el mínimo del ritmo: así el silencio final es como mucho
// ese mínimo más lo que dura la coletilla más corta.
export function siguienteTrasVoz(finVoz, hueco, huecoMinimo, siguiente, coletillas, reservados, fin, recientes) {
  return elegirSiguiente(redondear(finVoz + hueco), siguiente, coletillas, reservados, fin, recientes)
    ?? elegirSiguiente(redondear(finVoz + huecoMinimo), siguiente, coletillas, reservados, fin, recientes);
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

// `sorteo`: un SorteoBiblioteca (por defecto, el de la biblioteca) o cualquier objeto con
// siguiente(), coletillas(), guardar() y restaurar().
export function construirGuion(config, azar, sorteo = null) {
  config = { ...CONFIG_POR_DEFECTO, ...config };
  sorteo = sorteo ?? new SorteoBiblioteca(config.nivel, { zurdo: config.zurdo, azar });
  const reacciones = datos().presets.reacciones;
  const huecoMinimo = rangoPausa(config.ritmo, config.pausa)[0];
  let eventos = [];
  let tAsalto = 0.0;
  let pendiente = null; // la que no cupo al final del asalto: abre el siguiente (no se pierde)
  let recientes = [];   // ids de las últimas dichas
  // El hueco tras cada una se sortea aquí, una sola vez: el dictado usa este mismo.
  const aEvento = (combo, tipo, asalto) => {
    const texto = textoHablado(combo.acciones, config.voz, config.zurdo);
    return evento(0.0, tipo, asalto, {
      duracion: duracionEstimada(combo.acciones, texto, config.velocidad), texto,
      ids: combo.acciones.map((a) => a.id), hueco: pausaEntreCombos(config.ritmo, azar, config.pausa),
    });
  };

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

    // Colocar combinaciones en los huecos libres, como las dirá el dictado si la voz tarda lo
    // estimado.
    const coletillas = sorteo.coletillas().map((c) => aEvento(c, "coletilla", n));
    let antes = sorteo.guardar(); // lo que recordaba el sorteo antes de sacar la siguiente
    let siguiente = pendiente ? { ...pendiente, asalto: n } : aEvento(sorteo.siguiente(), "combo", n);
    let apartada = null;
    const t = inicio + PREPARACION;
    let eleccion = elegirSiguiente(t, siguiente, coletillas, reservados, fin, recientes);
    // Asalto muy corto y aún vacío: la que no cabe espera al siguiente y se prueba otra.
    for (let i = 0; !eleccion && i < REINTENTOS; i++) {
      apartada = apartada ?? siguiente;
      antes = sorteo.guardar();
      siguiente = aEvento(sorteo.siguiente(), "combo", n);
      eleccion = elegirSiguiente(t, siguiente, coletillas, reservados, fin, recientes);
    }
    const dichas = [];
    while (eleccion) {
      const [elegida, empieza] = eleccion;
      if (elegida === siguiente) {
        antes = sorteo.guardar();
        siguiente = aEvento(sorteo.siguiente(), "combo", n);
      } else {
        coletillas.splice(coletillas.indexOf(elegida), 1);
      }
      const dicha = { ...elegida, t: redondear(empieza) }; // una coletilla dicha sigue siendo coletilla
      dichas.push(dicha);
      recientes = [...recientes, dicha.ids].slice(-SIN_REPETIR);
      eleccion = siguienteTrasVoz(empieza + dicha.duracion, dicha.hueco, huecoMinimo, siguiente,
        coletillas, reservados, fin, recientes);
    }
    eventos = eventos.concat(dichas);
    pendiente = apartada ?? siguiente;

    // Reservas: siguen a la última dicha, así que se sacan como si la pendiente (que abre el
    // siguiente asalto) no hubiera salido, y sin dejar rastro en el sorteo: no cambian ni la
    // cobertura del 1 al 6 ni lo que se puede repetir en los asaltos siguientes.
    const estado = sorteo.guardar();
    sorteo.restaurar(antes);
    const ahorro = (1 - FACTOR_VOZ_RAPIDA) * dichas.reduce((s, e) => s + e.duracion, 0);
    for (let cubierto = 0.0; cubierto < ahorro;) {
      const reserva = aEvento(sorteo.siguiente(), "reserva", n);
      eventos.push({ ...reserva, t: fin });
      cubierto += FACTOR_VOZ_RAPIDA * reserva.duracion + reserva.hueco;
    }
    sorteo.restaurar(estado);
    eventos = eventos.concat(coletillas.map((c) => ({ ...c, t: fin })));

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
