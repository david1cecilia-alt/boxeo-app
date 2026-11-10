// Pantalla Ajustes (#ajustes): la voz y «Practicar más». Se guarda al cambiar cada campo, solo en
// este navegador. En el móvil se entra por el engranaje y «Volver» (fijo arriba al bajar) lleva a la
// pestaña de antes. Guardia y nivel se eligen en Entrenar.
// «Practicar más» pasa al sorteo lo elegido (ajustes.js). La voz y su velocidad se aplican al
// momento (también a la línea «Voz: …» de Entrenar).
import { MAX_PRACTICAR, NOMBRE_VELOCIDAD, cambiarPracticar, opcionesVoz, preferencias } from "../ajustes.js";
import { accionesPorIds, catalogo, espejo, nombreHablado, textoHablado } from "../motor/acciones.js";
import { VELOCIDADES } from "../motor/ritmo.js";
import { movimiento, movimientos } from "../motor/sorteo.js";
import { nombreCortoVoz } from "../voz.js";
import { MAX_PROPIAS } from "../motor/reglas.js";
import { RUTA as RUTA_CREADOR, iniciarCreador } from "./creador.js";
import { $, $$, anunciar, atraparFoco, esc } from "./dom.js";

const GRUPOS_PRACTICAR = { golpe: "Golpes", defensa: "Defensas", movimiento: "Salidas" };
const ICONO_CERRAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

// Los movimientos de «Practicar más» con su nombre y su grupo. Los golpes llevan su número y la
// mano de la guardia de Entrenar («3 crochet de izquierda»; al zurdo, «de derecha»).
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

const EJEMPLO = ["jab", "directo", "gancho_izq"]; // lo que dice «Probar voz»
const numeroEs = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 1 });
// «Microsoft Helena (es-ES)»: el idioma va pegado al nombre y entero (el guion de «es-ES» partía la línea).
const sinCortarIdioma = (texto) => esc(texto).replace(/ (\([^)]*\))$/, '&nbsp;<span class="sin-cortar">$1</span>');

// La pestaña desde la que se entró en Ajustes (a la que vuelve «Volver»).
let vuelta = "#entrenar";
window.addEventListener("hashchange", (e) => {
  const desde = new URL(e.oldURL).hash;
  if (!desde.startsWith("#ajustes")) vuelta = desde || "#entrenar";
});

