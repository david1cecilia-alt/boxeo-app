// Sin WebGL: la secuencia de la ficha como imágenes fijas en Canvas 2D, proyectando el
// mismo esqueleto (vista de lado o de frente). Nada que cargar ni que mantener aparte.
import { esc } from "../vistas/dom.js";
import { cinematica } from "./posturas.js";

const HUESOS = [
  ["pelvis", "columna", 0.09], ["columna", "pecho", 0.1], ["pecho", "cuello", 0.08], ["cuello", "cabeza", 0.04],
  ["pecho", "hombro_izq", 0.05], ["hombro_izq", "codo_izq", 0.05], ["codo_izq", "muneca_izq", 0.042],
  ["pecho", "hombro_der", 0.05], ["hombro_der", "codo_der", 0.05], ["codo_der", "muneca_der", 0.042],
  ["pelvis", "cadera_izq", 0.07], ["cadera_izq", "rodilla_izq", 0.062], ["rodilla_izq", "tobillo_izq", 0.048],
  ["tobillo_izq", "punta_izq", 0.04],
  ["pelvis", "cadera_der", 0.07], ["cadera_der", "rodilla_der", 0.062], ["rodilla_der", "tobillo_der", 0.048],
  ["tobillo_der", "punta_der", 0.04],
];
const ARTICULACIONES = ["hombro_izq", "codo_izq", "cadera_izq", "rodilla_izq", "hombro_der", "codo_der", "cadera_der", "rodilla_der"];

// Proyección: [horizontal, profundidad]. De lado se mira desde +X (el rival a la izquierda).
const PROYECCION = {
  lado: (p) => [-p[2], p[0]],
  frente: (p) => [-p[0], -p[2]],
};

function token(nombre, porDefecto) {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || porDefecto;
}

// Encuadre común a toda la secuencia: misma escala y centro en todos los pasos.
function encuadre(esqueleto, resueltas, vista, ancho, alto) {
  let min = Infinity;
  let max = -Infinity;
  for (const r of resueltas) {
    for (const { pos } of Object.values(cinematica(esqueleto, r))) {
      const h = PROYECCION[vista](pos)[0];
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
  }
  const margen = 0.12; // guantes y cabeza sobresalen de las articulaciones
  const m = Math.min(alto / 2.1, ancho / (max - min + 2 * margen));
  return { m, centro: (min + max) / 2 };
}

export function dibujarPostura(lienzo, esqueleto, resuelta, vista = "lado", marco = null) {
  const ctx = lienzo.getContext("2d");
  const escalaPx = window.devicePixelRatio || 1;
  const ancho = lienzo.clientWidth || 240;
  const alto = lienzo.clientHeight || 320;
  lienzo.width = ancho * escalaPx;
  lienzo.height = alto * escalaPx;
  ctx.scale(escalaPx, escalaPx);
  ctx.clearRect(0, 0, ancho, alto);

  const mundo = cinematica(esqueleto, resuelta);
  const proyectar = PROYECCION[vista];
  const { m, centro } = marco ?? encuadre(esqueleto, [resuelta], vista, ancho, alto); // píxeles por metro
  const aPantalla = (pos) => {
    const [h, prof] = proyectar(pos);
    return { x: ancho / 2 + (h - centro) * m, y: alto - 0.08 * alto - pos[1] * m, prof };
  };

  const blanco = token("--texto", "#f5f3f0");
  const sombra = token("--suave", "#b5ada4");
  const acento = token("--acento", "#ff3b30");

  // Suelo.
  ctx.strokeStyle = token("--linea", "#2a2724");
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ancho * 0.1, alto * 0.92);
  ctx.lineTo(ancho * 0.9, alto * 0.92);
  ctx.stroke();

  // De atrás adelante: lo más lejano, más apagado.
  const piezas = HUESOS.map(([a, b, radio]) => {
    const pa = aPantalla(mundo[a].pos);
    const pb = aPantalla(mundo[b].pos);
    return { pa, pb, radio, prof: (pa.prof + pb.prof) / 2 };
  }).sort((x, y) => x.prof - y.prof);
  ctx.lineCap = "round";
  for (const { pa, pb, radio, prof } of piezas) {
    ctx.strokeStyle = prof < 0 ? sombra : blanco;
    ctx.lineWidth = radio * 2 * m;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  const circulo = (p, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  const cabeza = aPantalla(mundo.cabeza.pos);
  circulo({ x: cabeza.x, y: cabeza.y - 0.12 * m }, 0.11 * m, blanco);
  for (const n of ARTICULACIONES) circulo(aPantalla(mundo[n].pos), 0.018 * m, acento);
  for (const lado of ["der", "izq"]) {
    const p = aPantalla(mundo[`puno_${lado}`].pos);
    circulo(p, 0.085 * m, p.prof < 0 ? sombra : blanco);
  }
}

// Una figura por paso, con su número y su texto.
export function dibujarSecuencia(contenedor, esqueleto, pasos, vista = "lado") {
  contenedor.innerHTML = `<ol class="maniqui-secuencia">${pasos.map((p, i) => `
    <li><canvas width="240" height="320" role="img" aria-label="Paso ${i + 1}: ${esc(p.texto)}"></canvas>
      <span>Paso ${i + 1}</span></li>`).join("")}</ol>`;
  const lienzos = [...contenedor.querySelectorAll("canvas")];
  const { clientWidth: ancho, clientHeight: alto } = lienzos[0];
  const marco = encuadre(esqueleto, pasos.map((p) => p.resuelta), vista, ancho || 240, alto || 320);
  lienzos.forEach((lienzo, i) => dibujarPostura(lienzo, esqueleto, pasos[i].resuelta, vista, marco));
}
