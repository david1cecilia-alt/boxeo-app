// Pantalla Ajustes (#ajustes): lo que cambia el entreno. Se guarda al cambiar cada campo, solo en
// este navegador. En el móvil se entra por el engranaje y «Volver» lleva a la pestaña de antes.
// Los pesos sustituyen a los de data/perfil.json en el generador.
import { PESOS } from "../ajustes.js";
import { datos } from "../motor/datos.js";
import { chips, conectarCampos } from "./campos.js";
import { $, $$, anunciar } from "./dom.js";
import { BASICOS, PESOS_TEXTO, RANGO_PESO } from "./opciones.js";

const pesoTexto = (n) => `×${n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

// La pestaña desde la que se entró en Ajustes (a la que vuelve «Volver»).
let vuelta = "#entrenar";
window.addEventListener("hashchange", (e) => {
  const desde = new URL(e.oldURL).hash;
  if (!desde.startsWith("#ajustes")) vuelta = desde || "#entrenar";
});

export function iniciarAjustes({ almacen }) {
  const raiz = $("#ajustes-contenido");

  // Copia del perfil para editar y guardar entero.
  function guardar(cambio) {
    const p = structuredClone(almacen.datos.perfil);
    cambio(p);
    almacen.guardarPerfil(p);
    anunciar("Guardado");
    $("#guardado-ajustes").textContent = almacen.persistente ? "Guardado." : "Guardado solo en memoria.";
  }

  function pintar() {
    $("#volver-ajustes").href = vuelta;
    const p = almacen.datos.perfil;
    const pesos = p.pesos ?? datos().perfil.pesos;
    raiz.innerHTML = `
      <form class="tarjeta formulario" id="f-tus-datos" aria-labelledby="t-tus-datos">
        <div>
          <h2 id="t-tus-datos">Tus datos</h2>
          <p class="nota">Lo que se propone en Entrenar. Si lo cambias aquí, Entrenar se pone igual.</p>
        </div>
        ${Object.entries(BASICOS).map(([c, def]) => chips("basicos", c, def, p.basicos[c])).join("")}
      </form>

      <form class="tarjeta formulario" id="f-pesos" aria-labelledby="t-pesos">
        <div>
          <h2 id="t-pesos" tabindex="-1">Qué te dicta la app</h2>
          <p class="nota">Más a la derecha, más a menudo. 1 = neutro.
            ${p.pesos ? "Estás usando tus valores." : "Ahora mismo, los valores por defecto."}</p>
        </div>
        ${PESOS.map((c) => `
          <div class="deslizador">
            <label for="peso-${c}">${PESOS_TEXTO[c].etiqueta}</label>
            <output for="peso-${c}" id="valor-${c}">${pesoTexto(pesos[c])}</output>
            <input type="range" id="peso-${c}" data-peso="${c}" min="${RANGO_PESO.min}" max="${RANGO_PESO.max}"
              step="${RANGO_PESO.paso}" value="${pesos[c]}" aria-describedby="ayuda-${c}">
            <p class="solo-lectores" id="ayuda-${c}">${PESOS_TEXTO[c].ayuda}</p>
          </div>`).join("")}
        <button type="button" id="pesos-defecto" class="boton pequeno" ${p.pesos ? "" : "disabled"}>
          Volver a los valores por defecto</button>
      </form>

      <p class="nota pie-perfil">Tus ajustes se guardan solo en este dispositivo. <span id="guardado-ajustes"></span></p>`;
    conectar();
  }

  function conectar() {
    conectarCampos(raiz, guardar);

    for (const r of $$("[data-peso]", raiz)) {
      r.addEventListener("input", () => ($(`#valor-${r.dataset.peso}`).textContent = pesoTexto(Number(r.value))));
      r.addEventListener("change", () => {
        guardar((p) => (p.pesos = Object.fromEntries(PESOS.map((c) => [c, Number($(`#peso-${c}`).value)]))));
        $("#pesos-defecto").disabled = false;
      });
    }
    $("#pesos-defecto").addEventListener("click", () => {
      guardar((p) => (p.pesos = null));
      pintar();
      $("#t-pesos").focus();
    });
  }

  return { mostrar: pintar };
}
