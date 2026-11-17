// Prueba de audio con cascos (prueba-audio.html): con cascos Bluetooth, en el móvil, se come el principio de
// cada combinación. Cada variante prueba una forma distinta de mantener despierta la salida de audio, dictando
// combinaciones reales de la biblioteca con el texto hablado de la app (voz.js y motor/acciones.js, los mismos).
// No enlaza la app ni toca su almacén: lo que se marca va solo a sessionStorage. No va a la precache de sw.js.
import { activarSonido, dejarDormir, mantenerDespierto } from "./sonido.js";
import { crearVoz } from "./voz.js";
import { cargarDatos } from "./motor/datos.js";
import { biblioteca, textoHablado } from "./motor/acciones.js";
import { segundosHabla } from "./motor/ritmo.js";
import { crearAzar } from "./motor/azar.js";
import { MARGEN_VOZ } from "./dictado.js";

const DURACION = 60;            // segundos que dura cada prueba
const ANTES_DEL_TIC = 0.3;      // el tic suena estos segundos antes de la combinación
const TONO_ZUMBIDO = 170;       // Hz del tono de la variante 1
const CLAVE = "boxeo.prueba-audio";

const $ = (id) => document.getElementById(id);

// ---------- Audio (un AudioContext propio; la variante 0 usa el de sonido.js, el de la app) ----------
let ctx = null;
const sonando = new Set(); // lo que hay que parar al acabar la prueba: { parar() }

function contexto() {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

const ganancia = (db) => 10 ** (db / 20);
const nivel = () => Number($("nivel").value);

// Ruido rosa (filtro de Paul Kellet), con picos de ±1.
function ruidoRosa(muestras) {
  const datos = new Float32Array(muestras);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, maximo = 0;
  for (let i = 0; i < muestras; i++) {
    const blanco = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + blanco * 0.0555179;
    b1 = 0.99332 * b1 + blanco * 0.0750759;
    b2 = 0.969 * b2 + blanco * 0.153852;
    b3 = 0.8665 * b3 + blanco * 0.3104856;
    b4 = 0.55 * b4 + blanco * 0.5329522;
    b5 = -0.7616 * b5 - blanco * 0.016898;
    datos[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + blanco * 0.5362;
    b6 = blanco * 0.115926;
    maximo = Math.max(maximo, Math.abs(datos[i]));
  }
  for (let i = 0; i < muestras; i++) datos[i] /= maximo || 1;
  return datos;
}

// Variante 1: tono de 170 Hz o ruido rosa filtrado (100-400 Hz), continuo, al nivel del control.
function zumbidoAudible(tipo) {
  const c = contexto();
  const gan = c.createGain();
  gan.gain.value = ganancia(nivel());
  let fuente;
  if (tipo === "ruido") {
    const buffer = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    buffer.copyToChannel(ruidoRosa(buffer.length), 0);
    fuente = c.createBufferSource();
    fuente.buffer = buffer;
    fuente.loop = true;
    const filtro = c.createBiquadFilter();
    filtro.type = "bandpass";
    filtro.frequency.value = 200;
    filtro.Q.value = 0.7;
    fuente.connect(filtro).connect(gan);
  } else {
    fuente = c.createOscillator();
    fuente.frequency.value = TONO_ZUMBIDO;
    fuente.connect(gan);
  }
  gan.connect(c.destination);
  fuente.start();
  const control = (e) => { gan.gain.value = ganancia(Number(e.target.value)); };
  $("nivel").addEventListener("input", control);
  sonando.add({
    parar() {
      $("nivel").removeEventListener("input", control);
      fuente.stop();
      gan.disconnect();
    },
  });
}

// Variante 2: un tic suave y corto (1,2 kHz, 25 ms).
function tic() {
  const c = contexto();
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const gan = c.createGain();
  osc.frequency.value = 1200;
  gan.gain.setValueAtTime(0.0001, t0);
  gan.gain.exponentialRampToValueAtTime(0.05, t0 + 0.005);
  gan.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);
  osc.connect(gan).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.03);
}

