// Interfaz de voz. Cualquier implementación debe ofrecer:
//   decir(texto)  -> habla el texto (interrumpe lo que se estuviera diciendo) y devuelve una
//                    promesa que se resuelve con "fin" al terminar o "error" si falla o se corta
//                    (nunca se rechaza). Puede no resolverse nunca: quien espera pone un tope.
//   callar()      -> corta la voz
//   configurar({ id, velocidad }) -> cambia la voz elegida (null = automática) y la velocidad
//   voces()       -> [{ id, nombre, idioma }] las voces en español que se pueden elegir
//   alCambiar(fn) -> avisa cuando cambia la voz que de verdad se usa (descripcion)
// Hoy: VozNavegador (Web Speech API). Mañana: VozPiper, sin tocar app.js.

const IDIOMA = "es-ES";

// Las voces en español del dispositivo: primero las de España, luego por nombre.
export function vocesEspanol(voces) {
  return voces
    .filter((v) => v.lang.toLowerCase().startsWith("es"))
    .sort((a, b) => (b.lang === IDIOMA) - (a.lang === IDIOMA) || a.name.localeCompare(b.name, "es"));
}

// La voz que se usa: la elegida (`id` = su voiceURI, o su nombre por si el navegador cambia el
// URI) si existe en este dispositivo; si no, o con `id` null, la automática.
export function elegirVoz(voces, id = null, idioma = IDIOMA) {
  if (id != null) {
    const elegida = voces.find((v) => v.voiceURI === id) ?? voces.find((v) => v.name === id);
    if (elegida) return elegida;
  }
  return (
    voces.find((v) => v.lang === idioma && v.localService) ||
    voces.find((v) => v.lang === idioma) ||
    voces.find((v) => v.lang.startsWith("es")) ||
    null
  );
}

class VozNavegador {
  constructor({ id = null, velocidad = 1.1 } = {}) {
    this.idioma = IDIOMA;
    this.id = id;
    this.velocidad = velocidad;
    this.voz = null;
    this._oyentes = [];
    this._elegirVoz();
    // Las voces se cargan de forma asíncrona en Chrome/Edge.
    speechSynthesis.addEventListener("voiceschanged", () => this._elegirVoz());
  }

  _elegirVoz() {
    this.voz = elegirVoz(speechSynthesis.getVoices(), this.id, this.idioma);
    for (const fn of this._oyentes) fn();
  }

  configurar({ id = this.id, velocidad = this.velocidad } = {}) {
    this.id = id;
    this.velocidad = velocidad;
    this._elegirVoz();
  }

  voces() {
    return vocesEspanol(speechSynthesis.getVoices()).map((v) => ({ id: v.voiceURI, nombre: v.name, idioma: v.lang }));
  }

  alCambiar(fn) {
    this._oyentes.push(fn);
  }

  decir(texto) {
    speechSynthesis.cancel();
    const frase = new SpeechSynthesisUtterance(texto);
    frase.lang = this.voz?.lang ?? this.idioma;
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

export function crearVoz(opciones) {
  return new VozNavegador(opciones);
}
