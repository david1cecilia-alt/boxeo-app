// Dos gráficos pequeños apilados con el mismo eje de semanas, SVG hecho a mano:
// asaltos por semana (barras) arriba y RPE medio (línea) debajo. Un eje Y por gráfico.
// Pasar el ratón o el foco por una semana la resalta en los dos y muestra sus valores.
import { diaCorto, esc } from "./dom.js";

const ANCHO = 340;
const M = { izq: 28, der: 22 };
const ALTO_BARRAS = 104;
const ALTO_RPE = 92;
const ALTO_EJE_X = 18;
const SUP = 14; // aire arriba para la etiqueta de valor

const fmt = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

function escalaX(n) {
  const banda = (ANCHO - M.izq - M.der) / n;
  return { banda, centro: (i) => M.izq + banda * (i + 0.5) };
}

// Barra con la punta redondeada (4 px) y la base recta, creciendo desde la línea base.
function barra(cx, base, alto, ancho) {
  const x = cx - ancho / 2;
  const r = Math.min(4, alto, ancho / 2);
  const y = base - alto;
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + ancho - r}Q${x + ancho},${y} ${x + ancho},${y + r}V${base}Z`;
}

function rejilla(ticks, y, sufijo = "") {
  return ticks.map((t) => `
    <line class="rejilla" x1="${M.izq}" x2="${ANCHO - M.der}" y1="${y(t)}" y2="${y(t)}"/>
    <text class="eje" x="${M.izq - 6}" y="${y(t)}" dy="0.32em" text-anchor="end">${t}${sufijo}</text>`).join("");
}

function columnas(semanas, x, alto) {
  return semanas.map((_, i) => `
    <rect class="foco-semana" data-i="${i}" x="${x.centro(i) - x.banda / 2}" y="0" width="${x.banda}" height="${alto}"/>`).join("");
}

function etiquetaSemana(s) {
  const rpe = s.rpe == null ? "sin RPE" : `RPE medio ${fmt(s.rpe)}`;
  return `Semana del ${diaCorto(s.inicio)}: ${s.asaltos} asaltos en ${s.sesiones} sesiones, ${rpe}`;
}

function svgBarras(semanas, x) {
  const max = Math.max(4, ...semanas.map((s) => s.asaltos));
  const tope = Math.ceil(max / 2) * 2;
  const base = ALTO_BARRAS - 2;
  const y = (v) => base - (v / tope) * (base - SUP);
  const anchoBarra = Math.min(24, x.banda * 0.6);
  const ultima = semanas.length - 1;
  return `
  <svg class="grafico" viewBox="0 0 ${ANCHO} ${ALTO_BARRAS}" aria-hidden="true">
    ${rejilla([0, tope / 2, tope], y)}
    ${columnas(semanas, x, ALTO_BARRAS)}
    ${semanas.map((s, i) => s.asaltos > 0
      ? `<path class="barra" data-i="${i}" d="${barra(x.centro(i), base, base - y(s.asaltos), anchoBarra)}"/>` : "").join("")}
    ${semanas[ultima].asaltos > 0
      ? `<text class="valor" x="${x.centro(ultima)}" y="${y(semanas[ultima].asaltos) - 5}" text-anchor="middle">${semanas[ultima].asaltos}</text>` : ""}
  </svg>`;
}

function svgRpe(semanas, x) {
  const base = ALTO_RPE - 4;
  const y = (v) => base - (v / 10) * (base - SUP);
  // La línea se corta en las semanas sin RPE: no se inventan valores.
  const tramos = [];
  let tramo = [];
  semanas.forEach((s, i) => {
    if (s.rpe == null) { if (tramo.length) tramos.push(tramo); tramo = []; }
    else tramo.push([x.centro(i), y(s.rpe)]);
  });
  if (tramo.length) tramos.push(tramo);
  const conDato = semanas.map((s, i) => ({ s, i })).filter(({ s }) => s.rpe != null);
  const ultimo = conDato.at(-1);
  return `
  <svg class="grafico" viewBox="0 0 ${ANCHO} ${ALTO_RPE + ALTO_EJE_X}" aria-hidden="true">
    ${rejilla([0, 5, 10], y)}
    ${columnas(semanas, x, ALTO_RPE)}
    ${tramos.filter((t) => t.length > 1).map((t) => `<polyline class="linea" points="${t.map((p) => p.join(",")).join(" ")}"/>`).join("")}
    ${conDato.map(({ s, i }) => `<circle class="punto" data-i="${i}" cx="${x.centro(i)}" cy="${y(s.rpe)}" r="4"/>`).join("")}
    ${ultimo ? `<text class="valor" x="${x.centro(ultimo.i) + 8}" y="${y(ultimo.s.rpe)}" dy="0.32em">${fmt(ultimo.s.rpe)}</text>` : ""}
    ${semanas.map((s, i) => (semanas.length - 1 - i) % 2 === 0
      ? `<text class="eje" x="${x.centro(i)}" y="${ALTO_RPE + 13}" text-anchor="middle">${esc(diaCorto(s.inicio))}</text>` : "").join("")}
  </svg>`;
}

function tabla(semanas) {
  return `
  <details class="tabla-grafico">
    <summary>Ver como tabla</summary>
    <table>
      <thead><tr><th scope="col">Semana del</th><th scope="col">Sesiones</th><th scope="col">Asaltos</th><th scope="col">RPE medio</th></tr></thead>
      <tbody>${semanas.map((s) => `<tr><th scope="row">${esc(diaCorto(s.inicio))}</th><td>${s.sesiones}</td>
        <td>${s.asaltos}</td><td>${s.rpe == null ? "—" : fmt(s.rpe)}</td></tr>`).join("")}</tbody>
    </table>
  </details>`;
}

export function graficoSemanas(semanas) {
  if (semanas.every((s) => s.sesiones === 0)) {
    return `<p class="nota">Aún no hay sesiones en las últimas ${semanas.length} semanas.</p>`;
  }
  const x = escalaX(semanas.length);
  // Botones invisibles por semana, encima de los dos gráficos: foco con teclado y lector de pantalla.
  const focos = semanas.map((s, i) => `<button type="button" class="semana" data-i="${i}"
    style="left:${((x.centro(i) - x.banda / 2) / ANCHO) * 100}%;width:${(x.banda / ANCHO) * 100}%"
    aria-label="${esc(etiquetaSemana(s))}"></button>`).join("");
  return `
  <figure class="graficos" aria-label="Asaltos y RPE medio de las últimas ${semanas.length} semanas">
    <figcaption class="titulo-grafico">Asaltos por semana</figcaption>
    <div class="lienzo">${svgBarras(semanas, x)}</div>
    <p class="titulo-grafico">RPE medio (1–10)</p>
    <div class="lienzo">${svgRpe(semanas, x)}</div>
    <div class="capa-semanas">${focos}</div>
    <div class="tooltip" role="presentation" hidden></div>
  </figure>
  ${tabla(semanas)}`;
}

// Resalta la semana en los dos gráficos y muestra el tooltip (ratón, toque o foco).
export function activarGrafico(raiz, semanas) {
  const figura = raiz.querySelector(".graficos");
  if (!figura) return;
  const tooltip = figura.querySelector(".tooltip");

  function mostrar(i) {
    figura.querySelectorAll("[data-i]").forEach((el) => el.classList.toggle("activa", el.dataset.i === String(i)));
    const s = semanas[i];
    tooltip.innerHTML = `<strong>Semana del ${esc(diaCorto(s.inicio))}</strong><br>
      ${s.asaltos} asaltos · ${s.sesiones} sesiones<br>${s.rpe == null ? "Sin RPE" : `RPE medio ${fmt(s.rpe)}`}`;
    tooltip.hidden = false;
    const izq = ((escalaX(semanas.length).centro(i)) / ANCHO) * 100;
    tooltip.style.left = `clamp(0px, calc(${izq}% - 70px), calc(100% - 140px))`;
  }
  function ocultar() {
    figura.querySelectorAll(".activa").forEach((el) => el.classList.remove("activa"));
    tooltip.hidden = true;
  }

  for (const boton of figura.querySelectorAll("button.semana")) {
    const i = Number(boton.dataset.i);
    boton.addEventListener("pointerenter", () => mostrar(i));
    boton.addEventListener("focus", () => mostrar(i));
    boton.addEventListener("click", () => mostrar(i));
    boton.addEventListener("blur", ocultar);
  }
  figura.addEventListener("pointerleave", ocultar);
}
