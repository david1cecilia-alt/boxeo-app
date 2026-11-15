// Perfil (#perfil, desde la cabecera de Entrenar): lo informativo que rellena el usuario (solo en este
// navegador). Arriba, la identidad: avatar, nombre, la guardia («Diestro» o «Zurdo») y «Cambiar», que abre
// Ajustes en el menú de Entrenar (allí se editan nombre, avatar y guardia) y, al cerrarlo, vuelve aquí con el
// foco en «Cambiar». Debajo, el rectángulo con su estilo: el de «Mi estilo» si lo ha elegido (manda siempre) o
// el recomendado según sus respuestas (data/estilos.json). Después, plegables: el cuestionario («Repetir el
// cuestionario», o «Hacer…» si aún no hay estilo), «Mi estilo» y «Sobre ti» (fecha y medidas). Se guarda al
// cambiar cada campo. Lo que cambia el entreno (voz, guardia, «Practicar más»…) está en el menú de Entrenar.
//
// Historial del navegador: la cabecera de Entrenar marca su entrada #perfil con `desdeEntrenar` («← Volver»
// hace history.back(); si se llegó de otro sitio, location.replace("#entrenar")). «Cambiar» marca la entrada
// #perfil con `focoCambiar` antes de abrir el menú (con `menu: true`, ver menu.js): todo cierre del menú hace
// history.back() hasta aquí y la marca dice adónde va el foco.
import { preferencias } from "../ajustes.js";
import { NO_SE } from "../almacen.js";
import { crearAvatar, nombreVisible } from "./avatar.js";
import { chips, conectarCampos } from "./campos.js";
import { $, anunciar, esc, hoyIso } from "./dom.js";
import { TEXTO_AFINAR, recomendarEstilo, textoEmpate, textoFaltan } from "./estilo.js";
import { RUTA_MENU } from "./menu.js";
import { ESTILO, MI_ESTILO } from "./opciones.js";

export const RUTA_CAMBIAR = `${RUTA_MENU}/ajustes`;

const MEDIDAS = {
  altura_cm: ["Altura", "cm", 100, 230],
  peso_kg: ["Peso", "kg", 30, 200],
  alcance_cm: ["Alcance", "cm", 100, 250],
};

// Nombres de los estilos (los de «Mi estilo»), sin «No lo sé».
const NOMBRES_ESTILO = Object.fromEntries(MI_ESTILO.opciones.filter(([id]) => id !== NO_SE));

// Recomendación: «Boxer» (o «Encajas igual como … y como …» si empatan), el porqué, «También
// encajas como …» y, si quedan preguntas, «Responde más…»; o cuántas preguntas faltan.
function htmlRecomendacion(r) {
  if (r.faltan) return `<p class="titular">Por definir</p><p>${esc(textoFaltan(r.faltan))}</p>`;
  const nombre = r.empate
    ? `<p class="empate">${esc(textoEmpate(r.empate))}</p>`
    : `<p class="titular">${esc(r.nombre)}</p>`;
  return [nombre, r.porque && `<p>${esc(r.porque)}</p>`, r.tambien && `<p>También encajas como ${esc(r.tambien)}.</p>`,
    r.afinar && `<p class="afinar">${esc(TEXTO_AFINAR)}</p>`].filter(Boolean).join("");
}

// Con «Mi estilo» elegido, una línea neutra solo si las respuestas apuntan a otro: «Según tus
// respuestas: Fajador» (o «Boxer o Fajador» si empatan y el elegido no es ninguno de ellos).
function lineaSegun(r, mio) {
  if (r.faltan) return "";
  const otros = r.empate ? (r.empate.includes(NOMBRES_ESTILO[mio]) ? [] : r.empate) : r.estilo !== mio ? [r.nombre] : [];
  if (!otros.length) return "";
  const lista = otros.length < 2 ? otros[0] : `${otros.slice(0, -1).join(", ")} o ${otros.at(-1)}`;
  return `<p class="segun">Según tus respuestas: ${esc(lista)}</p>`;
}

