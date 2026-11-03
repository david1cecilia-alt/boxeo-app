// Pantalla Ajustes (#ajustes): lo que cambia el entreno. Se guarda al cambiar cada campo, solo en
// este navegador. En el móvil se entra por el engranaje y «Volver» lleva a la pestaña de antes.
// «Practicar más» pasa al sorteo lo elegido (ajustes.js). La voz y su velocidad se aplican al
// momento (también a la línea «Voz: …» de Entrenar).
import { MAX_PRACTICAR, NOMBRE_VELOCIDAD, cambiarPracticar, opcionesVoz, preferencias } from "../ajustes.js";
import { accionesPorIds, catalogo, espejo, nombreHablado, textoHablado } from "../motor/acciones.js";
import { VELOCIDADES } from "../motor/ritmo.js";
import { FACTOR_PRACTICAR, movimiento, movimientos } from "../motor/sorteo.js";
import { nombreCortoVoz } from "../voz.js";
import { chips, conectarCampos } from "./campos.js";
import { $, $$, anunciar, esc } from "./dom.js";
import { BASICOS } from "./opciones.js";

const GRUPOS_PRACTICAR = { golpe: "Golpes", defensa: "Defensas", movimiento: "Salidas" };
const CUANTO = { poco: "Un poco", bastante: "Bastante" };

