// Campos del perfil compartidos por Perfil y Ajustes: chips de opciones cerradas y el guardado
// al cambiar de cada campo [data-grupo][data-campo].
import { NO_SE } from "../almacen.js";
import { seguirBasicos } from "../ajustes.js";
import { $$, esc } from "./dom.js";

// Opciones cerradas como chips (radios); "No lo sé" va la última.
export function chips(grupo, campo, { etiqueta, opciones }, actual) {
  const orden = [...opciones.filter(([v]) => v !== NO_SE), ...opciones.filter(([v]) => v === NO_SE)];
  return `<fieldset class="grupo-chips"><legend>${etiqueta}</legend><div class="chips-fila">
    ${orden.map(([v, texto]) => `<label class="chip-opcion"><input type="radio" name="${grupo}-${campo}" value="${v}"
      data-grupo="${grupo}" data-campo="${campo}" ${String(actual ?? NO_SE) === v ? "checked" : ""}><span>${esc(texto)}</span></label>`).join("")}
  </div></fieldset>`;
}

// Chips, fechas y medidas: se guardan al cambiar. `guardar(cambio)` aplica `cambio` a una copia
// del perfil y la guarda. Guardia y Nivel cambian también lo propuesto en Entrenar.
export function conectarCampos(raiz, guardar) {
  for (const el of $$("[data-grupo]", raiz)) {
    el.addEventListener("change", () => {
      if (el.dataset.numero !== undefined && el.value !== "" && !el.checkValidity()) {
        el.reportValidity();
        return;
      }
      guardar((p) => {
        const valor = el.dataset.numero !== undefined ? (el.value === "" ? null : Number(el.value))
          : el.type === "date" ? (el.value || null) : el.value;
        p[el.dataset.grupo][el.dataset.campo] = valor;
        if (el.dataset.grupo === "basicos") seguirBasicos(p, el.dataset.campo);
      });
    });
  }
}
