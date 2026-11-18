// Sonidos sintetizados con Web Audio API: sin ficheros ni internet.
// El AudioContext se crea en el primer clic (los navegadores bloquean audio sin gesto).

let ctx = null;

export function activarSonido() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
}

// Mientras el asalto está en marcha suena un zumbido muy bajo para que la salida de audio no se duerma
// en los huecos entre combinaciones: en Android, sobre todo con cascos Bluetooth, al despertar se comía
// el principio de cada combinación. Ceros exactos no valen: Chrome los detecta como silencio y suelta la
// salida igual. Antes era un tono de 40 Hz a 0,0005 (unos −66 dB) y con cascos seguía cortándose: los
// cascos o el códec lo quitaban como silencio. Con 170 Hz a −50 dB ya no se corta (variante 1 de la
// página de prueba de audio con cascos, en Chrome de Android; el tic, calentar la voz y un <audio> no
// bastaron).
export const DESPIERTO_FRECUENCIA = 170;
export const DESPIERTO_VOLUMEN = 10 ** (-50 / 20); // −50 dB ≈ 0,0032
let despierto = null; // el oscilador que suena, o null

export function mantenerDespierto() {
  if (!ctx || despierto) return;
  if (ctx.state === "suspended") ctx.resume();
  const osc = ctx.createOscillator();
  const gan = ctx.createGain();
  osc.frequency.value = DESPIERTO_FRECUENCIA;
  gan.gain.value = DESPIERTO_VOLUMEN;
  osc.connect(gan).connect(ctx.destination);
  osc.start();
  despierto = osc;
}

export function dejarDormir() {
  if (!despierto) return;
  despierto.stop();
  despierto.disconnect();
  despierto = null;
}

function tono({ frecuencia, inicio = 0, duracion = 0.3, tipo = "sine", volumen = 0.4 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + inicio;
  const osc = ctx.createOscillator();
  const gan = ctx.createGain();
  osc.type = tipo;
  osc.frequency.value = frecuencia;
  gan.gain.setValueAtTime(volumen, t0);
  gan.gain.exponentialRampToValueAtTime(0.001, t0 + duracion); // caída tipo golpe
  osc.connect(gan).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duracion);
}

// Campana de ring: tono base + armónicos, con caída larga.
export function campana(veces = 1) {
  for (let i = 0; i < veces; i++) {
    const inicio = i * 0.45;
    tono({ frecuencia: 830, inicio, duracion: 1.4, volumen: 0.5 });
    tono({ frecuencia: 2290, inicio, duracion: 0.8, volumen: 0.15 });
    tono({ frecuencia: 4100, inicio, duracion: 0.4, volumen: 0.06 });
  }
}

// Tablillas de los 10 segundos: tres golpes secos.
export function tablillas() {
  for (let i = 0; i < 3; i++) {
    tono({ frecuencia: 1800, inicio: i * 0.18, duracion: 0.06, tipo: "square", volumen: 0.3 });
  }
}

// Pitido agudo para el modo reacción.
export function pitido() {
  tono({ frecuencia: 1400, duracion: 0.15, tipo: "square", volumen: 0.3 });
}
