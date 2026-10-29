// Pantalla Ajustes (#ajustes): lo que cambia el entreno. Se guarda al cambiar cada campo, solo en
// este navegador. En el móvil se entra por el engranaje y «Volver» lleva a la pestaña de antes.
import { $ } from "./dom.js";

// La pestaña desde la que se entró en Ajustes (a la que vuelve «Volver»).
let vuelta = "#entrenar";
window.addEventListener("hashchange", (e) => {
  const desde = new URL(e.oldURL).hash;
  if (!desde.startsWith("#ajustes")) vuelta = desde || "#entrenar";
});

export function iniciarAjustes() {
  const raiz = $("#ajustes-contenido");

  function pintar() {
    $("#volver-ajustes").href = vuelta;
    raiz.innerHTML = "";
  }

  return { mostrar: pintar };
}