// Tarjeta de estilo: con «Mi estilo» elegido, ese (y la línea «Según tus respuestas» si toca); si no,
// la recomendación. La nota de alcance y altura, si están las dos medidas.
function tarjetaEstilo(perfil, tabla) {
  const r = recomendarEstilo(perfil.estilo, perfil.basicos, tabla, NOMBRES_ESTILO);
  const mio = perfil.estilo.mi_estilo;
  const cuerpo = NOMBRES_ESTILO[mio]
    ? `<p class="titular">${esc(NOMBRES_ESTILO[mio])}</p>${lineaSegun(r, mio)}`
    : htmlRecomendacion(r);
  return {
    titulo: NOMBRES_ESTILO[mio] ? "Tu estilo" : "Estilo recomendado",
    html: cuerpo + (r.alcance ? `<p class="alcance">${esc(r.alcance)}</p>` : ""),
    faltan: r.faltan,
  };
}

// Antetítulo: solo la guardia de Ajustes.
const guardia = (perfil) => (preferencias(perfil).zurdo ? "Zurdo" : "Diestro");

const respondidas = (estilo) => Object.keys(ESTILO).filter((c) => estilo[c] && estilo[c] !== NO_SE).length;
const CAMPOS_SOBRE_TI = ["inicio", ...Object.keys(MEDIDAS)];
const puestos = (basicos) => CAMPOS_SOBRE_TI.filter((c) => basicos[c] != null && basicos[c] !== "").length;