// Variante 4: un WAV de ruido rosa muy bajo (16 bits, mono) hecho aquí, en un <audio> en bucle.
function wavRuido(db, segundos = 2, tasa = 44100) {
  const datos = ruidoRosa(segundos * tasa);
  const amplitud = ganancia(db) * 32767;
  const vista = new DataView(new ArrayBuffer(44 + datos.length * 2));
  const texto = (pos, s) => [...s].forEach((ch, i) => vista.setUint8(pos + i, ch.charCodeAt(0)));
  texto(0, "RIFF");
  vista.setUint32(4, 36 + datos.length * 2, true);
  texto(8, "WAVEfmt ");
  vista.setUint32(16, 16, true);
  vista.setUint16(20, 1, true);       // PCM
  vista.setUint16(22, 1, true);       // mono
  vista.setUint32(24, tasa, true);
  vista.setUint32(28, tasa * 2, true);
  vista.setUint16(32, 2, true);
  vista.setUint16(34, 16, true);
  texto(36, "data");
  vista.setUint32(40, datos.length * 2, true);
  // Nunca ceros exactos: al menos ±1 (como en sonido.js, el silencio exacto lo detectan y sueltan la salida).
  datos.forEach((m, i) => {
    const v = Math.round(m * amplitud);
    vista.setInt16(44 + i * 2, v === 0 ? (i % 2 ? 1 : -1) : v, true);
  });
  return new Blob([vista], { type: "audio/wav" });
}

async function audioEnBucle() {
  const url = URL.createObjectURL(wavRuido(nivel()));
  const audio = new Audio(url);
  audio.loop = true;
  sonando.add({
    parar() {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      URL.revokeObjectURL(url);
    },
  });
  try {
    await audio.play();
  } catch (e) {
    escribirEstado(`El <audio> no arranca: ${e.message}`);
  }
}

// ---------- Voz ----------
const voz = crearVoz();
const pintarVoz = () => { $("voz").textContent = voz.descripcion; };
voz.alCambiar(pintarVoz);

// Variante 3: una frase cortísima a volumen mínimo justo antes de la de verdad (espera su final, con tope).
function calentarVoz(volumen) {
  return new Promise((ok) => {
    const frase = new SpeechSynthesisUtterance("a");
    frase.volume = volumen;
    frase.rate = 2;
    frase.lang = voz.voz?.lang ?? "es-ES";
    if (voz.voz) frase.voice = voz.voz;
    frase.onend = () => ok();
    frase.onerror = () => ok();
    speechSynthesis.speak(frase);
    esperar(1.5).then(ok);
  });
}

// Como dictado.js: la voz o, si su final no llega, la estimación + MARGEN_VOZ.
const hablar = (texto) => Promise.race([voz.decir(texto), esperar(segundosHabla(texto, voz.velocidad) + MARGEN_VOZ)]);

// ---------- Esperas que «Parar» corta ----------
const pendientes = new Set();
function esperar(segundos) {
  return new Promise((ok) => {
    const cortar = () => {
      clearTimeout(t);
      pendientes.delete(cortar);
      ok();
    };
    const t = setTimeout(cortar, segundos * 1000);
    pendientes.add(cortar);
  });
}

