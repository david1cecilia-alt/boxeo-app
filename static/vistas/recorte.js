// Recorte de la foto del avatar: tras hacerla o elegirla, una vista previa cuadrada con la máscara del avatar
// (--radio-avatar). Se mueve arrastrando (o con las flechas) y se acerca con el deslizador, los botones − y +,
// el pellizco o la rueda (y + / − en el teclado), de 1× a 3×. Con zoom 1× el cuadrado es el lado corto de la
// foto: nunca quedan bordes vacíos. Devuelve el cuadrado elegido en píxeles de la imagen ({ x, y, lado }) y
// foto.js lo pasa a los 256 × 256 de siempre. El <dialog> va al final de <body>: fuera del menú, que es otro
// modal (como la hoja de «Practicar más»).
import { $, abrirDialogo, conectarDialogo } from "./dom.js";

export const ZOOM_MAX = 3;
const PASO_ZOOM = 0.1;
const PASO_TECLA = 0.05; // las flechas mueven un 5 % del lado del recorte
const RUEDA = 0.0015;    // zoom por píxel de rueda

// ---------- La cuenta, sin DOM ----------
// El encuadre: el centro del recorte (cx, cy) en píxeles de la imagen y el zoom. lado = lado corto / zoom.

export function encuadreInicial(ancho, alto) {
  return { cx: ancho / 2, cy: alto / 2, zoom: 1 };
}

// El encuadre dentro de los límites: zoom de 1 a ZOOM_MAX y el recorte entero dentro de la imagen.
export function limitar({ cx, cy, zoom }, ancho, alto) {
  const z = Math.min(ZOOM_MAX, Math.max(1, Number.isFinite(zoom) ? zoom : 1));
  const mitad = Math.min(ancho, alto) / z / 2;
  const entre = (v, min, max) => Math.min(max, Math.max(min, v));
  return { cx: entre(cx, mitad, ancho - mitad), cy: entre(cy, mitad, alto - mitad), zoom: z };
}

// El cuadrado del encuadre, en píxeles de la imagen.
export function recorteDe(encuadre, ancho, alto) {
  const { cx, cy, zoom } = limitar(encuadre, ancho, alto);
  const lado = Math.min(ancho, alto) / zoom;
  return { x: cx - lado / 2, y: cy - lado / 2, lado };
}

// Mover la imagen (dx, dy) píxeles de pantalla en una vista de `vista` px: el recorte va al revés.
export function mover(encuadre, dx, dy, vista, ancho, alto) {
  const escala = recorteDe(encuadre, ancho, alto).lado / vista;
  return limitar({ ...encuadre, cx: encuadre.cx - dx * escala, cy: encuadre.cy - dy * escala }, ancho, alto);
}

export function acercar(encuadre, zoom, ancho, alto) {
  return limitar({ ...encuadre, zoom }, ancho, alto);
}

// ---------- El diálogo ----------

let dialogo = null;
let estado = null; // { imagen, encuadre }

function crear() {
  dialogo = document.createElement("dialog");
  dialogo.id = "d-recorte";
  dialogo.className = "recorte";
  dialogo.setAttribute("aria-labelledby", "t-recorte");
  dialogo.innerHTML = `
    <h2 id="t-recorte">Encuadra tu foto</h2>
    <p class="nota" id="ayuda-recorte">Arrastra para moverla y usa el zoom. Con el teclado: flechas para mover,
      + y − para acercar o alejar.</p>
    <div class="recorte-vista" tabindex="0" role="group" aria-label="Encuadre de la foto" aria-describedby="ayuda-recorte">
      <canvas aria-hidden="true"></canvas>
      <span class="recorte-mascara" aria-hidden="true"></span>
    </div>
    <div class="recorte-zoom">
      <button type="button" class="boton-icono" data-zoom="-1" aria-label="Alejar">−</button>
      <input type="range" id="zoom-recorte" min="1" max="${ZOOM_MAX}" step="0.01" value="1" aria-label="Zoom">
      <button type="button" class="boton-icono" data-zoom="1" aria-label="Acercar">+</button>
    </div>
    <div class="acciones">
      <button type="button" class="boton secundario" value="">Cancelar</button>
      <button type="button" class="boton principal" value="si">Guardar</button>
    </div>`;
  document.body.append(dialogo);
  conectarDialogo(dialogo);
  conectarGestos();
}

const vista = () => $(".recorte-vista", dialogo);

function cambiar(encuadre) {
  const { imagen } = estado;
  estado.encuadre = limitar(encuadre, imagen.width, imagen.height);
  $("#zoom-recorte", dialogo).value = String(estado.encuadre.zoom);
  pintar();
}

