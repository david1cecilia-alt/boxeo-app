// Pestaña Aprende: las fichas de técnica de data/tecnica.json, solo en texto (sin maniquí).
// #aprende es la lista, agrupada por categoría (Golpes, Defensas, Salidas; las vacías no salen);
// #aprende/<id> es una ficha. La cabecera es la misma: en la ficha, el antetítulo dice su categoría
// y el h1 su nombre, así el foco al cambiar de pestaña cae en el título de lo que se ve.
// Las fichas están escritas para guardia diestra: una nota lo dice (no se invierten los textos). En zurdo
// cambian tus manos y tus pies, no lo que se refiere al rival.
import { $, esc } from "./dom.js";

const NOTA_ZURDO =
  "Escrito para guardia diestra (pie izquierdo delante). Si eres zurdo, cambia izquierda por derecha en tus manos y tus pies." +
  " Lo que se refiere al rival no cambia: su hígado sigue en su lado derecho y su crochet de izquierda te sigue llegando por tu derecha.";
const PENDIENTE = "Pendiente de revisar con el entrenador";

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
                <span class="titular">${esc(f.titulo)}</span>
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

  function fuente(x) {
    if (!x.url) return esc(x.titulo);
    return `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titulo)}<span class="solo-lectores"> (se abre en otra pestaña)</span></a>`;
  }

  // «Al cuerpo»: lo propio del golpe a la vista y, plegado, lo común a todos (está una vez, en la categoría).
  function alCuerpo(f, comun) {
    const plegado = comun ? `
      <details class="avanzados comun-cuerpo">
        <summary>Para todos los golpes al cuerpo</summary>
        ${lista(comun.puntos.map((p) => `<strong>${esc(p.titulo)}</strong> ${esc(p.texto)}`))}
        ${comun.fuentes?.length ? `<p class="nota fuentes-comun">Fuentes: ${comun.fuentes.map(fuente).join(" · ")}</p>` : ""}
      </details>` : "";
    return apartado("cuerpo", "Al cuerpo", `<p>${esc(f.al_cuerpo)}</p>${plegado}`);
  }

  // «Mostrar más»: variantes y detalles, plegados. Solo sale si la ficha tiene alguno.
  function mostrarMas(f) {
    const variantes = f.variantes ?? [];
    const detalles = f.detalles ?? [];
    if (!variantes.length && !detalles.length) return "";
    const resumen = [...(variantes.length ? ["Variantes"] : []), ...detalles.map((d) => d.titulo)];
    return `
      <details class="tarjeta plegable mas-ficha">
        <summary><span class="titulo-plegable">Mostrar más</span>
          <span class="resumen-plegable">${resumen.map(esc).join(" · ")}</span></summary>
        <div class="cuerpo-plegable">
          ${variantes.length ? `<section class="mas-apartado" aria-labelledby="m-variantes">
            <h3 id="m-variantes">Variantes</h3>
            ${lista(variantes.map((v) => `<span class="nombre-variante">${esc(v.nombre)}</span> ${esc(v.texto)}`))}
          </section>` : ""}
          ${detalles.map((d, i) => `<section class="mas-apartado" aria-labelledby="m-detalle-${i}">
            <h3 id="m-detalle-${i}">${esc(d.titulo)}</h3><p>${esc(d.texto)}</p>
          </section>`).join("")}
        </div>
      </details>`;
  }

  function pintarFicha(f) {
    const categoria = tecnica.categorias.find((c) => c.id === f.categoria);
    antetitulo.textContent = categoria?.titulo ?? "";
    titulo.textContent = f.titulo;
    const errores = f.errores.map((e) =>
      e.correccion ? `${esc(e.error)} <span class="correccion">${esc(e.correccion)}</span>` : esc(e.error));
    raiz.className = "aprende-ficha";
    raiz.innerHTML = `
      <p class="volver-ficha"><a href="#aprende" class="volver">← Aprende</a></p>
      <div class="cabeza-ficha">
        ${f.revisar ? `<p class="aviso-pendiente">${PENDIENTE}</p>` : ""}
        ${f.en_ingles ? `<p class="nota en-ingles">En inglés: <span lang="en">${esc(f.en_ingles)}</span></p>` : ""}
      </div>
      <div class="col-ficha">
        ${apartado("que", "Qué es", `<p>${esc(f.que_es ?? f.frase)}</p>`)}
        ${apartado("cuando", "Cuándo suele servir", `<p>${esc(f.cuando)}</p>`)}
        ${apartado("como", "Cómo se hace", `<ol class="pasos-ficha">${f.pasos.map((p) => `<li>${esc(p.texto)}</li>`).join("")}</ol>`)}
      </div>
      <div class="col-ficha">
        ${apartado("errores", "Errores típicos", lista(errores))}
        ${f.ventajas ? apartado("ventajas", "Ventajas", `<p>${esc(f.ventajas)}</p>`) : ""}
        ${f.inconvenientes ? apartado("inconvenientes", "Inconvenientes", `<p>${esc(f.inconvenientes)}</p>`) : ""}
        ${f.al_cuerpo ? alCuerpo(f, categoria?.al_cuerpo) : ""}
        ${(f.notas ?? []).map((n, i) => apartado(`nota-${i}`, esc(n.titulo), `<p>${esc(n.texto)}</p>`)).join("")}
        ${mostrarMas(f)}
        <details class="tarjeta plegable fuentes-ficha">
          <summary><span class="titulo-plegable">Fuentes</span></summary>
          <div class="cuerpo-plegable">${lista(f.fuentes.map(fuente))}</div>
        </details>
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
