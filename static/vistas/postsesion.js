// Formulario de valoración de una sesión (<dialog> nativo: mantiene el foco dentro y se
// cierra con Esc). Se abre al terminar una sesión y desde el detalle del historial.
import { $, $$, anunciar, esc } from "./dom.js";
import { SENSACION } from "./opciones.js";

function radios(nombre, valores, actual, textos = []) {
  return valores.map((v, i) => `
    <label class="chip"><input type="radio" name="${nombre}" value="${v}" ${actual === v ? "checked" : ""}>
      <span>${v}${textos[i] ? `<small>${textos[i]}</small>` : ""}</span></label>`).join("");
}

function listaCombos(combinaciones, costosas) {
  if (!combinaciones.length) return `<p class="nota">No se dictó ninguna combinación.</p>`;
  const asaltos = [...new Set(combinaciones.map((c) => c.asalto))];
  return asaltos.map((a) => `
    <fieldset class="grupo-combos"><legend>Asalto ${a}</legend>
      ${combinaciones.map((c, i) => c.asalto !== a ? "" : `
        <label class="check"><input type="checkbox" name="costosas" value="${i}" ${costosas.includes(i) ? "checked" : ""}>
          <span>${esc(c.texto)}</span></label>`).join("")}
    </fieldset>`).join("");
}

export function crearValoracion({ almacen }) {
  const dialogo = document.getElementById("postsesion");

  /**
   * Abre el formulario. Resuelve true si se guardó y false si se saltó.
   * combinaciones: las dictadas, en orden (costosas guarda sus índices).
   */
  function abrir({ clave, combinaciones, titulo = "¿Qué tal la sesión?" }) {
    const v = almacen.valoracion(clave) ?? { rpe: null, sensacion: null, bien: "", corregir: "", costosas: [] };
    dialogo.innerHTML = `
      <form method="dialog" class="formulario">
        <h2 id="t-post">${esc(titulo)}</h2>
        <fieldset class="chips"><legend>Esfuerzo percibido (RPE)<small>1 muy suave · 10 al máximo</small></legend>
          ${radios("rpe", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], v.rpe)}</fieldset>
        <fieldset class="chips"><legend>Cómo me he sentido</legend>
          ${radios("sensacion", [1, 2, 3, 4, 5], v.sensacion, SENSACION)}</fieldset>
        <label class="campo">Qué ha salido bien
          <textarea name="bien" rows="2" maxlength="280">${esc(v.bien)}</textarea></label>
        <label class="campo">Qué tengo que corregir
          <textarea name="corregir" rows="2" maxlength="280">${esc(v.corregir)}</textarea></label>
        <details class="costosas" ${v.costosas.length ? "open" : ""}>
          <summary>Combinaciones que me han costado</summary>
          ${listaCombos(combinaciones, v.costosas)}
        </details>
        <div class="acciones">
          <button type="submit" value="saltar" class="boton secundario">Saltar</button>
          <button type="submit" value="guardar" class="boton principal">Guardar</button>
        </div>
      </form>`;
    dialogo.setAttribute("aria-labelledby", "t-post");

    return new Promise((resolver) => {
      dialogo.addEventListener("close", () => {
        if (dialogo.returnValue !== "guardar") return resolver(false);
        const form = $("form", dialogo);
        const numero = (nombre) => {
          const marcado = $(`input[name="${nombre}"]:checked`, form);
          return marcado ? Number(marcado.value) : null;
        };
        almacen.guardarValoracion(clave, {
          rpe: numero("rpe"),
          sensacion: numero("sensacion"),
          bien: form.bien.value.trim(),
          corregir: form.corregir.value.trim(),
          costosas: $$('input[name="costosas"]:checked', form).map((c) => Number(c.value)),
        });
        anunciar("Valoración guardada");
        resolver(true);
      }, { once: true });
      dialogo.returnValue = "";
      dialogo.showModal();
    });
  }

  return { abrir };
}
