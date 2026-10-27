// Gráfico semanal del historial: una tarjeta con barras por semana y un selector
// Asaltos / RPE. Barras en HTML (no SVG): se ven nítidas a cualquier ancho. La semana actual va
// en rojo; cada barra lleva su valor encima y una etiqueta completa para lectores de pantalla.
// Debajo, los mismos datos como tabla.
import { diaCorto, esc } from "./dom.js";

const fmt = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

const MODOS = {
  asaltos: { boton: "Asaltos", titulo: "Asaltos por semana", valor: (s) => s.asaltos, max: (ss) => Math.max(4, ...ss.map((s) => s.asaltos)) },
  rpe: { boton: "RPE", titulo: "Esfuerzo medio (RPE)", valor: (s) => s.rpe, max: () => 10 },
};

let modoElegido = "asaltos"; // se recuerda al repintar el historial

// "7 sept", "14", "21", "28", "5 oct": el mes solo en la primera semana y cuando cambia.
function etiquetaEje(semanas, i) {
  const d = semanas[i].inicio;
  return i === 0 || d.getMonth() !== semanas[i - 1].inicio.getMonth() ? diaCorto(d) : String(d.getDate());
}

function etiquetaSemana(s) {
  const rpe = s.rpe == null ? "sin RPE" : `RPE medio ${fmt(s.rpe)}`;
  return `Semana del ${diaCorto(s.inicio)}: ${s.asaltos} asaltos en ${s.sesiones} sesiones, ${rpe}`;
}

function barras(semanas, modo) {
  const m = MODOS[modo];
  const max = m.max(semanas);
  const ultima = semanas.length - 1;
  return semanas.map((s, i) => {
    const v = m.valor(s);
    const alto = v == null || v === 0 ? 0 : Math.max(0.03, v / max);
    return `<li class="${i === ultima ? "actual" : ""}">
      <span class="solo-lectores">${esc(etiquetaSemana(s))}</span>
      <span class="valor" aria-hidden="true">${v == null ? "–" : fmt(v)}</span>
      <span class="barra" aria-hidden="true" style="--alto:${alto.toFixed(3)}"></span>
      <span class="eje" aria-hidden="true">${esc(etiquetaEje(semanas, i))}</span>
    </li>`;
  }).join("");
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
  const m = MODOS[modoElegido];
  const vacio = semanas.every((s) => s.sesiones === 0);
  return `
  <figure class="tarjeta grafico-semanas" aria-labelledby="t-grafico">
    <div class="cabeza-grafico">
      <h2 id="t-grafico" class="titulo-grafico">${m.titulo}</h2>
      <div class="selector" role="group" aria-label="Qué muestra el gráfico">
        ${Object.entries(MODOS).map(([id, x]) => `<button type="button" data-modo="${id}" aria-pressed="${id === modoElegido}">${x.boton}</button>`).join("")}
      </div>
    </div>
    ${vacio ? `<p class="nota">Aún no hay sesiones en las últimas ${semanas.length} semanas.</p>`
      : `<ol class="barras" style="--semanas:${semanas.length}">${barras(semanas, modoElegido)}</ol>${tabla(semanas)}`}
  </figure>`;
}

// Selector Asaltos / RPE: cambia título y barras sin repintar el resto del historial.
export function activarGrafico(raiz, semanas) {
  const figura = raiz.querySelector(".grafico-semanas");
  if (!figura) return;
  for (const boton of figura.querySelectorAll("[data-modo]")) {
    boton.addEventListener("click", () => {
      modoElegido = boton.dataset.modo;
      figura.querySelectorAll("[data-modo]").forEach((b) => b.setAttribute("aria-pressed", String(b === boton)));
      figura.querySelector(".titulo-grafico").textContent = MODOS[modoElegido].titulo;
      const lista = figura.querySelector(".barras");
      if (lista) lista.innerHTML = barras(semanas, modoElegido);
    });
  }
}
