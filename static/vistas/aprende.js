// Pestaña Aprende: las fichas de técnica de data/tecnica.json, solo en texto (sin maniquí).
// #aprende es la lista, agrupada por categoría (Golpes, Defensas, Salidas; las vacías no salen);
// #aprende/<id> es una ficha. La cabecera es la misma: en la ficha, el antetítulo dice su categoría
// y el h1 su nombre, así el foco al cambiar de pestaña cae en el título de lo que se ve.
// Las fichas están escritas para guardia diestra: una nota lo dice (no se invierten los textos). En zurdo
// cambian tus manos y tus pies, no lo que se refiere al rival.
// Las fichas de golpes llevan en el título sus dos números, a la cara y al cuerpo («1/7 Jab»), leídos
// de data/acciones.json (en ortodoxo, como los textos): tecnica.json no lleva cifras.
import { catalogo } from "../motor/acciones.js";
import { $, esc } from "./dom.js";

const NOTA_ZURDO =
  "Escrito para guardia diestra.<br>En zurdo, cambia izquierda por derecha en tus manos y pies; lo que se refiere al rival no cambia.";

// El resumen de «Mostrar más», corto para que quepa entero a 390: lo que trae cada ficha, sin repetir títulos.
function resumenMas(f) {
  const cosas = [
    f.cuando && "cuándo",
    (f.ventajas || f.inconvenientes) && "ventajas",
    f.al_cuerpo && "al cuerpo",
    f.variantes?.length && "variantes",
    (f.notas?.length || f.detalles?.length) && "detalles",
  ].filter(Boolean).slice(0, 4); // con 5 ya no cabe a 390
  const texto = cosas.join(", ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
const PENDIENTE = "Pendiente de revisar con el entrenador";

// «3/9 Crochet de izquierda»: la ficha tiene el id del golpe a la cara; el del cuerpo es <id>_cuerpo.
export function tituloFicha(f) {
  const cara = catalogo().get(f.id)?.numero;
  const cuerpo = catalogo().get(`${f.id}_cuerpo`)?.numero;
  return cara != null && cuerpo != null ? `${cara}/${cuerpo} ${f.titulo}` : f.titulo;
}

export function iniciarAprende() {
  const raiz = $("#aprende-contenido");
  const antetitulo = $("#antetitulo-aprende");
  const titulo = $("#t-aprende");
  const tituloLista = titulo.innerHTML;
  let tecnica = null;
  let ultima = null; // la ficha de la que se vuelve, para dejarle el foco en la lista

  async function cargar() {
    const r = await fetch("data/tecnica.json");
    if (!r.ok) throw new Error("No se pudo cargar tecnica.json");
    return r.json();
  }

  function pintarLista({ enfocar }) {
    antetitulo.textContent = "Técnica paso a paso";
    titulo.innerHTML = tituloLista;
    const grupos = tecnica.categorias
      .map((c) => ({ ...c, fichas: tecnica.fichas.filter((f) => f.categoria === c.id) }))
      .filter((c) => c.fichas.length);
    const pendientes = tecnica.fichas.some((f) => f.revisar);
    raiz.className = "aprende-lista";
    raiz.innerHTML = `
      ${pendientes ? `<p class="aviso-pendiente">${PENDIENTE}: son un borrador.</p>` : ""}
      ${grupos.map((g) => `
        <section class="grupo-fichas" aria-labelledby="g-${esc(g.id)}">
          <h2 id="g-${esc(g.id)}">${esc(g.titulo)}</h2>
          <p class="nota">${esc(g.frase)}</p>
          <ul class="lista-fichas">
            ${g.fichas.map((f) => `
              <li><a class="tarjeta ficha-enlace" href="#aprende/${esc(f.id)}" data-ficha="${esc(f.id)}">
                <span class="titular">${esc(tituloFicha(f))}</span>
                <span class="resumen-ficha">${esc(f.que_es ?? f.frase)}</span>
              </a></li>`).join("")}
          </ul>
        </section>`).join("")}
      <p class="nota pie-aprende">${NOTA_ZURDO}</p>`;
    if (enfocar && ultima) {
      const enlace = raiz.querySelector(`[data-ficha="${CSS.escape(ultima)}"]`);
      enlace?.focus({ preventScroll: true });
      enlace?.scrollIntoView({ block: "center" });
    }
  }

  const lista = (elementos) => `<ul>${elementos.map((x) => `<li>${x}</li>`).join("")}</ul>`;
  const apartado = (id, nombre, cuerpo) =>
    `<section class="tarjeta apartado" aria-labelledby="a-${id}"><h2 id="a-${id}">${nombre}</h2>${cuerpo}</section>`;

  // «Al cuerpo»: lo propio del golpe y, plegado, lo común a todos (está una vez, en la categoría).
  function alCuerpo(f, comun) {
    const plegado = comun ? `
      <details class="avanzados comun-cuerpo">
        <summary>Para todos los golpes al cuerpo</summary>
        ${lista(comun.puntos.map((p) => `<strong>${esc(p.titulo)}</strong> ${esc(p.texto)}`))}
      </details>` : "";
    return `<p>${esc(f.al_cuerpo)}</p>${plegado}`;
  }

  // «Mostrar más», plegado: lo que no hace falta para empezar (cuándo, ventajas, inconvenientes,
  // al cuerpo, variantes, notas, detalles y el nombre en inglés). A la vista solo quedan qué es, cómo se
  // hace y los errores.
  function mostrarMas(f, categoria) {
    const variantes = f.variantes ?? [];
    const partes = [
      f.cuando && ["cuando", "Cuándo suele servir", `<p>${esc(f.cuando)}</p>`],
      f.ventajas && ["ventajas", "Ventajas", `<p>${esc(f.ventajas)}</p>`],
      f.inconvenientes && ["inconvenientes", "Inconvenientes", `<p>${esc(f.inconvenientes)}</p>`],
      f.al_cuerpo && ["cuerpo", "Al cuerpo", alCuerpo(f, categoria?.al_cuerpo)],
      variantes.length && ["variantes", "Variantes",
        lista(variantes.map((v) => `<span class="nombre-variante">${esc(v.nombre)}</span> ${esc(v.texto)}`))],
      ...(f.notas ?? []).map((n, i) => [`nota-${i}`, n.titulo, `<p>${esc(n.texto)}</p>`]),
      ...(f.detalles ?? []).map((d, i) => [`detalle-${i}`, d.titulo, `<p>${esc(d.texto)}</p>`]),
      f.en_ingles && ["ingles", "En inglés", `<p class="en-ingles" lang="en">${esc(f.en_ingles)}</p>`],
    ].filter(Boolean);
    if (!partes.length) return "";
    return `
      <details class="tarjeta plegable mas-ficha">
        <summary><span class="titulo-plegable">Mostrar más</span>
          <span class="resumen-plegable">${esc(resumenMas(f))}</span></summary>
        <div class="cuerpo-plegable">
          ${partes.map(([id, t, cuerpo]) => `<section class="mas-apartado" aria-labelledby="m-${id}">
            <h3 id="m-${id}">${esc(t)}</h3>${cuerpo}
          </section>`).join("")}
        </div>
      </details>`;
  }

  function pintarFicha(f) {
    const categoria = tecnica.categorias.find((c) => c.id === f.categoria);
    antetitulo.textContent = categoria?.titulo ?? "";
    titulo.textContent = tituloFicha(f);
    const errores = f.errores.map((e) =>
      e.correccion ? `${esc(e.error)} <span class="correccion">${esc(e.correccion)}</span>` : esc(e.error));
    raiz.className = "aprende-ficha";
    raiz.innerHTML = `
      <p class="volver-ficha"><a href="#aprende" class="volver">← Aprende</a></p>
      ${f.revisar ? `<div class="cabeza-ficha"><p class="aviso-pendiente">${PENDIENTE}</p></div>` : ""}
      <div class="col-ficha">
        ${apartado("que", "Qué es", `<p>${esc(f.que_es ?? f.frase)}</p>`)}
        ${apartado("como", "Cómo se hace", `<ol class="pasos-ficha">${f.pasos.map((p) => `<li>${esc(p.texto)}</li>`).join("")}</ol>`)}
      </div>
      <div class="col-ficha">
        ${apartado("errores", "Errores típicos", lista(errores))}
        ${mostrarMas(f, categoria)}
      </div>
      <p class="nota pie-aprende">${NOTA_ZURDO}</p>`;
  }

  function pintar(id, { mismaVista }) {
    const ficha = tecnica.fichas.find((f) => f.id === id);
    if (ficha) {
      pintarFicha(ficha);
      ultima = ficha.id;
      if (mismaVista) {
        window.scrollTo(0, 0);
        titulo.focus({ preventScroll: true });
      }
    } else {
      pintarLista({ enfocar: mismaVista });
    }
  }

  let cargando = null;
  return {
    mostrar(parametro, { mismaVista = false } = {}) {
      if (tecnica) return pintar(parametro, { mismaVista });
      raiz.innerHTML = '<p class="nota">Cargando…</p>';
      cargando ??= cargar().then((datos) => (tecnica = datos));
      cargando
        .then(() => pintar(parametro, { mismaVista }))
        .catch((e) => (raiz.innerHTML = `<p class="aviso" role="alert">${esc(e.message)}</p>`));
    },
  };
}
