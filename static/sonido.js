// Sonidos sintetizados con Web Audio API: sin ficheros ni internet.
// El AudioContext se crea en el primer clic (los navegadores bloquean audio sin gesto).

let ctx = null;

export function activarSonido() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
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
