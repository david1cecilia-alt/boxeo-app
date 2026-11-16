// Sección «Personalizar sesión» del menú de Entrenar: asaltos, duración, descanso, nivel, ritmo, «Practicar
// más», «Tus combinaciones» y Reacción. Siempre enseña lo guardado de la Personalizada, también con la General
// (o Prueba) elegida: entonces lleva arriba el aviso, y tocar algo pasa a la Personalizada con lo guardado más
// ese cambio (D3); nunca se copian encima los valores de la General. Solo presenta y guarda en el perfil.
import {
  MAX_PRACTICAR, NOMBRE_RITMO, OPCIONES_MEZCLA, cambiarPracticar, estadoMezcla, personalizadaValida, preferencias,
} from "../ajustes.js";
import { catalogo, espejo, nombreHablado } from "../motor/acciones.js";
import { PAUSA_POR_RITMO } from "../motor/ritmo.js";
import { movimiento, movimientos } from "../motor/sorteo.js";
import { RUTA as RUTA_CREADOR } from "./creador.js";
import { $, $$, anunciar, atraparFoco, esc } from "./dom.js";

const NOMBRE_TIPO = { general: "General", prueba: "Prueba" };
// El aviso de arriba con la General o Prueba elegida (con la Personalizada, ninguno).
export const avisoPersonalizar = (tipo) => (NOMBRE_TIPO[tipo]
  ? `Estás en ${NOMBRE_TIPO[tipo]}. Estos son los ajustes de tu Personalizada; si cambias algo, pasarás a ella.` : "");
const decimal = (x) => String(x).replace(".", ",");

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