function pintar() {
  const lienzo = $("canvas", dialogo);
  const lado = vista().clientWidth;
  const px = Math.round(lado * (window.devicePixelRatio || 1));
  if (lienzo.width !== px) lienzo.width = lienzo.height = px;
  const { imagen, encuadre } = estado;
  const { x, y, lado: l } = recorteDe(encuadre, imagen.width, imagen.height);
  const ctx = lienzo.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, px, px);
  ctx.drawImage(imagen, x, y, l, l, 0, 0, px, px);
}

function conectarGestos() {
  const v = vista();
  const punteros = new Map(); // pointerId → { x, y }
  let pellizco = null;        // { distancia, zoom } al empezar

  const distancia = () => {
    const [a, b] = [...punteros.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  v.addEventListener("pointerdown", (e) => {
    if (!estado) return;
    v.setPointerCapture(e.pointerId); // el clic al soltar no cae en el velo (no cierra)
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 2) pellizco = { distancia: distancia(), zoom: estado.encuadre.zoom };
  });
  v.addEventListener("pointermove", (e) => {
    const antes = punteros.get(e.pointerId);
    if (!antes || !estado) return;
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const { imagen, encuadre } = estado;
    if (punteros.size === 2 && pellizco) {
      cambiar(acercar(encuadre, pellizco.zoom * (distancia() / pellizco.distancia), imagen.width, imagen.height));
    } else if (punteros.size === 1) {
      cambiar(mover(encuadre, e.clientX - antes.x, e.clientY - antes.y, v.clientWidth, imagen.width, imagen.height));
    }
  });
  const soltar = (e) => {
    punteros.delete(e.pointerId);
    if (punteros.size < 2) pellizco = null;
  };
  v.addEventListener("pointerup", soltar);
  v.addEventListener("pointercancel", soltar);
  v.addEventListener("wheel", (e) => {
    if (!estado) return;
    e.preventDefault();
    const { imagen, encuadre } = estado;
    cambiar(acercar(encuadre, encuadre.zoom * Math.exp(-e.deltaY * RUEDA), imagen.width, imagen.height));
  }, { passive: false });
  v.addEventListener("keydown", (e) => {
    if (!estado) return;
    const { imagen, encuadre } = estado;
    const paso = v.clientWidth * PASO_TECLA;
    const flechas = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] };
    if (flechas[e.key]) {
      // Como arrastrar: la flecha mueve la foto hacia ese lado.
      cambiar(mover(encuadre, ...flechas[e.key], v.clientWidth, imagen.width, imagen.height));
    } else if (e.key === "+" || e.key === "=") {
      cambiar(acercar(encuadre, encuadre.zoom + PASO_ZOOM, imagen.width, imagen.height));
    } else if (e.key === "-" || e.key === "_") {
      cambiar(acercar(encuadre, encuadre.zoom - PASO_ZOOM, imagen.width, imagen.height));
    } else {
      return;
    }
    e.preventDefault();
  });
  $("#zoom-recorte", dialogo).addEventListener("input", (e) => {
    if (estado) cambiar({ ...estado.encuadre, zoom: Number(e.target.value) });
  });
  dialogo.addEventListener("click", (e) => {
    const boton = e.target.closest("[data-zoom]");
    if (!boton || !estado) return;
    cambiar({ ...estado.encuadre, zoom: estado.encuadre.zoom + PASO_ZOOM * Number(boton.dataset.zoom) });
  });
  window.addEventListener("resize", () => { if (estado) pintar(); });
}

/**
 * Abre el recorte de `imagen` (un ImageBitmap o una imagen ya decodificada). Promise: el cuadrado elegido
 * ({ x, y, lado }, píxeles de la imagen) con «Guardar», o null con «Cancelar», Esc o tocando el velo. No cierra
 * la imagen: eso lo hace quien la codifica (o la descarta). Al cerrar, el foco vuelve a donde estaba.
 */
export function abrirRecorte(imagen) {
  if (!dialogo) crear();
  const volver = document.activeElement;
  estado = { imagen, encuadre: encuadreInicial(imagen.width, imagen.height) };
  return new Promise((listo) => {
    abrirDialogo(dialogo, ".recorte-vista", (valor) => {
      const recorte = valor === "si" ? recorteDe(estado.encuadre, imagen.width, imagen.height) : null;
      estado = null;
      if (volver?.isConnected) volver.focus({ preventScroll: true });
      listo(recorte);
    });
    cambiar(estado.encuadre); // ya abierto: la vista tiene su tamaño
  });
}
