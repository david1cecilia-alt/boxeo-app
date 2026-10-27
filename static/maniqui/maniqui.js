// Maniquí de una ficha: un paso = una postura y el muñeco interpola entre ellas.
// Controles: play/pausa, paso anterior/siguiente, velocidad 0,25×–1×, girar con el dedo
// (o con ← → si el lienzo tiene el foco) y vista frente / lado / arriba.
// Three.js se carga aquí con import(), solo cuando se abre una ficha con postura. Sin WebGL
// (o si falla la carga) la secuencia se dibuja como imágenes fijas en Canvas 2D.
// Con prefers-reduced-motion no se reproduce solo y los pasos cambian sin animación.
import { $$ } from "../vistas/dom.js";
import { interpolar, prepararPosturas, suave } from "./posturas.js";

const TRANSICION = 0.8; // s entre postura y postura a velocidad 1×
const ESPERA = 0.7;     // s quieto en cada paso al reproducir
const VELOCIDADES = [0.25, 0.5, 0.75, 1];
const NOMBRES_VISTA = { frente: "Frente", lado: "Lado", arriba: "Arriba" };

export function hayWebGL() {
  try {
    const lienzo = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (lienzo.getContext("webgl2") || lienzo.getContext("webgl")));
  } catch {
    return false;
  }
}

