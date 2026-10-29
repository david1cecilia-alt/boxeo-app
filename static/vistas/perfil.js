// Pestaña Perfil: lo informativo que rellena el usuario (solo en este navegador): estilo, sobre ti,
// notas del entrenador y puntos a revisar. Se guarda al cambiar cada campo. Lo que cambia el
// entreno (guardia, nivel, pesos y voz) está en Ajustes.
import { NO_SE } from "../almacen.js";
import { chips, conectarCampos } from "./campos.js";
import { $, $$, anunciar, esc, hoyIso } from "./dom.js";
import { ESTILO, MI_ESTILO } from "./opciones.js";

const MEDIDAS = {
  altura_cm: ["Altura", "cm", 100, 230],
  peso_kg: ["Peso", "kg", 30, 200],
  alcance_cm: ["Alcance", "cm", 100, 250],
};

const DISTANCIA = { corta: "Corta distancia", media: "Media distancia", larga: "Larga distancia" };
const DETALLE_ESTILO = { golpe_favorito: "Golpe favorito", presion: "Bajo presión", defensa: "Defensa", iniciativa: "Iniciativa", cardio: "Cardio" };

// Tarjeta de estilo: el que eligió el usuario ("Mi estilo") más el resumen de sus respuestas.
// La app nunca clasifica por su cuenta (boxer, fajador…): eso es criterio de entrenador.
function resumenEstilo(estilo) {
  const respondido = (c) => estilo[c] && estilo[c] !== NO_SE;
  const texto = (c) => (c === "mi_estilo" ? MI_ESTILO : ESTILO[c]).opciones.find(([v]) => v === estilo[c])?.[1] ?? "";
  const distancia = respondido("distancia") && DISTANCIA[estilo.distancia];
  const volumen = respondido("volumen") && texto("volumen");
  // Con "Mi estilo": "Boxer-puncher / De media distancia" y el volumen pasa al detalle.
  const titulo = respondido("mi_estilo")
    ? [texto("mi_estilo"), distancia && `De ${distancia.toLowerCase()}`].filter(Boolean)
    : [distancia, volumen].filter(Boolean);
  const detalle = [respondido("mi_estilo") && volumen,
    ...Object.entries(DETALLE_ESTILO).filter(([c]) => respondido(c)).map(([c, nombre]) => `${nombre}: ${texto(c).toLowerCase()}`)]
    .filter(Boolean);
  if (!titulo.length && !detalle.length) {
    return { titulo: ["Por definir"], texto: "Responde a las preguntas de abajo y aquí verás el resumen de tu estilo." };
  }
  if (!titulo.length) titulo.push(texto("golpe_favorito") || "Por definir");
  return { titulo, texto: `${detalle.length ? `${detalle.join(" · ")}. ` : ""}Revísalo en 2–3 meses.` };
}

function contexto({ guardia, nivel }) {
  const g = { ortodoxa: "Ortodoxo", zurda: "Zurdo" }[guardia] ?? "Guardia por definir";
  return nivel && nivel !== NO_SE ? `${g} · nivel ${nivel}` : g;
}