// ---------- Variantes ----------
const VARIANTES = [
  {
    titulo: "Como ahora",
    texto: "Zumbido de 40 Hz a 0,0005 (unos −66 dB), el de la app (sonido.js).",
    empezar() {
      activarSonido();
      mantenerDespierto();
      sonando.add({ parar: dejarDormir });
    },
  },
  {
    titulo: "Zumbido más audible",
    texto: "Tono de 170 Hz o ruido rosa filtrado, continuo, al nivel del control (−50 dB de entrada).",
    extra: `<div class="campo"><label for="tipo-zumbido">Sonido</label>
      <select id="tipo-zumbido"><option value="tono">Tono de 170 Hz</option>
      <option value="ruido">Ruido rosa (100-400 Hz)</option></select></div>`,
    empezar() { zumbidoAudible($("tipo-zumbido").value); },
  },
  {
    titulo: "Tic antes de cada combinación",
    texto: "Un tic suave y corto 300 ms antes de cada combinación: si algo se corta, que sea el tic.",
    async antes() {
      tic();
      await esperar(ANTES_DEL_TIC);
    },
  },
  {
    titulo: "Calentar la voz",
    texto: "Justo antes de cada combinación, una frase cortísima de la voz a volumen mínimo y en seguida la real.",
    extra: `<div class="campo"><label for="volumen-calentar">Volumen de la frase corta</label>
      <select id="volumen-calentar"><option value="0">0</option><option value="0.01">0,01</option>
      <option value="0.05">0,05</option></select></div>`,
    antes() { return calentarVoz(Number($("volumen-calentar").value)); },
  },
  {
    titulo: "<audio> en bucle",
    texto: "Un fichero de ruido muy bajo hecho aquí (WAV), en un elemento <audio> en bucle, sin Web Audio.",
    empezar: audioEnBucle,
  },
  {
    titulo: "Zumbido más audible + tic",
    texto: "La 1 y la 2 a la vez (con el sonido elegido en la 1).",
    empezar() { zumbidoAudible($("tipo-zumbido").value); },
    async antes() {
      tic();
      await esperar(ANTES_DEL_TIC);
    },
  },
];

// ---------- Resultados (solo sessionStorage) ----------
function leerResultados() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE)) ?? {};
  } catch {
    return {};
  }
}

function guardarResultado(i, veredicto) {
  const resultados = leerResultados();
  resultados[i] = { veredicto, hueco: Number($("hueco").value), nivel: nivel() };
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(resultados));
  } catch { /* sin sessionStorage: se ve en la página igual */ }
  return resultados;
}

let resultados = leerResultados();

function pintarResultados() {
  document.querySelectorAll("[data-veredicto]").forEach((b) => {
    b.setAttribute("aria-pressed", String(resultados[b.dataset.variante]?.veredicto === b.dataset.veredicto));
  });
  VARIANTES.forEach((_, i) => {
    const r = resultados[i];
    $(`veredicto-${i}`).textContent = r ? `${r.veredicto} (hueco ${r.hueco} s)` : "";
  });
  const lineas = [
    "Prueba de audio con cascos",
    `Navegador: ${navigator.userAgent}`,
    `Voz: ${voz.descripcion}`,
    ...VARIANTES.map((v, i) => {
      const r = resultados[i];
      const detalle = r ? `${r.veredicto} (hueco ${r.hueco} s${i === 1 || i === 4 || i === 5 ? `, ${r.nivel} dB` : ""})` : "sin probar";
      return `${i}. ${v.titulo}: ${detalle}`;
    }),
  ];
  $("resumen").value = lineas.join("\n");
}

// ---------- La prueba ----------
let ronda = 0;           // sube al empezar o parar: la prueba anterior deja de dictar
let enMarcha = null;     // índice de la variante en marcha
let reloj = null;

function escribirEstado(texto) {
  $("estado").textContent = texto;
}

function activar() {
  contexto();
  activarSonido();
  // Chrome de Android pide un gesto también para la voz: una frase vacía la desbloquea.
  speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  $("estado-audio").textContent = `activado (AudioContext ${ctx.state}, ${ctx.sampleRate} Hz)`;
}