const sinMovimiento = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// `pasos`: [{ texto, postura }] (los que no tienen postura no se muestran).
// `datos`: data/posturas.json. Devuelve { destruir() }.
export async function crearManiqui(contenedor, { pasos, datos, zurdo = false, alCambiarPaso = () => {} }) {
  const posturas = prepararPosturas(datos, { zurdo });
  const secuencia = pasos.filter((p) => p.postura in posturas)
    .map((p) => ({ texto: p.texto, resuelta: posturas[p.postura], indice: pasos.indexOf(p) }));
  if (!secuencia.length) return { destruir() {} };

  let escena = null;
  if (hayWebGL()) {
    try {
      const { crearEscena, VISTAS } = await import("./escena.js");
      escena = { crearEscena, VISTAS };
    } catch {
      escena = null;
    }
  }
  if (!escena) {
    const { dibujarSecuencia } = await import("./lienzo.js");
    contenedor.innerHTML = `<div class="maniqui maniqui-fijo">
      <p class="nota">Este dispositivo no puede mostrar el maniquí en 3D: aquí tienes la secuencia paso a paso.</p>
      <div class="maniqui-fotos"></div></div>`;
    dibujarSecuencia(contenedor.querySelector(".maniqui-fotos"), datos.esqueleto, secuencia);
    return { destruir() {} };
  }

  const quieto = sinMovimiento();
  contenedor.innerHTML = `
    <div class="maniqui">
      <div class="maniqui-escena">
        <canvas tabindex="0" role="img" aria-roledescription="maniquí 3D"></canvas>
        <p class="maniqui-paso" aria-live="polite"></p>
      </div>
      <div class="maniqui-controles">
        <button type="button" class="boton secundario redondo" data-ir="-1" aria-label="Paso anterior">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <button type="button" class="boton principal redondo" data-play aria-pressed="false" aria-label="Reproducir">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path class="icono-play" d="M8 5v14l11-7z"/><path class="icono-pausa" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button>
        <button type="button" class="boton secundario redondo" data-ir="1" aria-label="Paso siguiente">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
        <label class="maniqui-velocidad">Velocidad
          <select>${VELOCIDADES.map((v) => `<option value="${v}" ${v === 1 ? "selected" : ""}>${String(v).replace(".", ",")}×</option>`).join("")}</select>
        </label>
      </div>
      <div class="maniqui-vistas" role="group" aria-label="Vista del maniquí">
        ${Object.entries(NOMBRES_VISTA).map(([v, n]) => `<button type="button" class="chip-vista" data-vista="${v}" aria-pressed="${v === "frente"}">${n}</button>`).join("")}
      </div>
    </div>`;

  const lienzo = contenedor.querySelector("canvas");
  const rotulo = contenedor.querySelector(".maniqui-paso");
  const botonPlay = contenedor.querySelector("[data-play]");
  const selector = contenedor.querySelector("select");
  const motor = escena.crearEscena(lienzo, datos);
  const { orbita } = motor;
  Object.assign(orbita, escena.VISTAS.frente);

  // Estado: el muñeco va de `desde` a `actual`; t = progreso de esa transición (0…1).
  let actual = 0;
  let desde = 0;
  let t = 1;
  let espera = 0;
  let reproduciendo = false;
  let velocidad = 1;
  let vistaObjetivo = null;
  let fotograma = null;
  let anterior = null;

  function rotular() {
    const paso = secuencia[actual];
    rotulo.textContent = `Paso ${actual + 1} / ${secuencia.length}`;
    lienzo.setAttribute("aria-label", `Maniquí, paso ${actual + 1} de ${secuencia.length}: ${paso.texto}`);
    alCambiarPaso(paso.indice);
  }

  function pintar() {
    const pose = t >= 1 ? secuencia[actual].resuelta
      : interpolar(secuencia[desde].resuelta, secuencia[actual].resuelta, suave(t));
    motor.mostrar(pose);
  }

  function irA(indice, { animar = !quieto } = {}) {
    desde = actual;
    actual = (indice + secuencia.length) % secuencia.length;
    t = animar && desde !== actual ? 0 : 1;
    espera = 0;
    rotular();
    arrancar();
  }

  function reproducir(si) {
    reproduciendo = si;
    botonPlay.setAttribute("aria-pressed", String(si));
    botonPlay.setAttribute("aria-label", si ? "Pausa" : "Reproducir");
    if (si && t >= 1) espera = ESPERA; // empieza moviéndose ya
    arrancar();
  }

  function paso(ahora) {
    const dt = anterior === null ? 0 : Math.min(0.1, (ahora - anterior) / 1000);
    anterior = ahora;
    let sigue = false;

    if (t < 1) {
      t = Math.min(1, t + (dt * velocidad) / TRANSICION);
      sigue = true;
    } else if (reproduciendo) {
      espera += dt * velocidad;
      if (espera >= ESPERA) irA(actual + 1, { animar: true });
      sigue = true;
    }
    if (vistaObjetivo) {
      const k = Math.min(1, dt * 6);
      let dA = vistaObjetivo.acimut - orbita.acimut;
      dA = ((dA + 540) % 360) - 180; // por el camino corto
      orbita.acimut += dA * k;
      orbita.elevacion += (vistaObjetivo.elevacion - orbita.elevacion) * k;
      if (Math.abs(dA) < 0.2 && Math.abs(vistaObjetivo.elevacion - orbita.elevacion) < 0.2) {
        Object.assign(orbita, vistaObjetivo);
        vistaObjetivo = null;
      }
      sigue = true;
    }
    pintar();
    fotograma = sigue ? requestAnimationFrame(paso) : null;
    if (!sigue) anterior = null;
  }

  function arrancar() {
    if (fotograma === null) fotograma = requestAnimationFrame(paso);
  }

  function elegirVista(nombre) {
    for (const b of $$("[data-vista]", contenedor)) b.setAttribute("aria-pressed", String(b.dataset.vista === nombre));
    if (quieto) {
      Object.assign(orbita, escena.VISTAS[nombre]);
      vistaObjetivo = null;
    } else {
      vistaObjetivo = { ...escena.VISTAS[nombre] };
    }
    arrancar();
  }

  // ---------- Eventos ----------
  contenedor.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => {
    reproducir(false);
    irA(actual + Number(b.dataset.ir));
  }));
  botonPlay.addEventListener("click", () => reproducir(!reproduciendo));
  selector.addEventListener("change", () => { velocidad = Number(selector.value); });
  contenedor.querySelectorAll("[data-vista]").forEach((b) => b.addEventListener("click", () => elegirVista(b.dataset.vista)));

  // Girar arrastrando (ratón o dedo). En táctil el desplazamiento vertical sigue moviendo la
  // página (touch-action: pan-y en el CSS); el horizontal gira el maniquí.
  let arrastre = null;
  lienzo.addEventListener("pointerdown", (e) => {
    arrastre = { x: e.clientX, y: e.clientY };
    lienzo.setPointerCapture(e.pointerId);
  });
  lienzo.addEventListener("pointermove", (e) => {
    if (!arrastre) return;
    orbita.acimut -= (e.clientX - arrastre.x) * 0.5;
    if (e.pointerType === "mouse") {
      orbita.elevacion = Math.max(-5, Math.min(89, orbita.elevacion + (e.clientY - arrastre.y) * 0.4));
    }
    arrastre = { x: e.clientX, y: e.clientY };
    vistaObjetivo = null;
    for (const b of $$("[data-vista]", contenedor)) b.setAttribute("aria-pressed", "false");
    motor.pintar();
  });
  const soltar = () => { arrastre = null; };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);
  lienzo.addEventListener("keydown", (e) => {
    const giro = { ArrowLeft: 15, ArrowRight: -15 }[e.key];
    if (giro === undefined) return;
    e.preventDefault();
    orbita.acimut += giro;
    motor.pintar();
  });

  rotular();
  pintar();
  if (!quieto) reproducir(true);

  return {
    irA: (indicePaso) => {
      const i = secuencia.findIndex((s) => s.indice === indicePaso);
      if (i >= 0) { reproducir(false); irA(i); }
    },
    destruir() {
      if (fotograma !== null) cancelAnimationFrame(fotograma);
      motor.destruir();
      contenedor.innerHTML = "";
    },
  };
}

