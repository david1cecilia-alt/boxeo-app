// Sección «Ajustes» del menú de Entrenar (#entrenar/menu/ajustes): la voz y su velocidad, «Nombrar
// combinaciones» y la guardia. Valen para la General y la Personalizada (y Prueba), así que tocarlas no
// cambia de tipo. Se guarda al cambiar cada campo, solo en este navegador. La voz y su velocidad se
// aplican al momento (también a la línea «Voz: …» de Entrenar). Nombre y avatar llegarán aquí (R5).
import { NOMBRE_VELOCIDAD, opcionesVoz, preferencias, recordarSesion } from "../ajustes.js";
import { accionesPorIds, textoHablado } from "../motor/acciones.js";
import { VELOCIDADES } from "../motor/ritmo.js";
import { nombreCortoVoz } from "../voz.js";
import { $, anunciar, esc } from "./dom.js";

const EJEMPLO = ["jab", "directo", "gancho_izq"]; // lo que dice «Probar voz»
const numeroEs = (n) => n.toLocaleString("es-ES", { minimumFractionDigits: 1 });
// «Microsoft Helena (es-ES)»: el idioma va pegado al nombre y entero (el guion de «es-ES» partía la línea).
const sinCortarIdioma = (texto) => esc(texto).replace(/ (\([^)]*\))$/, '&nbsp;<span class="sin-cortar">$1</span>');

const MODOS_VOZ = [["numeros", "1 · 2", "Números"], ["nombres", "Jab", "Nombres"], ["ambos", "1 jab", "Ambos"]];
const GUARDIAS = [["diestro", "Diestro", "izquierda delante"], ["zurdo", "Zurdo", "derecha delante, todo en espejo"]];

// `alCambiar()`: tras guardar Nombrar o la guardia (Entrenar repinta «Tu sesión» y los nombres de «Practicar más»).
export function iniciarAjustes({ almacen, voz, alCambiar }) {
  const raiz = $("#menu-ajustes");
  // Al cargar las voces (o elegir otra) se rehace el selector.
  voz.alCambiar?.(() => { if ($("#voz-id", raiz)) pintarVoces(); });

  function avisarGuardado() {
    anunciar("Guardado");
    $("#guardado-ajustes", raiz).textContent = almacen.persistente ? "Guardado." : "Guardado solo en memoria.";
  }

  function pintar() {
    const p = almacen.datos.perfil;
    const { voz: modo, zurdo } = preferencias(p);
    const radios = (nombre, opciones, actual) => opciones.map(([valor, arriba, abajo]) =>
      `<label><input type="radio" name="${nombre}" value="${valor}" ${valor === actual ? "checked" : ""}>`
      + `<span><b>${esc(arriba)}</b>${esc(abajo)}</span></label>`).join("");
    raiz.innerHTML = `
      <form class="formulario" id="f-voz" aria-labelledby="t-voz">
        <h3 id="t-voz" class="titulo-campo">Voz</h3>
        <div class="voz-eleccion">
          <label class="campo">Voz que te dicta <select id="voz-id" aria-describedby="voz-aviso"></select></label>
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
        <fieldset class="niveles modos-voz">
          <legend><span>Nombrar combinaciones</span></legend>
          ${radios("voz", MODOS_VOZ, modo)}
        </fieldset>
        <fieldset class="niveles guardias">
          <legend><span>Guardia</span></legend>
          ${GUARDIAS.map(([valor, nombre, detalle]) => `<label><input type="radio" name="guardia" value="${valor}"
            ${(valor === "zurdo") === zurdo ? "checked" : ""}><span>${nombre}<small class="solo-lectores">: ${detalle}</small></span></label>`).join("")}
        </fieldset>
        <!-- Nombre y avatar o foto: R5. -->
        <div id="identidad" hidden></div>
        <p class="nota">Valen para la General y para tu Personalizada. Se guardan solo en este dispositivo.
          <span id="guardado-ajustes"></span></p>
      </form>`;
    pintarVoces();
  }

  // Selector de voces: «Automática» y las voces en español de este dispositivo. Si la guardada no
  // está aquí (otro móvil u otro PC) se usa la automática, sin borrarla.
  function pintarVoces() {
    const { id } = almacen.datos.perfil.voz;
    const voces = voz.voces?.() ?? [];
    const existe = id != null && voces.some((v) => v.id === id || v.nombre === id);
    $("#voz-id", raiz).innerHTML = `<option value="">Automática</option>${voces.map((v) =>
      `<option value="${esc(v.id)}" ${existe && (v.id === id || v.nombre === id) ? "selected" : ""}>${esc(nombreCortoVoz(v.nombre))} (${esc(v.idioma)})</option>`).join("")}`;
    $("#voz-aviso", raiz).innerHTML = id != null && !existe
      ? `La voz elegida no está en este dispositivo: se usa la automática (${sinCortarIdioma(voz.descripcionCorta)}).`
      : `Ahora: ${sinCortarIdioma(voz.descripcionCorta)}.`;
  }

  function guardarVoz(cambio) {
    const p = structuredClone(almacen.datos.perfil);
    p.voz = { ...p.voz, ...cambio };
    almacen.guardarPerfil(p);
    voz.configurar?.(opcionesVoz(almacen.datos.perfil));
    avisarGuardado();
  }

  // Nombrar y la guardia son de perfil.sesion (sin migrar), pero no de la Personalizada: no cambian el tipo.
  function guardarSesion(cambio) {
    recordarSesion(almacen, cambio);
    avisarGuardado();
    alCambiar();
  }

  raiz.addEventListener("change", (e) => {
    const { name, value } = e.target;
    if (e.target.id === "voz-id") guardarVoz({ id: value || null });
    else if (name === "voz-velocidad") guardarVoz({ velocidad: value });
    else if (name === "voz") guardarSesion({ voz: value });
    else if (name === "guardia") guardarSesion({ zurdo: value === "zurdo" });
  });
  raiz.addEventListener("submit", (e) => e.preventDefault());
  raiz.addEventListener("click", (e) => {
    if (!e.target.closest("#probar-voz")) return;
    const { voz: modo, zurdo } = preferencias(almacen.datos.perfil);
    voz.decir(textoHablado(accionesPorIds(EJEMPLO), modo, zurdo));
  });

  pintar();
  return { pintar };
}
