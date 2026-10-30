// Dicta las combinaciones de un asalto contando la pausa desde que la voz TERMINA de verdad
// (onend u onerror de la voz), no desde una estimación. La estimación solo sirve de tope por si
// onend no llega (pasa en algunos Android): estimación a la velocidad de la voz + MARGEN_VOZ. Avisos y señales también
// esperan a su voz: una combinación no empieza hasta que se callan (y, tras una señal, hasta que
// pasa el tiempo para reaccionar). Las señales de Reacción van siempre a VELOCIDAD_SENAL; las
// combinaciones y los avisos, a la velocidad de Ajustes (config.velocidad).
//
// Todo en tiempo de sesión (reproductor.programar): la pausa lo congela también. Sin DOM: quien
// lo usa decide qué se ve en alDecir.
import { MARGEN } from "./motor/temporizador.js";
import { VELOCIDAD_SENAL, pausaEntreCombos, segundosHabla } from "./motor/ritmo.js";

export const MARGEN_VOZ = 3.0;    // segundos de más sobre la estimación antes de dejar de esperar
export const PARA_REACCIONAR = 1.0; // tras decir una señal, tiempo para reaccionar sin combinaciones

export function crearDictado({ reproductor, voz, config, azar, alDecir = () => {} }) {
  let hablando = null;    // promesa de lo que se está diciendo, o null
  let bloqueadoHasta = 0; // segundo de sesión hasta el que no empieza ninguna combinación
  let ronda = 0;          // sube al empezar o cortar un asalto: invalida lo programado antes

  const esperar = (segundos) => new Promise((ok) => reproductor.programar(segundos, ok));

  // Dice el texto (a `velocidad` o a la de Ajustes) y se resuelve con "fin", "error" o "maximo"
  // (lo que llegue antes). El tope se estima a esa misma velocidad.
  function hablar(texto, { velocidad = config.velocidad } = {}) {
    const promesa = new Promise((ok) => {
      let hecho = false;
      const acabar = (motivo) => {
        if (!hecho) {
          hecho = true;
          ok(motivo);
        }
      };
      Promise.resolve(voz.decir(texto, { velocidad })).then((r) => acabar(r === "error" ? "error" : "fin"), () => acabar("error"));
      reproductor.programar(segundosHabla(texto, velocidad) + MARGEN_VOZ, () => acabar("maximo"));
    });
    hablando = promesa;
    promesa.then(() => {
      if (hablando === promesa) hablando = null;
    });
    return promesa;
  }

  // Espera a que la voz calle y a que pase la ventana de una señal.
  async function libre() {
    while (true) {
      if (hablando) {
        await hablando;
        continue;
      }
      const falta = bloqueadoHasta - reproductor.tiempo();
      if (falta > 0) {
        await esperar(falta);
        continue;
      }
      return;
    }
  }

  // Avisos y señales: se dicen a su hora (la del guion) y retienen las combinaciones hasta que
  // se callan, más `despues` segundos.
  async function senal(texto, despues = 0, { velocidad } = {}) {
    const motivo = await hablar(texto, { velocidad });
    bloqueadoHasta = Math.max(bloqueadoHasta, reproductor.tiempo() + despues);
    return motivo;
  }

  // Señal de Reacción («¡esquiva!»): sin lado, a VELOCIDAD_SENAL y con PARA_REACCIONAR después.
  const reaccion = (texto) => senal(texto, PARA_REACCIONAR, { velocidad: VELOCIDAD_SENAL });

  // Dicta las combinaciones de un asalto en su orden. `reservados`: [[ini, fin]] de las señales
  // previstas del asalto, que una combinación no debe pisar; `fin`: final del asalto.
  function asalto({ combos, reservados, fin }) {
    const esta = ++ronda;
    const viva = () => esta === ronda;

    async function intentar(i) {
      const combo = combos[i];
      if (!viva() || !combo) return;
      await libre();
      if (!viva()) return;
      const ahora = reproductor.tiempo();
      const choque = reservados.find(([ini, f]) => ahora < f + MARGEN && ini - MARGEN < ahora + combo.duracion);
      if (choque) {
        reproductor.programar(choque[1] + MARGEN - ahora, () => intentar(i));
        return;
      }
      if (ahora + combo.duracion > fin) return; // ya no cabe: se acaba el asalto
      alDecir(combo);
      await hablar(combo.texto);
      if (!viva()) return;
      // Se golpea mientras se oye: desde que la voz calla solo queda el hueco del ritmo.
      reproductor.programar(pausaEntreCombos(config.ritmo, azar, config.pausa), () => intentar(i + 1));
    }

    if (combos.length) reproductor.programar(Math.max(0, combos[0].t - reproductor.tiempo()), () => intentar(0));
  }

  return {
    hablar,
    senal,
    reaccion,
    asalto,
    // Al acabar el asalto o parar: lo que estuviera programado ya no dicta nada.
    cortar() {
      ronda++;
    },
    get hablando() { return hablando !== null; },
  };
}
