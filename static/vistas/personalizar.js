// Sección «Personalizar sesión» del menú de Entrenar. Siempre enseña lo guardado de la Personalizada,
// también con la General (o Prueba) elegida; tocar algo pasa a la Personalizada con ese cambio (D3).
// «Practicar más» pasa al sorteo lo elegido (ajustes.js). Solo presenta y guarda en el perfil.
import { MAX_PRACTICAR, cambiarPracticar, preferencias } from "../ajustes.js";
import { catalogo, espejo, nombreHablado } from "../motor/acciones.js";
import { movimiento, movimientos } from "../motor/sorteo.js";
import { $, $$, anunciar, atraparFoco, esc } from "./dom.js";

const GRUPOS_PRACTICAR = { golpe: "Golpes", defensa: "Defensas", movimiento: "Salidas" };
const ICONO_CERRAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

// Los movimientos de «Practicar más» con su nombre y su grupo. Los golpes llevan su número y la
// mano de la guardia de Ajustes («3 crochet de izquierda»; al zurdo, «de derecha»).
function movimientosPracticar(zurdo) {
  const primera = new Map();
  for (const a of catalogo().values()) if (!primera.has(movimiento(a))) primera.set(movimiento(a), a);
  return movimientos().map((m) => {
    const a = primera.get(m);
    const nombre = m === "cuerpo" ? "golpes al cuerpo"
      : a.numero ? `${a.numero} ${nombreHablado(zurdo ? espejo(a) : a)}` : a.orden || a.plantilla.replace(" {lado}", "");
    return { movimiento: m, nombre, grupo: a.tipo };
  });
}

// Hueco lleno: el movimiento y quitarlo (un solo nivel: no hay «cuánto más»).
function huecoLleno(elegido, i, nombre) {
  return `<div class="hueco lleno" data-hueco="${i}" role="group" aria-labelledby="hueco-${i}" tabindex="-1">
    <div class="hueco-cabecera">
      <h3 id="hueco-${i}">${esc(nombre)}</h3>
      <button type="button" class="quitar-practicar" data-quitar="${esc(elegido.movimiento)}"
        aria-label="Quitar ${esc(nombre)}">${ICONO_CERRAR}</button>
    </div>
  </div>`;
}