// `tipoElegido()`: lo que marca el selector de Entrenar ("general", "personalizada" o "prueba").
// `alCambiar()`: tras guardar algo (Entrenar repinta el selector y «Tu sesión»).
export function iniciarPersonalizar({ almacen, tipoElegido, alCambiar }) {
  const raiz = $("#menu-personalizar");
  const panel = $("#elegir-practicar");

  // Guarda un cambio de la Personalizada en una sola escritura: el cambio y el tipo. Con la General o Prueba
  // elegida, pasa a la Personalizada con lo guardado + este cambio (D3).
  function guardar(cambio) {
    const pasa = tipoElegido() !== "personalizada";
    const p = structuredClone(almacen.datos.perfil);
    cambio(p);
    p.sesion.tipo = "personalizada";
    almacen.guardarPerfil(p);
    anunciar(pasa ? "Guardado. Pasas a Personalizada." : "Guardado");
    alCambiar();
    actualizar();
  }

  function pintar() {
    const { nivel, ritmo, reaccion, mezcla, personalizada } = preferencias(almacen.datos.perfil);
    raiz.innerHTML = `
      <p id="aviso-personalizar" class="aviso-personalizar" role="status"></p>
      <form class="formulario" id="f-personalizar" aria-label="Tu Personalizada">
        <div class="rejilla rejilla-asaltos">
          <label class="campo">Asaltos <input id="asaltos" type="number" inputmode="numeric" min="1" max="20" value="${personalizada.asaltos}"></label>
          <label class="campo">Duración (s) <input id="duracion" type="number" inputmode="numeric" min="20" max="600" step="10" value="${personalizada.duracion_asalto}"></label>
          <label class="campo">Descanso (s) <input id="descanso" type="number" inputmode="numeric" min="0" max="300" step="5" value="${personalizada.descanso}"></label>
        </div>
        <fieldset class="niveles" id="niveles" aria-describedby="nota-nivel">
          <legend><span>Nivel</span></legend>
          ${[[1, "Básico"], [2, "Medio"], [3, "Avanzado"]].map(([n, nombre]) => `<label><input type="radio" name="nivel"
            value="${n}" ${n === nivel ? "checked" : ""}><span><b>${n}</b>${nombre}</span></label>`).join("")}
        </fieldset>
        <p id="nota-nivel" class="nota nota-campo" hidden></p>
        <div class="ritmo">
          <label for="ritmo" class="cabeza-campo"><span>Ritmo</span><span id="resumen-ritmo" class="resumen-config"></span></label>
          <input type="range" id="ritmo" min="1" max="5" step="1" value="${ritmo}" aria-describedby="resumen-ritmo">
          <div class="marcas-ritmo" aria-hidden="true"><span>Calmado</span><span>Intenso</span></div>
        </div>
        <div id="f-practicar" class="practicar" role="group" aria-labelledby="t-practicar"></div>
        <div class="mezcla">
          <fieldset class="niveles mezclas" id="mezclas" aria-describedby="nota-mezcla">
            <legend><span>Tus combinaciones</span></legend>
            ${OPCIONES_MEZCLA.map(({ id, nombre, porcentaje }) =>
              `<label${id === "solo" ? ' class="mezcla-solo"' : ""}><input type="radio" name="mezcla" value="${id}"
                ${id === mezcla ? "checked" : ""}><span><b>${porcentaje} %</b>${esc(nombre)}</span></label>`).join("")}
          </fieldset>
          <p id="nota-mezcla" class="nota nota-campo" hidden></p>
        </div>
        <label class="interruptor"><span>Reacción<small class="solo-lectores">: señales al azar, esquiva, contra, sal…</small></span>
          <input type="checkbox" role="switch" id="reaccion" ${reaccion ? "checked" : ""}></label>
      </form>`;
    pintarPracticar();
    actualizar();
  }

  // Lo que depende de lo guardado y de lo elegido sin rehacer los campos (el foco y lo que se escribe se
  // quedan): el aviso, el ritmo en palabras y los estados de «Tus combinaciones» y del nivel.
  function actualizar() {
    if (!$("#f-personalizar", raiz)) return;
    const aviso = avisoPersonalizar(tipoElegido());
    const caja = $("#aviso-personalizar", raiz);
    if (caja.textContent !== aviso) caja.textContent = aviso;
    pintarRitmo(Number($("#ritmo", raiz).value));
    pintarMezcla();
  }

  // Hueco desde que la voz termina hasta la siguiente (se golpea mientras se oye).
  function pintarRitmo(ritmo) {
    const [min, max] = PAUSA_POR_RITMO[ritmo];
    const hueco = min === max ? decimal(min) : `${decimal(min)}–${decimal(max)}`;
    $("#resumen-ritmo", raiz).textContent = `${NOMBRE_RITMO[ritmo]} · ${hueco} s entre combinaciones`;
    $("#ritmo", raiz).style.setProperty("--lleno", `${(ritmo - 1) * 25}%`);
  }

  // Estados de «Tus combinaciones» (y del nivel) con las propias de ahora y lo guardado. Los desactivados
  // lo están de verdad (disabled): el motivo va escrito debajo y en aria-describedby del grupo.
  function pintarMezcla() {
    const { mezcla, nivel } = preferencias(almacen.datos.perfil);
    const { total, motivoSolo, aviso, nivelCuenta } = estadoMezcla(mezcla, almacen.datos.combinacionesPropias, nivel);
    $("#mezclas", raiz).disabled = total === 0;
    $('input[name="mezcla"][value="solo"]', raiz).disabled = total > 0 && Boolean(motivoSolo);
    $("#niveles", raiz).disabled = !nivelCuenta;
    const notaNivel = $("#nota-nivel", raiz);
    notaNivel.hidden = nivelCuenta;
    notaNivel.textContent = nivelCuenta ? "" : "Con «Solo las mías» no cuenta el nivel: salen todas las tuyas.";
    const nota = $("#nota-mezcla", raiz);
    if (total === 0) {
      nota.innerHTML = `Aún no tienes combinaciones propias. <a href="${RUTA_CREADOR}/nueva">Crea la primera</a> y mézclala con la biblioteca.`;
    } else {
      nota.textContent = [motivoSolo, aviso].filter(Boolean).join(" ");
    }
    nota.hidden = !nota.textContent;
  }

  // Asaltos, duración y descanso: se guardan en cuanto son válidos (a medio escribir, no; tampoco pasa a la
  // Personalizada).
  raiz.addEventListener("input", (e) => {
    if (e.target.id === "ritmo") return pintarRitmo(Number(e.target.value));
    if (!["asaltos", "duracion", "descanso"].includes(e.target.id)) return;
    const personalizada = {
      asaltos: Number($("#asaltos", raiz).value), duracion_asalto: Number($("#duracion", raiz).value),
      descanso: Number($("#descanso", raiz).value),
    };
    if (personalizadaValida(personalizada)) guardar((p) => (p.sesion.personalizada = personalizada));
  });
  raiz.addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "nivel") guardar((p) => (p.sesion.nivel = Number(t.value)));
    else if (t.name === "mezcla") guardar((p) => (p.sesion.mezcla = t.value));
    else if (t.id === "ritmo") guardar((p) => (p.sesion.ritmo = Number(t.value)));
    else if (t.id === "reaccion") guardar((p) => (p.sesion.reaccion = t.checked));
  });

  // «Practicar más»: siempre MAX_PRACTICAR huecos del mismo tamaño, llenos por orden de elección. Uno
  // vacío abre el panel para elegir; uno lleno dice el movimiento y se puede quitar.
  function pintarPracticar() {
    const elegidos = almacen.datos.perfil.practicar;
    const lista = movimientosPracticar(preferencias(almacen.datos.perfil).zurdo);
    const nombre = new Map(lista.map((m) => [m.movimiento, m.nombre]));
    const huecos = Array.from({ length: MAX_PRACTICAR }, (_, i) => elegidos[i]);
    $("#f-practicar", raiz).innerHTML = `
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
    actualizar,
    // Al cerrar el menú (atrás, cambiar de vista): la hoja de elegir, encima de él, se cierra también.
    cerrar() { if (panel.open) panel.close(); },
  };
}
