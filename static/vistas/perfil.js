// Pestaña Perfil: lo informativo que rellena el usuario (solo en este navegador): estilo (con el
// recomendado según sus respuestas, de data/estilos.json) y sobre ti. Se guarda al cambiar cada
// campo. Las notas del entrenador y las revisiones guardadas siguen en el almacén, sin mostrarse. Lo que cambia el entreno (guardia, nivel, «Practicar
// más» y voz) está en Ajustes.
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
function htmlRecomendacion(r, conMiEstilo) {
  if (r.faltan) {
    return `${conMiEstilo ? "" : '<p class="titular">Por definir</p>'}<p>${esc(textoFaltan(r.faltan))}</p>`;
  }
  let nombre;
  if (r.empate) {
    nombre = `<p class="${conMiEstilo ? "recomendado" : "empate"}">${esc(textoEmpate(r.empate))}</p>`;
  } else {
    nombre = conMiEstilo
      ? `<p class="recomendado">Estilo recomendado: <b>${esc(r.nombre)}</b></p>`
      : `<p class="titular">${esc(r.nombre)}</p>`;
  }
  return [nombre, r.porque && `<p>${esc(r.porque)}</p>`, r.tambien && `<p>También encajas como ${esc(r.tambien)}.</p>`,
    r.afinar && `<p class="afinar">${esc(TEXTO_AFINAR)}</p>`].filter(Boolean).join("");
}

// Tarjeta de estilo: con «Mi estilo» elegido, ese como su estilo y la recomendación debajo, más
// pequeña; si no, la recomendación. La nota de alcance y altura, si están las dos medidas.
function tarjetaEstilo(perfil, tabla) {
  const r = recomendarEstilo(perfil.estilo, perfil.basicos, tabla, NOMBRES_ESTILO);
  const mio = NOMBRES_ESTILO[perfil.estilo.mi_estilo];
  const cuerpo = mio
    ? `<p class="titular">${esc(mio)}</p><div class="recomendacion">${htmlRecomendacion(r, true)}</div>`
    : htmlRecomendacion(r, false);
  return {
    titulo: mio ? "Tu estilo" : "Estilo recomendado",
    html: cuerpo + (r.alcance ? `<p class="alcance">${esc(r.alcance)}</p>` : ""),
  };
}

function contexto({ guardia, nivel }) {
  const g = { ortodoxa: "Ortodoxo", zurda: "Zurdo" }[guardia] ?? "Guardia por definir";
  return nivel && nivel !== NO_SE ? `${g} · nivel ${nivel}` : g;
}

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

  // Antetítulo (guardia y nivel) y tarjeta de estilo: cambian al responder sin repintar todo.
  function pintarResumen() {
    const p = almacen.datos.perfil;
    $("#antetitulo-perfil").textContent = contexto(p.basicos);
    if (!estilos) return; // se pinta al cargar la tabla
    const t = tarjetaEstilo(p, estilos);
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
    raiz.innerHTML = `
      <div class="columna-perfil">
      <section class="tarjeta estilo-recomendado" aria-labelledby="t-estilo">
        <h2 id="t-estilo" class="antetitulo">Estilo recomendado</h2>
        <div id="estilo-resumen" aria-live="polite"><p>Cargando…</p></div>
      </section>

      <form class="grupos-estilo" id="f-estilo" aria-label="Tu estilo">
        ${chips("estilo", "mi_estilo", MI_ESTILO, p.estilo.mi_estilo)}
        ${Object.entries(ESTILO).map(([c, def]) => chips("estilo", c, def, p.estilo[c])).join("")}
      </form>
      </div>

      <div class="columna-perfil">
      <form class="tarjeta formulario" id="f-basicos" aria-labelledby="t-basicos">
        <h2 id="t-basicos">Sobre ti</h2>
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

      <p class="nota pie-perfil">Tus datos se guardan solo en este dispositivo. <span id="guardado-perfil"></span></p>`;
    pintarResumen();
    cargarEstilos();
    conectarCampos(raiz, guardar);
  }

  return { mostrar: pintar };
}