export function iniciarPerfil({ almacen }) {
  const raiz = $("#perfil-contenido");
  let revisar = null; // data/revisar.json, cargado la primera vez

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
    const r = resumenEstilo(p.estilo);
    $("#estilo-titulo").innerHTML = r.titulo.map(esc).join("<br>");
    $("#estilo-texto").textContent = r.texto;
  }

  function pintar() {
    const p = almacen.datos.perfil;
    raiz.innerHTML = `
      <div class="columna-perfil">
      <section class="tarjeta estilo-provisional" aria-labelledby="t-estilo-provisional" aria-live="polite">
        <h2 id="t-estilo-provisional" class="antetitulo">Estilo provisional</h2>
        <p class="titular" id="estilo-titulo"></p>
        <p id="estilo-texto"></p>
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
          <input type="date" data-grupo="basicos" data-campo="inicio" value="${esc(p.basicos.inicio ?? "")}" max="${hoyIso()}"></label>
        <div class="rejilla">
          ${Object.entries(MEDIDAS).map(([c, [etiqueta, unidad, min, max]]) => `
            <label class="campo">${etiqueta} (${unidad}, opcional)
              <input type="number" inputmode="decimal" min="${min}" max="${max}" step="0.5"
                data-grupo="basicos" data-campo="${c}" data-numero value="${p.basicos[c] ?? ""}"></label>`).join("")}
        </div>
      </form>

      <section class="tarjeta" aria-labelledby="t-notas">
        <h2 id="t-notas" tabindex="-1">Notas del entrenador</h2>
        <form id="f-nota" class="formulario">
          <label class="campo">Fecha <input type="date" name="fecha" value="${hoyIso()}" required></label>
          <label class="campo">Nota <textarea name="texto" rows="3" maxlength="1000" required></textarea></label>
          <button type="submit" class="boton secundario">Añadir nota</button>
        </form>
        <ul class="lista-editable notas">${almacen.datos.notas_entrenador.map((n) => `
          <li><div><time datetime="${esc(n.fecha)}">${esc(n.fecha)}</time><p>${esc(n.texto)}</p></div>
            <button type="button" class="boton pequeno" data-borrar-nota="${esc(n.id)}" aria-label="Borrar nota del ${esc(n.fecha)}">Borrar</button></li>`).join("")}
        </ul>
      </section>
      </div>

      <section class="tarjeta" aria-labelledby="t-revisar">
        <h2 id="t-revisar">Revisar con el entrenador</h2>
        <p class="nota">Puntos del motor marcados como dudosos. Lo que apuntes aquí es solo para ti: no cambia el motor.</p>
        <div id="lista-revisar"><p class="nota">Cargando…</p></div>
      </section>

      <p class="nota pie-perfil">Tus datos se guardan solo en este dispositivo. <span id="guardado-perfil"></span></p>`;
    pintarResumen();
    conectar();
    pintarRevisar();
  }

  function conectar() {
    conectarCampos(raiz, guardar);

    $("#f-nota").addEventListener("submit", (e) => {
      e.preventDefault();
      const texto = e.target.texto.value.trim();
      if (!texto) return;
      almacen.anadirNotaEntrenador(texto, e.target.fecha.value);
      anunciar("Nota añadida");
      pintar();
      $("#t-notas").focus();
    });
    for (const b of $$("[data-borrar-nota]", raiz)) {
      b.addEventListener("click", () => {
        if (!confirm("¿Borrar esta nota?")) return;
        almacen.borrarNotaEntrenador(b.dataset.borrarNota);
        anunciar("Nota borrada");
        pintar();
        $("#t-notas").focus();
      });
    }
  }

  async function pintarRevisar() {
    const contenedor = $("#lista-revisar");
    try {
      revisar ??= (await (await fetch("data/revisar.json")).json()).puntos;
    } catch {
      contenedor.innerHTML = `<p class="aviso">No se pudo cargar la lista de puntos.</p>`;
      return;
    }
    // Si mientras se cargaba se repintó la pestaña, este contenedor ya no está en la página.
    if (!contenedor.isConnected) return;
    const respuestas = almacen.datos.revisiones;
    contenedor.innerHTML = `<ul class="lista-revisar">${revisar.map((r) => {
      const resp = respuestas[r.id] ?? { respuesta: "", confirmado: false };
      return `<li>
        <p class="punto">${esc(r.texto)} <span class="etiqueta ${resp.confirmado ? "ok" : ""}">${resp.confirmado ? "Confirmado" : "Pendiente"}</span></p>
        <p class="nota">En <code>${esc(r.origen)}</code>${resp.fecha ? ` · actualizado el ${esc(resp.fecha)}` : ""}</p>
        <label class="campo">Respuesta del entrenador
          <textarea rows="2" maxlength="500" data-revision="${esc(r.id)}">${esc(resp.respuesta)}</textarea></label>
        <label class="check"><input type="checkbox" data-confirmado="${esc(r.id)}" ${resp.confirmado ? "checked" : ""}>
          <span>Confirmado</span></label>
      </li>`;
    }).join("")}</ul>`;
    for (const r of revisar) {
      const respuesta = $(`[data-revision="${r.id}"]`, contenedor);
      const confirmado = $(`[data-confirmado="${r.id}"]`, contenedor);
      const guardarRevision = () => {
        almacen.guardarRevision(r.id, { respuesta: respuesta.value.trim(), confirmado: confirmado.checked });
        anunciar("Guardado");
      };
      respuesta.addEventListener("change", guardarRevision);
      confirmado.addEventListener("change", async () => {
        guardarRevision();
        await pintarRevisar();
        $(`[data-confirmado="${r.id}"]`)?.focus(); // el repintado no debe perder el foco
      });
    }
  }

  return { mostrar: pintar };
}