// Panel para elegir (<dialog> nativo: hoja inferior en el móvil, centrado en el PC), con una pestaña
// por grupo. Golpes: del 1 al 6 en rejilla y «golpes al cuerpo» aparte, a todo el ancho; defensas y
// salidas, en lista. Lo ya elegido sale marcado y no se puede volver a elegir.
function panelPracticar(lista, elegidos) {
  const elegido = (m) => elegidos.some((e) => e.movimiento === m);
  const ficha = (m) => `<li><button type="button" class="ficha" data-elegir="${esc(m.movimiento)}"
    ${elegido(m.movimiento) ? 'aria-disabled="true"' : ""}><span>${esc(m.nombre)}</span>${elegido(m.movimiento)
      ? '<span class="marca-elegido" aria-hidden="true">✓</span><span class="solo-lectores"> (ya elegido)</span>' : ""}</button></li>`;
  const fichas = (clase, ms) => `<ul class="fichas ${clase}">${ms.map(ficha).join("")}</ul>`;
  const grupos = Object.entries(GRUPOS_PRACTICAR);
  return `<div class="hoja-contenido">
    <div class="hoja-cabecera">
      <h2 id="t-elegir">Añadir movimiento</h2>
      <button type="button" class="cerrar-hoja" data-cerrar aria-label="Cerrar">${ICONO_CERRAR}</button>
    </div>
    <div role="tablist" class="pestanas-hoja" aria-label="Tipo de movimiento">
      ${grupos.map(([grupo, titulo], i) => `<button type="button" role="tab" id="pestana-${grupo}"
        aria-controls="panel-${grupo}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${titulo}</button>`).join("")}
    </div>
    <div class="paneles-hoja">
      ${grupos.map(([grupo], i) => {
        const delGrupo = lista.filter((m) => m.grupo === grupo);
        return `<div role="tabpanel" id="panel-${grupo}" aria-labelledby="pestana-${grupo}" ${i ? "hidden" : ""}>
          ${grupo === "golpe"
            ? fichas("numeros", delGrupo.filter((m) => m.movimiento !== "cuerpo"))
              + fichas("lista aparte", delGrupo.filter((m) => m.movimiento === "cuerpo"))
            : fichas("lista", delGrupo)}</div>`;
      }).join("")}
    </div>
  </div>`;
}

function elegirPestana(pestana) {
  for (const p of $$('[role="tab"]', pestana.parentElement)) {
    const activa = p === pestana;
    p.setAttribute("aria-selected", String(activa));
    p.tabIndex = activa ? 0 : -1;
    document.getElementById(p.getAttribute("aria-controls")).hidden = !activa;
  }
}

// Pestañas con el teclado: flechas (en círculo), Inicio y Fin; solo la activa está en el orden de Tab.
function teclasPestanas(e) {
  const pestana = e.target.closest?.('[role="tab"]');
  if (!pestana) return;
  const pestanas = $$('[role="tab"]', pestana.parentElement);
  const i = pestanas.indexOf(pestana);
  const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: pestanas.length - 1 }[e.key];
  if (destino === undefined) return;
  e.preventDefault();
  const nueva = pestanas[(destino + pestanas.length) % pestanas.length];
  elegirPestana(nueva);
  nueva.focus();
}

// `alCambiar()`: tras guardar algo (Entrenar repinta el selector y «Tu sesión»).
export function iniciarPersonalizar({ almacen, alCambiar }) {
  const raiz = $("#menu-personalizar");
  const panel = $("#elegir-practicar");

  // Guarda un cambio de la Personalizada. Con la General o Prueba elegida, pasa a la Personalizada: lo
  // guardado + este cambio (D3); nunca se copian encima los valores de la General.
  function guardar(cambio) {
    const p = structuredClone(almacen.datos.perfil);
    cambio(p);
    const pasa = p.sesion.tipo !== "personalizada" || $('input[name="preset"]:checked')?.value === "prueba";
    p.sesion.tipo = "personalizada";
    almacen.guardarPerfil(p);
    anunciar(pasa ? "Guardado. Pasas a Personalizada." : "Guardado");
    alCambiar();
  }

  function pintar() {
    raiz.innerHTML = `<form class="formulario" id="f-practicar" aria-labelledby="t-practicar"></form>`;
    pintarPracticar();
  }

  // «Practicar más»: siempre MAX_PRACTICAR huecos del mismo tamaño, llenos por orden de elección. Uno
  // vacío abre el panel para elegir; uno lleno dice el movimiento y se puede quitar.
  function pintarPracticar() {
    const elegidos = almacen.datos.perfil.practicar;
    const lista = movimientosPracticar(preferencias(almacen.datos.perfil).zurdo);
    const nombre = new Map(lista.map((m) => [m.movimiento, m.nombre]));
    const huecos = Array.from({ length: MAX_PRACTICAR }, (_, i) => elegidos[i]);
    $("#f-practicar").innerHTML = `
      <div>
        <h3 id="t-practicar" class="titulo-campo" tabindex="-1">Practicar más</h3>
        <p class="nota">Elige hasta ${MAX_PRACTICAR} movimientos: las combinaciones que los llevan saldrán más a menudo.
          Nunca se quita ninguna.</p>
      </div>
      <ul class="huecos-practicar">
        ${huecos.map((e, i) => `<li>${e ? huecoLleno(e, i, nombre.get(e.movimiento) ?? e.movimiento) : `
          <button type="button" class="hueco vacio" data-hueco="${i}" aria-haspopup="dialog">
            <span aria-hidden="true">+</span> Añadir movimiento</button>`}</li>`).join("")}
      </ul>
      <p class="nota" id="practicar-estado">${elegidos.length
        ? `${elegidos.length} de ${MAX_PRACTICAR} elegidos.` : "Ahora todas salen igual de a menudo."}</p>`;
    panel.innerHTML = panelPracticar(lista, elegidos);
  }

  function guardarPracticar(movimiento_, elegir) {
    guardar((p) => (p.practicar = cambiarPracticar(p.practicar, movimiento_, elegir)));
  }

  let origen = 0; // el hueco desde el que se abrió el panel: ahí vuelve el foco si no se elige nada

  raiz.addEventListener("click", (e) => {
    const vacio = e.target.closest(".hueco.vacio");
    if (vacio) {
      origen = Number(vacio.dataset.hueco);
      panel.returnValue = "";
      panel.showModal();
      $('[role="tab"][aria-selected="true"]', panel).focus();
      return;
    }
    const quitar = e.target.closest("[data-quitar]");
    if (!quitar) return;
    guardarPracticar(quitar.dataset.quitar, false);
    pintarPracticar();
    // El hueco que queda vacío es el primero sin elegir: los demás suben.
    $(`[data-hueco="${almacen.datos.perfil.practicar.length}"]`, raiz).focus();
  });
  raiz.addEventListener("submit", (e) => e.preventDefault()); // Intro nunca empieza nada

  panel.addEventListener("click", (e) => {
    // Fuera del contenido (el velo) o en «Cerrar», se cierra sin elegir.
    if (e.target === panel || e.target.closest("[data-cerrar]")) return panel.close();
    const pestana = e.target.closest('[role="tab"]');
    if (pestana) return elegirPestana(pestana);
    const ficha = e.target.closest("[data-elegir]");
    if (!ficha || ficha.getAttribute("aria-disabled") === "true") return;
    guardarPracticar(ficha.dataset.elegir, true);
    panel.close("elegido");
  });
  panel.addEventListener("keydown", teclasPestanas);
  panel.addEventListener("keydown", atraparFoco);
  // Esc, «Cerrar» o elegir: se repinta y el foco vuelve a la tarjeta (la recién llenada, si se eligió).
  // Si el menú se ha cerrado (atrás con el panel abierto), no hay adónde volver.
  panel.addEventListener("close", () => {
    pintarPracticar();
    if (!$("#menu").open) return;
    const hueco = panel.returnValue === "elegido" ? almacen.datos.perfil.practicar.length - 1 : origen;
    $(`[data-hueco="${hueco}"]`, raiz)?.focus();
  });

  pintar();
  return {
    pintar,
    // Al cerrar el menú (atrás, cambiar de vista): la hoja de elegir, encima de él, se cierra también.
    cerrar() { if (panel.open) panel.close(); },
  };
}
