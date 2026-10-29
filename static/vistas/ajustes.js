// Pantalla Ajustes (#ajustes): lo que cambia el entreno. Se guarda al cambiar cada campo, solo en
// este navegador. En el móvil se entra por el engranaje y «Volver» lleva a la pestaña de antes.
// Los pesos sustituyen a los de data/perfil.json en el generador. La voz y su velocidad se aplican
// al momento (también a la línea «Voz: …» de Entrenar).
import { NOMBRE_VELOCIDAD, PESOS, opcionesVoz } from "../ajustes.js";
import { accionesPorIds, textoHablado } from "../motor/acciones.js";
import { datos } from "../motor/datos.js";
import { VELOCIDADES } from "../motor/ritmo.js";
import { nombreCortoVoz } from "../voz.js";
import { chips, conectarCampos } from "./campos.js";
import { $, $$, anunciar, esc } from "./dom.js";
import { BASICOS, PESOS_TEXTO, RANGO_PESO } from "./opciones.js";

const pesoTexto = (n) => `×${n.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

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
    const pesos = p.pesos ?? datos().perfil.pesos;
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
    pintarVoces();
    conectar();
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
