// Diálogo de confirmación de la app, en vez del confirm() del navegador (que bloquea la página y no se
// puede adaptar): un <dialog> modal con el título, una explicación, «Cancelar» (con el foco al abrir, para
// que un Intro sin pensar no borre nada) y el botón de la acción, en rojo. Esc o tocar el velo cancelan; al
// cerrar, el foco vuelve a donde estaba (el botón que lo abrió). Se crea una vez, al final de <body>.
import { $, abrirDialogo, conectarDialogo } from "./dom.js";

let dialogo = null;

function crear() {
  dialogo = document.createElement("dialog");
  dialogo.id = "d-confirmar";
  dialogo.setAttribute("aria-labelledby", "t-confirmar");
  dialogo.setAttribute("aria-describedby", "detalle-confirmar");
  dialogo.innerHTML = `
    <h2 id="t-confirmar"></h2>
    <p id="detalle-confirmar" class="nota"></p>
    <div class="acciones">
      <button type="button" class="boton secundario" value=""></button>
      <button type="button" class="boton peligro" value="si"></button>
    </div>`;
  document.body.append(dialogo);
  conectarDialogo(dialogo);
}

// confirmar({ titulo, texto, si, no }) → Promise<boolean>: true solo si se pulsa el botón de la acción (`si`).
export function confirmar({ titulo, texto = "", si, no = "Cancelar" }) {
  if (!dialogo) crear();
  const volver = document.activeElement;
  $("#t-confirmar", dialogo).textContent = titulo;
  $("#detalle-confirmar", dialogo).textContent = texto;
  $('button[value=""]', dialogo).textContent = no;
  $('button[value="si"]', dialogo).textContent = si;
  return new Promise((listo) => {
    abrirDialogo(dialogo, 'button[value=""]', (valor) => {
      if (volver?.isConnected) volver.focus({ preventScroll: true });
      listo(valor === "si");
    });
  });
}