export function iniciarAjustes({ almacen, voz }) {
  const raiz = $("#ajustes-contenido");
  // Al cargar las voces (o elegir otra) se rehace el selector si Ajustes está a la vista.
  voz.alCambiar?.(() => {
    if (raiz.isConnected && !$("#vista-ajustes").hidden && $("#voz-id")) pintarVoces();
  });

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
    raiz.innerHTML = `
      <a href="${RUTA_CREADOR}" class="tarjeta tarjeta-enlace" id="ir-creador">
        <span class="tarjeta-enlace-texto">
          <span class="titular">Mis combinaciones
            <span class="acento">${almacen.datos.combinacionesPropias.length}/${MAX_PROPIAS}</span></span>
          <span class="nota">Crea las tuyas y mézclalas con la biblioteca en Entrenar.</span>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </a>

      <form class="tarjeta formulario" id="f-voz" aria-labelledby="t-voz">
        <div class="voz-cabeza">
          <h2 id="t-voz">Voz</h2>
          <p class="nota">La que te dicta las combinaciones.</p>
        </div>
        <div class="voz-eleccion">
          <label class="campo">Voz <select id="voz-id" aria-describedby="voz-aviso"></select></label>
          <p class="nota" id="voz-aviso"></p>
        </div>
        <div class="voz-velocidad">
          <fieldset class="grupo-chips"><legend>Velocidad</legend><div class="chips-fila velocidades">
            ${Object.entries(VELOCIDADES).map(([clave, valor]) => `<label class="chip-opcion">
              <input type="radio" name="voz-velocidad" value="${clave}" ${p.voz.velocidad === clave ? "checked" : ""}>
              <span>${NOMBRE_VELOCIDAD[clave]} <small>${numeroEs(valor)}</small></span></label>`).join("")}
          </div></fieldset>
          <button type="button" id="probar-voz" class="boton secundario">Probar voz</button>
        </div>
      </form>

      <form class="tarjeta formulario" id="f-practicar" aria-labelledby="t-practicar"></form>
      <dialog id="elegir-practicar" class="hoja" aria-labelledby="t-elegir"></dialog>

      <p class="nota pie-perfil">Tus ajustes se guardan solo en este dispositivo. <span id="guardado-ajustes"></span></p>`;
    pintarVoces();
    pintarPracticar();
    conectarPracticar();
    conectar();
  }

  // «Practicar más»: siempre MAX_PRACTICAR huecos del mismo tamaño, llenos por orden de elección. Uno
  // vacío abre el panel para elegir; uno lleno dice el movimiento y cuánto más, y se puede quitar.
  function pintarPracticar() {
    const elegidos = almacen.datos.perfil.practicar;
    const lista = movimientosPracticar(preferencias(almacen.datos.perfil).zurdo);
    const nombre = new Map(lista.map((m) => [m.movimiento, m.nombre]));
    const huecos = Array.from({ length: MAX_PRACTICAR }, (_, i) => elegidos[i]);
    $("#f-practicar").innerHTML = `
      <div>
        <h2 id="t-practicar" tabindex="-1">Practicar más</h2>
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
    $("#elegir-practicar").innerHTML = panelPracticar(lista, elegidos);
  }

  function guardarPracticar(movimiento_, elegir) {
    guardar((p) => (p.practicar = cambiarPracticar(p.practicar, movimiento_, elegir)));
  }

  // Se conecta una vez por pintar(): el formulario y el panel se rehacen por dentro, no ellos.
  function conectarPracticar() {
    const formulario = $("#f-practicar");
    const panel = $("#elegir-practicar");
    let origen = 0; // el hueco desde el que se abrió el panel: ahí vuelve el foco si no se elige nada

    formulario.addEventListener("click", (e) => {
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
      $(`[data-hueco="${almacen.datos.perfil.practicar.length}"]`).focus();
    });

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
    panel.addEventListener("close", () => {
      pintarPracticar();
      const hueco = panel.returnValue === "elegido" ? almacen.datos.perfil.practicar.length - 1 : origen;
      $(`[data-hueco="${hueco}"]`)?.focus();
    });
  }

  // Selector de voces: «Automática» y las voces en español de este dispositivo. Si la guardada no
  // está aquí (otro móvil u otro PC) se usa la automática, sin borrarla.
  function pintarVoces() {
    const { id } = almacen.datos.perfil.voz;
    const voces = voz.voces?.() ?? [];
    const existe = id != null && voces.some((v) => v.id === id || v.nombre === id);
    $("#voz-id").innerHTML = `<option value="">Automática</option>${voces.map((v) =>
      `<option value="${esc(v.id)}" ${existe && (v.id === id || v.nombre === id) ? "selected" : ""}>${esc(nombreCortoVoz(v.nombre))} (${esc(v.idioma)})</option>`).join("")}`;
    $("#voz-aviso").innerHTML = id != null && !existe
      ? `La voz elegida no está en este dispositivo: se usa la automática (${sinCortarIdioma(voz.descripcionCorta)}).`
      : `Ahora: ${sinCortarIdioma(voz.descripcionCorta)}.`;
  }

  function guardarVoz(cambio) {
    guardar((p) => (p.voz = { ...p.voz, ...cambio }));
    voz.configurar?.(opcionesVoz(almacen.datos.perfil));
  }

  function conectar() {
    $("#voz-id").addEventListener("change", (e) => guardarVoz({ id: e.target.value || null }));
    for (const r of $$('input[name="voz-velocidad"]', raiz)) {
      r.addEventListener("change", () => guardarVoz({ velocidad: r.value }));
    }
    $("#probar-voz").addEventListener("click", () => {
      const { voz: modo, zurdo } = almacen.datos.perfil.sesion;
      voz.decir(textoHablado(accionesPorIds(EJEMPLO), modo, zurdo === true));
    });
  }

  // Subpágina «Mis combinaciones» (#ajustes/mis-combinaciones/…): sin la cabecera de Ajustes.
  const creador = iniciarCreador({ almacen, raiz, voz });
  const vista = $("#vista-ajustes");
  function mostrar(parametro = "") {
    const [sub, ...resto] = parametro.split("/");
    if (sub === "mis-combinaciones") {
      vista.dataset.sub = "creador";
      return creador.mostrar(resto.join("/"));
    }
    const desdeCreador = vista.dataset.sub === "creador";
    delete vista.dataset.sub;
    pintar();
    // Al volver de «Mis combinaciones», el foco a su tarjeta (de donde se salió).
    if (desdeCreador) $("#ir-creador").focus();
  }

  return { mostrar };
}
