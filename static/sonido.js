// Sonidos sintetizados con Web Audio API: sin ficheros ni internet.
// El AudioContext se crea en el primer clic (los navegadores bloquean audio sin gesto).

let ctx = null;

export function activarSonido() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
}

// Mientras el asalto está en marcha suena un zumbido grave casi a cero (unos −66 dB, inaudible)
// para que la salida de audio no se duerma en los huecos entre combinaciones: en Android, sobre
// todo con Bluetooth, al despertar se comía la primera palabra. Ceros exactos no valen: Chrome
// los detecta como silencio y suelta la salida igual.
const DESPIERTO_FRECUENCIA = 40;
const DESPIERTO_VOLUMEN = 0.0005;
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