export function iniciarPerfil({ almacen }) {
  const raiz = $("#perfil-contenido");
  let estilos = null; // data/estilos.json (tabla del estilo recomendado), cargado la primera vez

  $("#cambiar-identidad").addEventListener("click", () => {
    history.replaceState({ ...history.state, focoCambiar: true }, "");
    location.hash = RUTA_CAMBIAR;
    // La entrada nueva ya existe (el hashchange llega después): se marca como del menú, como hace menu.js.
    history.replaceState({ ...history.state, menu: true }, "");
  });
  $("#volver-perfil").addEventListener("click", (e) => {
    e.preventDefault();
    if (history.state?.desdeEntrenar) history.back();
    else location.replace("#entrenar");
  });

  // La identidad: avatar (la foto con alt «Tu foto de perfil», el predefinido con el suyo; la inicial no se
  // lee), nombre (o «Tu perfil») y la guardia.
  function pintarIdentidad() {
    const p = almacen.datos.perfil;
    $("#perfil-avatar").replaceChildren(crearAvatar(p.identidad));
    $("#t-perfil").textContent = nombreVisible(p.identidad);
    $("#antetitulo-perfil").textContent = guardia(p);
  }

  // Copia del perfil para editar y guardar entero.
  const perfil = () => structuredClone(almacen.datos.perfil);
  function guardar(cambio) {
    const p = perfil();
    cambio(p);
    almacen.guardarPerfil(p);
    anunciar("Guardado");
    $("#guardado-perfil").textContent = almacen.persistente ? "Guardado." : "Guardado solo en memoria.";
    pintarResumen();
  }

  // Tarjeta de estilo y resúmenes de las secciones: cambian al responder sin repintar todo. Hay estilo si se
  // ha elegido uno en «Mi estilo» o la recomendación ya tiene las respuestas que necesita.
  function pintarResumen() {
    const p = almacen.datos.perfil;
    const mio = NOMBRES_ESTILO[p.estilo.mi_estilo];
    $("#resumen-cuestionario").textContent = `${respondidas(p.estilo)} de ${Object.keys(ESTILO).length} preguntas`;
    $("#resumen-mi-estilo").textContent = mio ?? "Sin elegir";
    $("#resumen-sobre-ti").textContent = `${puestos(p.basicos)} de ${CAMPOS_SOBRE_TI.length} datos`;
    const t = estilos ? tarjetaEstilo(p, estilos) : null;
    const hayEstilo = Boolean(mio) || Boolean(t && !t.faltan);
    $("#t-cuestionario").textContent = hayEstilo ? "Repetir el cuestionario" : "Hacer el cuestionario";
    if (!t) return; // la tarjeta se pinta al cargar la tabla
    $("#t-estilo").textContent = t.titulo;
    $("#estilo-resumen").innerHTML = t.html;
  }

  async function cargarEstilos() {
    try {
      estilos ??= await (await fetch("data/estilos.json")).json();
    } catch {
      $("#estilo-resumen").innerHTML = `<p>No se pudo cargar la tabla de estilos.</p>`;
      return;
    }
    if ($("#estilo-resumen")) pintarResumen();
  }

  function pintar() {
    const p = almacen.datos.perfil;
    pintarIdentidad();
    raiz.innerHTML = `
      <section class="tarjeta estilo-recomendado" aria-labelledby="t-estilo">
        <h2 id="t-estilo" class="antetitulo">Estilo recomendado</h2>
        <div id="estilo-resumen" aria-live="polite"><p>Cargando…</p></div>
      </section>

      <details class="tarjeta plegable" id="d-cuestionario">
        <summary><span class="titulo-plegable" id="t-cuestionario">Repetir el cuestionario</span>
          <span class="resumen-plegable" id="resumen-cuestionario"></span></summary>
        <div class="cuerpo-plegable">
          <form class="grupos-estilo" id="f-estilo" aria-label="Cómo boxeas">
            ${Object.entries(ESTILO).map(([c, def]) => chips("estilo", c, def, p.estilo[c])).join("")}
          </form>
        </div>
      </details>

      <details class="tarjeta plegable" id="d-mi-estilo">
        <summary><span class="titulo-plegable" id="t-mi-estilo">Mi estilo</span>
          <span class="resumen-plegable" id="resumen-mi-estilo"></span></summary>
        <div class="cuerpo-plegable">
          <form id="f-mi-estilo" aria-labelledby="t-mi-estilo">
            ${chips("estilo", "mi_estilo", MI_ESTILO, p.estilo.mi_estilo)}
          </form>
        </div>
      </details>

      <details class="tarjeta plegable" id="d-sobre-ti">
        <summary><span class="titulo-plegable" id="t-sobre-ti">Sobre ti</span>
          <span class="resumen-plegable" id="resumen-sobre-ti"></span></summary>
        <div class="cuerpo-plegable">
          <form class="formulario" id="f-basicos" aria-label="Tus datos">
            <label class="campo">Empecé a boxear
              <input type="date" data-grupo="basicos" data-campo="inicio" value="${esc(p.basicos.inicio ?? "")}"
                max="${hoyIso()}"></label>
            <div class="rejilla">
              ${Object.entries(MEDIDAS).map(([c, [etiqueta, unidad, min, max]]) => `
                <label class="campo">${etiqueta} (${unidad}, opcional)
                  <input type="number" inputmode="decimal" min="${min}" max="${max}" step="0.5"
                    data-grupo="basicos" data-campo="${c}" data-numero value="${p.basicos[c] ?? ""}"></label>`).join("")}
            </div>
          </form>
        </div>
      </details>

      <p class="nota pie-perfil">Tus datos se guardan solo en este dispositivo. <span id="guardado-perfil"></span></p>`;
    pintarResumen();
    cargarEstilos();
    conectarCampos(raiz, guardar);
    // De vuelta de «Cambiar» (cerrado el menú o con «Atrás»): el foco, donde estaba. La marca se gasta.
    if (history.state?.focoCambiar) {
      const { focoCambiar, ...estado } = history.state;
      history.replaceState(estado, "");
      $("#cambiar-identidad").focus({ preventScroll: true });
    }
  }

  return { mostrar: pintar };
}
