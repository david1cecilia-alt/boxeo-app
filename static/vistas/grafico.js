// Gráfico del historial: una tarjeta con barras por semana, mes o año (selector Semanas / Meses /
// Años) y otro selector Asaltos / RPE. Barras en HTML (no SVG): se ven nítidas a cualquier ancho.
// El periodo actual va en rojo; cada barra lleva su valor encima y una etiqueta completa para
// lectores de pantalla. Debajo, los mismos datos como tabla.
import { diaCorto, esc } from "./dom.js";
import { tituloGrupo } from "./resumen.js";

const fmt = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const MES_CORTO = new Intl.DateTimeFormat("es-ES", { month: "short" });
const mesCorto = (d) => MES_CORTO.format(d).replace(".", "");

const MODOS = {
  asaltos: { boton: "Asaltos", titulo: "Asaltos", valor: (s) => s.asaltos, max: (ss) => Math.max(4, ...ss.map((s) => s.asaltos)) },
  rpe: { boton: "RPE", titulo: "Esfuerzo medio (RPE)", valor: (s) => s.rpe, max: () => 10 },
};

const ESCALAS = {
  semana: {
    boton: "Semanas", por: "por semana", columna: "Semana del", vacio: (n) => `en las últimas ${n} semanas`,
    // "7 sept", "14", "21", "28", "5 oct": el mes solo en la primera semana y cuando cambia.
    eje: (ps, i) => (i === 0 || ps[i].inicio.getMonth() !== ps[i - 1].inicio.getMonth()
      ? diaCorto(ps[i].inicio) : String(ps[i].inicio.getDate())),
    fila: (p) => diaCorto(p.inicio),
    nombre: (p) => `Semana del ${diaCorto(p.inicio)}`,
  },
  mes: {
    boton: "Meses", por: "por mes", columna: "Mes", vacio: (n) => `en los últimos ${n} meses`,
    eje: (ps, i) => mesCorto(ps[i].inicio),
    fila: (p) => `${mesCorto(p.inicio)} ${p.inicio.getFullYear()}`,
    nombre: (p) => tituloGrupo(p.inicio, "mes"),
  },
  ano: {
    boton: "Años", por: "por año", columna: "Año", vacio: (n) => `en los últimos ${n} años`,
    eje: (ps, i) => String(ps[i].inicio.getFullYear()),
    fila: (p) => String(p.inicio.getFullYear()),
    nombre: (p) => String(p.inicio.getFullYear()),
  },
};

// Se recuerdan al repintar el historial (no se guardan).
let modoElegido = "asaltos";
let escalaElegida = "semana";

const titulo = () => `${MODOS[modoElegido].titulo} ${ESCALAS[escalaElegida].por}`;

function etiqueta(p, e) {
  const rpe = p.rpe == null ? "sin RPE" : `RPE medio ${fmt(p.rpe)}`;
  return `${e.nombre(p)}: ${p.asaltos} asaltos en ${p.sesiones} sesiones, ${rpe}`;
}

function barras(periodos) {
  const m = MODOS[modoElegido];
  const e = ESCALAS[escalaElegida];
  const max = m.max(periodos);
  const ultima = periodos.length - 1;
  return periodos.map((p, i) => {
    const v = m.valor(p);
    const alto = v == null || v === 0 ? 0 : Math.max(0.03, v / max);
    return `<li class="${i === ultima ? "actual" : ""}">
      <span class="solo-lectores">${esc(etiqueta(p, e))}</span>
      <span class="valor" aria-hidden="true">${v == null ? "–" : fmt(v)}</span>
      <span class="barra" aria-hidden="true" style="--alto:${alto.toFixed(3)}"></span>
      <span class="eje" aria-hidden="true">${esc(e.eje(periodos, i))}</span>
    </li>`;
  }).join("");
}

function tabla(periodos) {
  const e = ESCALAS[escalaElegida];
  return `
  <details class="tabla-grafico">
    <summary>Ver como tabla</summary>
    <table>
      <thead><tr><th scope="col">${e.columna}</th><th scope="col">Sesiones</th><th scope="col">Asaltos</th><th scope="col">RPE medio</th></tr></thead>
      <tbody>${periodos.map((p) => `<tr><th scope="row">${esc(e.fila(p))}</th><td>${p.sesiones}</td>
        <td>${p.asaltos}</td><td>${p.rpe == null ? "—" : fmt(p.rpe)}</td></tr>`).join("")}</tbody>
    </table>
  </details>`;
}

function cuerpo(periodos) {
  return periodos.every((p) => p.sesiones === 0)
    ? `<p class="nota">Aún no hay sesiones ${ESCALAS[escalaElegida].vacio(periodos.length)}.</p>`
    : `<ol class="barras" style="--semanas:${periodos.length}">${barras(periodos)}</ol>${tabla(periodos)}`;
}

const botones = (lista, atributo, elegido) => Object.entries(lista).map(([id, x]) =>
  `<button type="button" ${atributo}="${id}" aria-pressed="${id === elegido}">${x.boton}</button>`).join("");

// `series`: { semana: [...], mes: [...], ano: [...] } de porPeriodo (vistas/resumen.js).
export function graficoSemanas(series) {
  return `
  <figure class="tarjeta grafico-semanas" aria-labelledby="t-grafico">
    <div class="cabeza-grafico">
      <h2 id="t-grafico" class="titulo-grafico">${titulo()}</h2>
      <div class="selectores-grafico">
        <div class="selector" role="group" aria-label="Periodo de cada barra">${botones(ESCALAS, "data-escala", escalaElegida)}</div>
        <div class="selector" role="group" aria-label="Qué muestra el gráfico">${botones(MODOS, "data-modo", modoElegido)}</div>
      </div>
    </div>
    <div class="cuerpo-grafico">${cuerpo(series[escalaElegida])}</div>
  </figure>`;
}

// Los selectores cambian título y barras sin repintar el resto del historial.
export function activarGrafico(raiz, series) {
  const figura = raiz.querySelector(".grafico-semanas");
  if (!figura) return;
  for (const boton of figura.querySelectorAll("[data-modo], [data-escala]")) {
    boton.addEventListener("click", () => {
      const atributo = boton.dataset.modo ? "data-modo" : "data-escala";
      if (boton.dataset.modo) modoElegido = boton.dataset.modo;
      else escalaElegida = boton.dataset.escala;
      figura.querySelectorAll(`[${atributo}]`).forEach((b) => b.setAttribute("aria-pressed", String(b === boton)));
      figura.querySelector(".titulo-grafico").textContent = titulo();
      const abierta = figura.querySelector(".tabla-grafico")?.open;
      figura.querySelector(".cuerpo-grafico").innerHTML = cuerpo(series[escalaElegida]);
      if (abierta) figura.querySelector(".tabla-grafico")?.setAttribute("open", "");
    });
  }
}