// Los movimientos de «Practicar más» con su nombre y su grupo. Los golpes llevan su número y la
// mano de la guardia de Entrenar («3 crochet de izquierda»; al zurdo, «de derecha»).
function movimientosPracticar(zurdo) {
  const primera = new Map();
  for (const a of catalogo().values()) if (!primera.has(movimiento(a))) primera.set(movimiento(a), a);
  return movimientos().map((m) => {
    const a = primera.get(m);
    const nombre = a.numero ? `${a.numero} ${nombreHablado(zurdo ? espejo(a) : a)}`
      : m === "cuerpo" ? "golpes al cuerpo" : a.orden || a.plantilla.replace(" {lado}", "");
    return { movimiento: m, nombre, grupo: a.tipo };
  });
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
      <div class="columna-ajustes">
      <form class="tarjeta formulario" id="f-voz" aria-labelledby="t-voz">
        <div>
          <h2 id="t-voz">Voz</h2>
          <p class="nota">La que te dicta las combinaciones.</p>
        </div>
        <label class="campo">Voz <select id="voz-id" aria-describedby="voz-aviso"></select></label>
        <p class="nota" id="voz-aviso"></p>
        <fieldset class="grupo-chips"><legend>Velocidad</legend><div class="chips-fila velocidades">
          ${Object.entries(VELOCIDADES).map(([clave, valor]) => `<label class="chip-opcion">
            <input type="radio" name="voz-velocidad" value="${clave}" ${p.voz.velocidad === clave ? "checked" : ""}>
            <span>${NOMBRE_VELOCIDAD[clave]} <small>${numeroEs(valor)}</small></span></label>`).join("")}
        </div></fieldset>
        <button type="button" id="probar-voz" class="boton secundario">Probar voz</button>
      </form>

      <form class="tarjeta formulario" id="f-tus-datos" aria-labelledby="t-tus-datos">
        <div>
          <h2 id="t-tus-datos">Tus datos</h2>
          <p class="nota">Lo que se propone en Entrenar. Si lo cambias aquí, Entrenar se pone igual.</p>
        </div>
        ${Object.entries(BASICOS).map(([c, def]) => chips("basicos", c, def, p.basicos[c])).join("")}
      </form>
      </div>

      <form class="tarjeta formulario" id="f-practicar" aria-labelledby="t-practicar"></form>

      <p class="nota pie-perfil">Tus ajustes se guardan solo en este dispositivo. <span id="guardado-ajustes"></span></p>`;
    pintarVoces();
    pintarPracticar();
    conectar();
  }

  // «Practicar más»: los movimientos como chips (hasta MAX_PRACTICAR; con todos elegidos, los demás
  // desactivados) y, por cada elegido, cuánto más.
  function pintarPracticar() {
    const elegidos = almacen.datos.perfil.practicar;
    const lleno = elegidos.length >= MAX_PRACTICAR;
    const lista = movimientosPracticar(preferencias(almacen.datos.perfil).zurdo);
    const nombre = new Map(lista.map((m) => [m.movimiento, m.nombre]));
    const elegido = (m) => elegidos.some((e) => e.movimiento === m);
    $("#f-practicar").innerHTML = `
      <div>
        <h2 id="t-practicar" tabindex="-1">Practicar más</h2>
        <p class="nota">Elige hasta ${MAX_PRACTICAR} movimientos: las combinaciones que los llevan saldrán más a menudo.
          Nunca se quita ninguna.</p>
      </div>
      ${Object.entries(GRUPOS_PRACTICAR).map(([grupo, titulo]) => `
        <fieldset class="grupo-chips"><legend>${titulo}</legend><div class="chips-fila">
          ${lista.filter((m) => m.grupo === grupo).map((m) => `<label class="chip-opcion">
            <input type="checkbox" data-practicar="${m.movimiento}" ${elegido(m.movimiento) ? "checked" : ""}
              ${lleno && !elegido(m.movimiento) ? "disabled" : ""}><span>${esc(m.nombre)}</span></label>`).join("")}
        </div></fieldset>`).join("")}
      <p class="nota" id="practicar-estado">${elegidos.length
        ? `${elegidos.length} de ${MAX_PRACTICAR} elegidos.${lleno ? " Quita uno para elegir otro." : ""}`
        : "Ahora todas salen igual de a menudo."}</p>
      ${elegidos.length ? `<ul class="lista-practicar">
        ${elegidos.map((e, i) => `<li><fieldset class="cuanto-practicar"><legend>${esc(nombre.get(e.movimiento) ?? e.movimiento)}</legend>
          <div class="chips-fila velocidades">
          ${Object.entries(CUANTO).map(([clave, texto]) => `<label class="chip-opcion">
            <input type="radio" name="cuanto-${i}" data-cuanto="${clave}" data-movimiento="${esc(e.movimiento)}"
              ${e.cuanto === clave ? "checked" : ""}><span>${texto} más <small>×${FACTOR_PRACTICAR[clave]}</small></span></label>`).join("")}
          </div></fieldset></li>`).join("")}
      </ul>
      <button type="button" id="practicar-quitar" class="boton pequeno">Quitar todo</button>` : ""}`;
    conectarPracticar();
  }

  function guardarPracticar(movimiento_, cuanto, foco) {
    guardar((p) => (p.practicar = cambiarPracticar(p.practicar, movimiento_, cuanto)));
    pintarPracticar();
    $(foco)?.focus();
  }

  function conectarPracticar() {
    for (const c of $$("[data-practicar]", raiz)) {
      c.addEventListener("change", () => guardarPracticar(c.dataset.practicar, c.checked ? "poco" : null,
        `[data-practicar="${c.dataset.practicar}"]`));
    }
    for (const r of $$("[data-cuanto]", raiz)) {
      r.addEventListener("change", () => guardarPracticar(r.dataset.movimiento, r.dataset.cuanto,
        `[data-movimiento="${r.dataset.movimiento}"][data-cuanto="${r.dataset.cuanto}"]`));
    }
    $("#practicar-quitar")?.addEventListener("click", () => {
      guardar((p) => (p.practicar = []));
      pintarPracticar();
      $("#t-practicar").focus();
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
    conectarCampos(raiz, guardar);

    $("#voz-id").addEventListener("change", (e) => guardarVoz({ id: e.target.value || null }));
    for (const r of $$('input[name="voz-velocidad"]', raiz)) {
      r.addEventListener("change", () => guardarVoz({ velocidad: r.value }));
    }
    $("#probar-voz").addEventListener("click", () => {
      const { voz: modo, zurdo } = almacen.datos.perfil.sesion;
      voz.decir(textoHablado(accionesPorIds(EJEMPLO), modo, zurdo === true));
    });
  }

  return { mostrar: pintar };
}
