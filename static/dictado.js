// Dicta las combinaciones de un asalto contando la pausa desde que la voz TERMINA de verdad
// (onend u onerror de la voz), no desde una estimación. La estimación solo sirve de tope por si
// onend no llega (pasa en algunos Android): estimación a la velocidad de la voz + MARGEN_VOZ. Avisos y señales también
// esperan a su voz: una combinación no empieza hasta que se callan (y, tras una señal, hasta que
// pasa el tiempo para reaccionar).
//
// Qué se dice y cuándo lo decide el motor (elegirSiguiente), con la hora real: si la voz va más
// rápida que la estimación, tras las combinaciones del guion siguen sus reservas; si ya no cabe
// una del nivel, una coletilla.
//
// Todo en tiempo de sesión (reproductor.programar): la pausa lo congela también. Sin DOM: quien
// lo usa decide qué se ve en alDecir.
import { rangoPausa, segundosHabla } from "./motor/ritmo.js";
import { SIN_REPETIR } from "./motor/sorteo.js";
import { elegirSiguiente, siguienteTrasVoz } from "./motor/temporizador.js";

export const MARGEN_VOZ = 3.0;    // segundos de más sobre la estimación antes de dejar de esperar
export const PARA_REACCIONAR = 1.0; // tras decir una señal, tiempo para reaccionar sin combinaciones
export const RETRASO_TIC = 0.2;     // lo que puede llegar tarde lo programado (los tics van cada 100 ms)

export function crearDictado({ reproductor, voz, config, alDecir = () => {} }) {
  let hablando = null;    // promesa de lo que se está diciendo, o null
  let bloqueadoHasta = 0; // segundo de sesión hasta el que no empieza ninguna combinación
  let ronda = 0;          // sube al empezar o cortar un asalto: invalida lo programado antes
  let recientes = [];     // ids de las últimas dichas, que una coletilla no repite
  const dichas = [];      // [{ asalto, texto, ids }] lo que se ha dicho de verdad, para guardar
  const huecoMinimo = rangoPausa(config.ritmo, config.pausa ?? null)[0];

  const esperar = (segundos) => new Promise((ok) => reproductor.programar(segundos, ok));

  // Dice el texto y se resuelve con "fin", "error" o "maximo" (lo que llegue antes).
  function hablar(texto) {
    const promesa = new Promise((ok) => {
      let hecho = false;
      const acabar = (motivo) => {
        if (!hecho) {
          hecho = true;
          ok(motivo);
        }
      };
      Promise.resolve(voz.decir(texto)).then((r) => acabar(r === "error" ? "error" : "fin"), () => acabar("error"));
      reproductor.programar(segundosHabla(texto, config.velocidad) + MARGEN_VOZ, () => acabar("maximo"));
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
  async function senal(texto, despues = 0) {
    const motivo = await hablar(texto);
    bloqueadoHasta = Math.max(bloqueadoHasta, reproductor.tiempo() + despues);
    return motivo;
  }

  // Dicta un asalto desde el segundo `desde`. `cola`: sus combinaciones y, detrás, sus reservas,
  // en orden; `coletillas`: las cortas, en su orden al azar (las del guion con t = fin); `reservados`: [[ini, fin]] de las
  // señales previstas del asalto, que una combinación no debe pisar; `fin`: final del asalto.
  function asalto({ cola, coletillas = [], reservados, desde, fin }) {
    const esta = ++ronda;
    const viva = () => esta === ronda;
    let i = 0; // la próxima de la cola

    // `previsto`: el segundo para el que se programó; si solo llega tarde por el tic, se decide
    // con él (si no, una coletilla justa al final ya no cabría por unas centésimas).
    async function intentar(previsto = null) {
      if (!viva()) return;
      await libre();
      if (!viva()) return;
      const real = reproductor.tiempo();
      const ahora = previsto !== null && real - previsto <= RETRASO_TIC ? Math.min(real, previsto) : real;
      const eleccion = elegirSiguiente(ahora, cola[i] ?? null, coletillas, reservados, fin, recientes);
      if (!eleccion) return; // ya no cabe nada: se acaba el asalto
      const [combo, empieza] = eleccion;
      if (empieza > ahora) {
        reproductor.programar(empieza - real, () => intentar(empieza)); // tras una señal: a esa hora se vuelve a mirar
        return;
      }
      if (combo === cola[i]) i++;
      recientes = [...recientes, combo.ids].slice(-SIN_REPETIR);
      dichas.push({ asalto: combo.asalto, texto: combo.texto, ids: combo.ids });
      alDecir(combo);
      await hablar(combo.texto);
      if (!viva()) return;
      // Se golpea mientras se oye: desde que la voz calla solo queda el hueco. Es el que sorteó el
      // guion para esta combinación (no se sortea otra vez): si la voz tarda lo estimado, se dice
      // lo mismo que en el guion; si no, el desfase solo viene de la voz.
      const ya = reproductor.tiempo();
      const despues = siguienteTrasVoz(ya, combo.hueco, huecoMinimo, cola[i] ?? null, coletillas, reservados, fin, recientes);
      if (despues) reproductor.programar(Math.max(0, despues[1] - ya), () => intentar(despues[1]));
    }

    reproductor.programar(Math.max(0, desde - reproductor.tiempo()), () => intentar(desde));
  }

  return {
    hablar,
    senal,
    asalto,
    // Al acabar el asalto o parar: lo que estuviera programado ya no dicta nada.
    cortar() {
      ronda++;
    },
    get hablando() { return hablando !== null; },
    // Lo que se guarda de la sesión (Historial, valoración): nunca las reservas sin decir.
    get dichas() { return dichas.map((d) => ({ ...d })); },
  };
}
