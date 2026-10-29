// Interfaz de voz. Cualquier implementación debe ofrecer:
//   decir(texto)  -> habla el texto (interrumpe lo que se estuviera diciendo) y devuelve una
//                    promesa que se resuelve con "fin" al terminar o "error" si falla o se corta
//                    (nunca se rechaza). Puede no resolverse nunca: quien espera pone un tope.
//   callar()      -> corta la voz
// Hoy: VozNavegador (Web Speech API). Mañana: VozPiper, sin tocar app.js.

class VozNavegador {
  constructor({ idioma = "es-ES", velocidad = 1.1 } = {}) {
    this.idioma = idioma;
    this.velocidad = velocidad;
    this.voz = null;
    this._elegirVoz();
    // Las voces se cargan de forma asíncrona en Chrome/Edge.
    speechSynthesis.addEventListener("voiceschanged", () => this._elegirVoz());
  }

  _elegirVoz() {
    const voces = speechSynthesis.getVoices();
    this.voz =
      voces.find((v) => v.lang === this.idioma && v.localService) ||
      voces.find((v) => v.lang === this.idioma) ||
      voces.find((v) => v.lang.startsWith("es")) ||
      null;
  }

  decir(texto) {
    speechSynthesis.cancel();
    const frase = new SpeechSynthesisUtterance(texto);
    frase.lang = this.idioma;
    frase.rate = this.velocidad;
    if (this.voz) frase.voice = this.voz;
    return new Promise((ok) => {
      frase.onend = () => ok("fin");
      frase.onerror = () => ok("error"); // también al cortarla con cancel()
      speechSynthesis.speak(frase);
    });
  }

  callar() {
    speechSynthesis.cancel();
  }

  get descripcion() {
    return this.voz ? `${this.voz.name} (${this.voz.lang})` : "sin voz en español";
  }

  // Sin la coletilla del idioma, que ya dice el código: «Microsoft Helena (es-ES)».
  get descripcionCorta() {
    return this.voz ? `${nombreCortoVoz(this.voz.name)} (${this.voz.lang})` : this.descripcion;
  }
}

// «Microsoft Helena - Spanish (Spain)» → «Microsoft Helena». Los nombres sin coletilla, tal cual.
export function nombreCortoVoz(nombre) {
  return nombre.replace(/\s+-\s+[^-]+$/, "").trim() || nombre;
}

export function crearVoz() {
  return new VozNavegador();
}