function parar() {
  ronda++;
  speechSynthesis.cancel();
  for (const s of sonando) s.parar();
  sonando.clear();
  for (const cortar of [...pendientes]) cortar();
  clearInterval(reloj);
  if (enMarcha !== null) $(`variante-${enMarcha}`).classList.remove("en-marcha");
  enMarcha = null;
  $("parar").disabled = true;
  document.querySelectorAll("[data-probar]").forEach((b) => { b.disabled = false; });
  $("frase").textContent = "";
}

async function probar(i, combos) {
  parar();
  activar();
  const esta = ++ronda;
  const viva = () => esta === ronda;
  const variante = VARIANTES[i];
  const azar = crearAzar(Date.now());
  const fin = performance.now() + DURACION * 1000;
  enMarcha = i;
  $(`variante-${i}`).classList.add("en-marcha");
  $("parar").disabled = false;
  document.querySelectorAll("[data-probar]").forEach((b) => { b.disabled = true; });
  const contar = () => escribirEstado(`${i}. ${variante.titulo}: quedan ${Math.max(0, Math.ceil((fin - performance.now()) / 1000))} s`);
  contar();
  reloj = setInterval(contar, 250);

  await variante.empezar?.();
  await esperar(1); // que lo continuo ya esté sonando antes de la primera frase
  while (viva() && performance.now() < fin) {
    const texto = textoHablado(azar.choice(combos).acciones);
    await variante.antes?.();
    if (!viva()) return;
    $("frase").textContent = texto;
    await hablar(texto);
    if (!viva()) return;
    await esperar(Number($("hueco").value));
  }
  if (viva()) {
    parar();
    escribirEstado(`${i}. ${variante.titulo}: terminada. Marca si se corta o no.`);
  }
}

function pintarVariantes(combos) {
  $("variantes").innerHTML = VARIANTES.map((v, i) => `
    <section class="tarjeta variante" id="variante-${i}" aria-labelledby="titulo-variante-${i}">
      <h2 id="titulo-variante-${i}">${i}. ${v.titulo.replace(/</g, "&lt;")}</h2>
      <p class="nota">${v.texto.replace(/</g, "&lt;")}</p>
      ${v.extra ?? ""}
      <div class="acciones"><button type="button" class="boton principal" data-probar="${i}">Probar</button></div>
      <div class="acciones">
        <button type="button" class="boton secundario pequeno" data-variante="${i}" data-veredicto="Se corta" aria-pressed="false">Se corta</button>
        <button type="button" class="boton secundario pequeno" data-variante="${i}" data-veredicto="No se corta" aria-pressed="false">No se corta</button>
      </div>
      <p class="veredicto" id="veredicto-${i}"></p>
    </section>`).join("");
  $("variantes").addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton) return;
    if (boton.dataset.probar !== undefined) probar(Number(boton.dataset.probar), combos);
    else if (boton.dataset.veredicto) {
      resultados = guardarResultado(boton.dataset.variante, boton.dataset.veredicto);
      pintarResultados();
    }
  });
}

async function iniciar() {
  $("agente").textContent = navigator.userAgent;
  pintarVoz();
  const pintarNivel = () => { $("nivel-valor").textContent = `${nivel()} dB`; };
  $("nivel").addEventListener("input", pintarNivel);
  pintarNivel();
  $("activar").addEventListener("click", activar);
  $("parar").addEventListener("click", () => {
    const i = enMarcha;
    parar();
    if (i !== null) escribirEstado(`${i}. ${VARIANTES[i].titulo}: parada.`);
  });
  $("copiar").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("resumen").value);
      $("copiado").textContent = "Copiado.";
    } catch {
      $("resumen").select();
      $("copiado").textContent = "No se pudo copiar solo: está seleccionado, cópialo a mano.";
    }
  });
  await cargarDatos("data/");
  const combos = biblioteca();
  pintarVariantes(combos);
  pintarResultados();
  voz.alCambiar(pintarResultados);
  document.body.dataset.listo = "true";
}

iniciar().catch((e) => {
  escribirEstado(`No se pudo preparar la prueba: ${e.message}`);
  throw e;
});
