// «Mis combinaciones» (#ajustes/mis-combinaciones): las combinaciones propias, en el almacén de este
// navegador. Listado con editar y borrar (con confirmación). Solo presenta: qué se enseña y cómo se
// dice está en ../creador.js; guardar, en el almacén.
import { combinacionesParaListar, puedeCrear, textoBorrar } from "../creador.js";
import { MAX_PROPIAS } from "../motor/reglas.js";
import { $, anunciar, atraparFoco, esc } from "./dom.js";

export const RUTA = "#ajustes/mis-combinaciones";

const ICONO_EDITAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>`;
const ICONO_BORRAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;
export const NOTA_ORTODOXA = "Se crean para guardia ortodoxa; en zurdo la app las cambia de lado, como al resto.";

// Las fichas de una combinación con el código de la sesión: golpe = círculo rojo con su número,
// defensa = círculo con borde, salida = círculo discontinuo.
export function fichasHtml(fichas) {
  return fichas.map((f) => `<li class="paso-${f.tipo}"><i>${f.numero ?? ""}</i>${esc(f.texto)}</li>`).join("");
}

// Un botón desactivado con aria-disabled (sigue en el orden del foco y dice por qué): no hace nada.
export const desactivado = (boton) => boton?.getAttribute("aria-disabled") === "true";

// Abre un <dialog> modal con el foco en `inicial`; al cerrarse llama a `alCerrar(returnValue)`.
export function abrirDialogo(dialogo, inicial, alCerrar) {
  dialogo.returnValue = "";
  dialogo.showModal();
  $(inicial, dialogo)?.focus();
  dialogo.addEventListener("close", () => alCerrar(dialogo.returnValue), { once: true });
}

// Los diálogos se cierran con Esc, tocando el velo o con sus botones (value = lo elegido).
function conectarDialogo(dialogo) {
  dialogo.addEventListener("keydown", atraparFoco);
  dialogo.addEventListener("click", (e) => {
    if (e.target === dialogo) return dialogo.close("");
    const boton = e.target.closest("button[value]");
    if (boton) dialogo.close(boton.value);
  });
}

export function iniciarCreador({ almacen, raiz }) {
  const propias = () => almacen.datos.combinacionesPropias;

  // ---------- Listado ----------
  function pintarListado({ foco = null } = {}) {
    const lista = combinacionesParaListar(propias());
    const crear = puedeCrear(propias());
    raiz.innerHTML = `
      <p class="volver-sub"><a href="#ajustes" class="volver">← Volver</a></p>
      <header class="cabecera-sub">
        <h1 id="t-creador" tabindex="-1">Mis <span class="acento">combinaciones</span></h1>
        <p class="nota">${lista.length} de ${MAX_PROPIAS}. ${NOTA_ORTODOXA}</p>
      </header>
      ${lista.length ? `<ol class="lista-propias">${lista.map((c) => `
        <li class="tarjeta propia" data-propia="${esc(c.id)}">
          <div class="propia-cabecera">
            <h2 id="t-${esc(c.id)}">${c.titulo}</h2>
            ${c.textoNivel ? `<span class="pastilla-nivel">${c.textoNivel}</span>` : ""}
            <button type="button" class="boton-icono" data-editar="${esc(c.id)}"
              aria-label="Editar combinación ${c.numero}">${ICONO_EDITAR}</button>
            <button type="button" class="boton-icono" data-borrar="${esc(c.id)}"
              aria-label="Borrar combinación ${c.numero}">${ICONO_BORRAR}</button>
          </div>
          <p class="solo-lectores">${esc(c.hablado)}</p>
          <ul class="fichas-combo" aria-hidden="true">${fichasHtml(c.fichas)}</ul>
        </li>`).join("")}</ol>`
      : `<p class="tarjeta vacio-propias">Aún no tienes ninguna. Crea las tuyas con los golpes, defensas y salidas
          que quieras trabajar: en Entrenar podrás mezclarlas con las de la biblioteca.</p>`}
      <button type="button" class="anadir-propia" id="anadir-propia"
        ${crear.puede ? "" : 'aria-disabled="true" aria-describedby="motivo-anadir"'}>
        <span aria-hidden="true">+</span> Añadir combinación</button>
      ${crear.motivo ? `<p class="nota motivo" id="motivo-anadir">${crear.motivo}</p>` : ""}
      <dialog id="d-borrar" aria-labelledby="t-borrar" aria-describedby="detalle-borrar">
        <h2 id="t-borrar"></h2>
        <p id="detalle-borrar" class="nota"></p>
        <div class="acciones">
          <button type="button" class="boton secundario" value="">Cancelar</button>
          <button type="button" class="boton peligro" value="borrar">Borrar</button>
        </div>
      </dialog>`;
    conectarDialogo($("#d-borrar", raiz));
    if (foco) $(foco, raiz)?.focus();
  }

  function borrar(id) {
    const i = propias().findIndex((p) => p.id === id);
    const { titulo, detalle } = textoBorrar(i + 1, propias().length);
    const dialogo = $("#d-borrar", raiz);
    $("#t-borrar", dialogo).textContent = titulo;
    $("#detalle-borrar", dialogo).textContent = detalle;
    abrirDialogo(dialogo, 'button[value=""]', (valor) => {
      if (valor !== "borrar") return $(`[data-borrar="${CSS.escape(id)}"]`, raiz)?.focus();
      almacen.borrarPropia(id);
      anunciar(`Borrada la combinación ${i + 1}.`);
      // El foco, a la que ocupa ahora su sitio (la siguiente) o, si era la última, a «Añadir».
      const siguiente = propias()[i] ?? propias()[i - 1];
      pintarListado({ foco: siguiente ? `[data-borrar="${CSS.escape(siguiente.id)}"]` : "#anadir-propia" });
    });
  }

  raiz.addEventListener("click", (e) => {
    if (!raiz.querySelector(".lista-propias, .vacio-propias")) return;
    const boton = e.target.closest("button");
    if (!boton || desactivado(boton)) return;
    if (boton.id === "anadir-propia") location.hash = `${RUTA}/nueva`;
    else if (boton.dataset.editar) location.hash = `${RUTA}/editar/${boton.dataset.editar}`;
    else if (boton.dataset.borrar) borrar(boton.dataset.borrar);
  });

  // `ruta`: lo que va detrás de «mis-combinaciones/» («», «nueva», «editar/<id>»).
  function mostrar(ruta) {
    pintarListado();
    $("#t-creador", raiz).focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  return { mostrar };
}
