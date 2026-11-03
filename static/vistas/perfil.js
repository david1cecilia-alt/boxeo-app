// Pestaña Perfil: lo informativo que rellena el usuario (solo en este navegador). Arriba, el
// rectángulo rojo con su estilo: el de «Mi estilo» si lo ha elegido (manda siempre) o el
// recomendado según sus respuestas (data/estilos.json). Debajo, dos secciones plegables: «Sobre ti»
// (fecha, medidas y las preguntas de estilo) y «Mi estilo». Se guarda al cambiar cada campo. Lo que
// cambia el entreno (voz y «Practicar más») está en Ajustes; guardia y nivel, en Entrenar.
import { NOMBRE_NIVEL, preferencias } from "../ajustes.js";
import { NO_SE } from "../almacen.js";
import { chips, conectarCampos } from "./campos.js";
import { $, anunciar, esc, hoyIso } from "./dom.js";
import { TEXTO_AFINAR, recomendarEstilo, textoEmpate, textoFaltan } from "./estilo.js";
import { ESTILO, MI_ESTILO } from "./opciones.js";

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

// Antetítulo: lo que se propone en Entrenar («Ortodoxo · nivel Medio»).
function contexto(perfil) {
  const { zurdo, nivel } = preferencias(perfil);
  return `${zurdo ? "Zurdo" : "Ortodoxo"} · nivel ${NOMBRE_NIVEL[nivel]}`;
}

const respondidas = (estilo) => Object.keys(ESTILO).filter((c) => estilo[c] && estilo[c] !== NO_SE).length;

export function iniciarPerfil({ almacen }) {
  const raiz = $("#perfil-contenido");
  let estilos = null; // data/estilos.json (tabla del estilo recomendado), cargado la primera vez

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

  // Antetítulo, tarjeta de estilo y resúmenes de las secciones: cambian al responder sin repintar todo.
  function pintarResumen() {
    const p = almacen.datos.perfil;
    $("#antetitulo-perfil").textContent = contexto(p);
    $("#resumen-sobre-ti").textContent = `${respondidas(p.estilo)} de ${Object.keys(ESTILO).length} preguntas`;
    $("#resumen-mi-estilo").textContent = NOMBRES_ESTILO[p.estilo.mi_estilo] ?? "Sin elegir";
    if (!estilos) return null; // se pinta al cargar la tabla
    const t = tarjetaEstilo(p, estilos);
    $("#t-estilo").textContent = t.titulo;
    $("#estilo-resumen").innerHTML = t.html;
    return t;
  }

  async function cargarEstilos() {
    try {
      estilos ??= await (await fetch("data/estilos.json")).json();
    } catch {
      $("#estilo-resumen").innerHTML = `<p>No se pudo cargar la tabla de estilos.</p>`;
      return;
    }
    if (!$("#estilo-resumen")) return;
    // «Sobre ti» se abre solo mientras falten respuestas para la recomendación.
    $("#d-sobre-ti").open = Boolean(pintarResumen().faltan);
  }

  function pintar() {
    const p = almacen.datos.perfil;
    raiz.innerHTML = `
      <section class="tarjeta estilo-recomendado" aria-labelledby="t-estilo">
        <h2 id="t-estilo" class="antetitulo">Estilo recomendado</h2>
        <div id="estilo-resumen" aria-live="polite"><p>Cargando…</p></div>
      </section>

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

      <p class="nota pie-perfil">Tus datos se guardan solo en este dispositivo. <span id="guardado-perfil"></span></p>`;
    pintarResumen();
    cargarEstilos();
    conectarCampos(raiz, guardar);
  }

  return { mostrar: pintar };
}
