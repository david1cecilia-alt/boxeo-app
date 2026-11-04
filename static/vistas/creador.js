// «Mis combinaciones» (#ajustes/mis-combinaciones): las combinaciones propias, en el almacén de este
// navegador. Listado con editar y borrar (con confirmación). Solo presenta: qué se enseña y cómo se
// dice está en ../creador.js; guardar, en el almacén.
import {
  GRUPOS, anadir, anuncio, baldosas, cambiarCuerpo, combinacionesParaListar, editorNuevo, elegirGrupo, ficha,
  hayCambios, puedeCrear, quitar, quitarUltima, resumen, textoBorrar,
} from "../creador.js";
import { ACCIONES_POR_NIVEL, MAX_ACCIONES, MAX_PROPIAS, NOMBRE_NIVEL } from "../motor/reglas.js";
import { $, anunciar, atraparFoco, esc } from "./dom.js";

export const RUTA = "#ajustes/mis-combinaciones";

const ICONO_EDITAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg>`;
const ICONO_BORRAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`;
const ICONOS_GRUPO = {
  golpe: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V6a2 2 0 0 1 4 0v4M11 9V5a2 2 0 0 1 4 0v5M15 9a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-6-6v-2a2 2 0 0 1 4 0"/></svg>`,
  defensa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/></svg>`,
  movimiento: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5v14M9 12h11M16 8l4 4-4 4"/></svg>`,
};
export const NOTA_ORTODOXA ="Se crean para guardia ortodoxa; en zurdo la app las cambia de lado, como al resto.";

// Las fichas de una combinación con el código de la sesión: golpe = círculo rojo con su número,
// defensa = círculo con borde, salida = círculo discontinuo.
export function fichasHtml(fichas) {
  return fichas.map((f) => `<li class="paso-${f.tipo}"><i>${f.numero ?? ""}</i>${esc(f.texto)}</li>`).join("");
}

// Un botón desactivado con aria-disabled (sigue en el orden del foco y dice por qué): no hace nada.
export const desactivado = (boton) => boton?.getAttribute("aria-disabled") === "true";

// Abre un <dialog> modal con el foco en `inicial`; al cerrarlo se llama a `alCerrar(lo elegido)`.
// Se responde en el momento, no en el evento `close`: ese llega después y, si el diálogo se vuelve
// a abrir enseguida (el «atrás» del navegador), se mezclaría con la respuesta siguiente.
const respuestas = new WeakMap();
export function abrirDialogo(dialogo, inicial, alCerrar) {
  respuestas.set(dialogo, alCerrar);
  dialogo.showModal();
  $(inicial, dialogo)?.focus();
}

function cerrarDialogo(dialogo, valor) {
  const alCerrar = respuestas.get(dialogo);
  respuestas.delete(dialogo);
  dialogo.close(valor);
  alCerrar?.(valor);
}

// Los diálogos se cierran con Esc, tocando el velo (sin elegir: «») o con sus botones (value = lo elegido).
function conectarDialogo(dialogo) {
  dialogo.addEventListener("keydown", atraparFoco);
  dialogo.addEventListener("cancel", (e) => {
    e.preventDefault();
    cerrarDialogo(dialogo, "");
  });
  dialogo.addEventListener("click", (e) => {
    // En el velo (fuera de la caja; el relleno del diálogo también es `e.target === dialogo`).
    const r = dialogo.getBoundingClientRect();
    const fuera = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (e.target === dialogo && fuera) return cerrarDialogo(dialogo, "");
    const boton = e.target.closest("button[value]");
    if (boton) cerrarDialogo(dialogo, boton.value);
  });
}

export function iniciarCreador({ almacen, raiz }) {
  const propias = () => almacen.datos.combinacionesPropias;

  // ---------- Listado ----------
  function pintarListado({ foco = null } = {}) {
    const lista = combinacionesParaListar(propias());
    const crear = puedeCrear(propias());
    raiz.innerHTML = `
      <p class="volver-sub"><a href="#ajustes" class="volver">← Volver</a></p>
      <header class="cabecera-sub">
        <h1 id="t-creador" tabindex="-1">Mis <span class="acento">combinaciones</span></h1>
        <p class="nota">${lista.length} de ${MAX_PROPIAS}. ${NOTA_ORTODOXA}</p>
      </header>
      ${lista.length ? `<ol class="lista-propias">${lista.map((c) => `
        <li class="tarjeta propia" data-propia="${esc(c.id)}">
          <div class="propia-cabecera">
            <h2 id="t-${esc(c.id)}">${c.titulo}</h2>
            ${c.textoNivel ? `<span class="pastilla-nivel">${c.textoNivel}</span>` : ""}
            <button type="button" class="boton-icono" data-editar="${esc(c.id)}"
              aria-label="Editar combinación ${c.numero}">${ICONO_EDITAR}</button>
            <button type="button" class="boton-icono" data-borrar="${esc(c.id)}"
              aria-label="Borrar combinación ${c.numero}">${ICONO_BORRAR}</button>
          </div>
          <p class="solo-lectores">${esc(c.hablado)}</p>
          <ul class="fichas-combo" aria-hidden="true">${fichasHtml(c.fichas)}</ul>
        </li>`).join("")}</ol>`
      : `<p class="tarjeta vacio-propias">Aún no tienes ninguna. Crea las tuyas con los golpes, defensas y salidas
          que quieras trabajar: en Entrenar podrás mezclarlas con las de la biblioteca.</p>`}
      <button type="button" class="anadir-propia" id="anadir-propia"
        ${crear.puede ? "" : 'aria-disabled="true" aria-describedby="motivo-anadir"'}>
        <span aria-hidden="true">+</span> Añadir combinación</button>
      ${crear.motivo ? `<p class="nota motivo" id="motivo-anadir">${crear.motivo}</p>` : ""}
      <dialog id="d-borrar" aria-labelledby="t-borrar" aria-describedby="detalle-borrar">
        <h2 id="t-borrar"></h2>
        <p id="detalle-borrar" class="nota"></p>
        <div class="acciones">
          <button type="button" class="boton secundario" value="">Cancelar</button>
          <button type="button" class="boton peligro" value="borrar">Borrar</button>
        </div>
      </dialog>`;
    conectarDialogo($("#d-borrar", raiz));
    if (foco) $(foco, raiz)?.focus();
  }

  function borrar(id) {
    const i = propias().findIndex((p) => p.id === id);
    const { titulo, detalle } = textoBorrar(i + 1, propias().length);
    const dialogo = $("#d-borrar", raiz);
    $("#t-borrar", dialogo).textContent = titulo;
    $("#detalle-borrar", dialogo).textContent = detalle;
    abrirDialogo(dialogo, 'button[value=""]', (valor) => {
      if (valor !== "borrar") return $(`[data-borrar="${CSS.escape(id)}"]`, raiz)?.focus();
      almacen.borrarPropia(id);
      anunciar(`Borrada la combinación ${i + 1}.`);
      // El foco, a la que ocupa ahora su sitio (la siguiente) o, si era la última, a «Añadir».
      const siguiente = propias()[i] ?? propias()[i - 1];
      pintarListado({ foco: siguiente ? `[data-borrar="${CSS.escape(siguiente.id)}"]` : "#anadir-propia" });
    });
  }

  // ---------- Editor ----------
  // { estado (../creador.js), editando: id o null, numero: «Combinación N» o null, hash, desdeListado }
  let editor = null;
  let pendiente = null; // lo que hacer al volver al listado tras guardar: { foco, anuncio }

  function pintarEditor() {
    const titulo = editor.editando
      ? `Editar <span class="acento">combinación ${editor.numero}</span>`
      : `Nueva <span class="acento">combinación</span>`;
    raiz.innerHTML = `
      <p class="volver-sub"><a href="${RUTA}" class="volver" id="salir-editor">← Mis combinaciones</a></p>
      <h1 id="t-creador" tabindex="-1">${titulo}</h1>
      <div class="editor">
        <div class="editor-combo">
          <section class="tarjeta caja-combo" id="caja-combo" aria-labelledby="t-caja"></section>
          <div class="acciones acciones-editor">
            <button type="button" class="boton secundario" id="quitar-ultima">Quitar la última</button>
            <button type="button" class="boton principal" id="guardar">Guardar</button>
          </div>
          <p class="nota motivo" id="motivo-guardar" hidden></p>
        </div>
        <div class="editor-paleta">
          <div class="grupos-paleta">
            ${Object.entries(GRUPOS).map(([grupo, nombre]) => `<button type="button" class="tarjeta-grupo"
              data-grupo="${grupo}" aria-controls="paleta" aria-expanded="false">${ICONOS_GRUPO[grupo]}<span>${nombre}</span></button>`).join("")}
          </div>
          <div id="paleta" class="paleta"></div>
        </div>
      </div>
      <dialog id="d-avisos" aria-labelledby="t-avisos">
        <h2 id="t-avisos">Antes de guardar</h2>
        <ul class="lista-avisos"></ul>
        <div class="acciones">
          <button type="button" class="boton secundario" value="">Volver a editar</button>
          <button type="button" class="boton principal" value="guardar">Guardar igual</button>
        </div>
      </dialog>
      <dialog id="d-descartar" aria-labelledby="t-descartar" aria-describedby="detalle-descartar">
        <h2 id="t-descartar">¿Descartar los cambios?</h2>
        <p id="detalle-descartar" class="nota">Si sales ahora, se pierde lo que has cambiado en esta combinación.</p>
        <div class="acciones">
          <button type="button" class="boton secundario" value="">Seguir editando</button>
          <button type="button" class="boton peligro" value="descartar">Descartar</button>
        </div>
      </dialog>`;
    conectarDialogo($("#d-avisos", raiz));
    conectarDialogo($("#d-descartar", raiz));
    actualizar();
  }

  // Medidor de nivel: un segmento por acción, agrupados por nivel (Básico 2-4 · Medio 5-6 ·
  // Avanzado 7-10); el primero va con Básico, aunque una acción sola aún no tenga nivel.
  function medidorHtml(n) {
    return `<div class="medidor" aria-hidden="true">${Object.entries(ACCIONES_POR_NIVEL).map(([nivel, [minimo, maximo]]) => {
      const desde = nivel === "1" ? 1 : minimo;
      const segmentos = Array.from({ length: maximo - desde + 1 }, (_, i) => desde + i);
      return `<div class="zona" style="--segmentos: ${segmentos.length}">
        <div class="segmentos">${segmentos.map((s) => `<span class="${s <= n ? "lleno" : ""}"></span>`).join("")}</div>
        <span class="zona-nombre">${NOMBRE_NIVEL[nivel]} ${minimo}-${maximo}</span></div>`;
    }).join("")}</div>`;
  }

  // Repinta lo que cambia y deja el foco en `foco` (selector). `nuevo`: la ficha recién añadida entra animada.
  function actualizar({ foco = null, nuevo = false } = {}) {
    const { estado } = editor;
    const r = resumen(estado.ids, propias(), editor.editando);
    $("#caja-combo", raiz).innerHTML = `
      <h2 id="t-caja" class="solo-lectores">Tu combinación</h2>
      <div class="caja-cabeza">
        <p class="contador">${r.contador}</p>
        <p class="nivel-grande ${r.textoNivel ? "" : "sin-nivel"}">${r.textoNivel ?? "Sin nivel"}</p>
      </div>
      ${medidorHtml(estado.ids.length)}
      ${estado.ids.length ? `<ol class="tira-fichas">${estado.ids.map((id, i) => {
        const f = ficha(id);
        const ultima = nuevo && i === estado.ids.length - 1;
        return `<li><button type="button" class="chip-paso paso-${f.tipo}${ultima ? " nuevo" : ""}" data-quitar="${i}"
          aria-label="Quitar ${esc(f.texto)}, acción ${i + 1}"><i>${f.numero ?? ""}</i>${esc(f.texto)}<span class="aspa" aria-hidden="true">×</span></button></li>`;
      }).join("")}</ol>`
      : `<p class="nota tira-vacia">Toca un golpe, una defensa o una salida para empezar.</p>`}
      <p class="nota">${NOTA_ORTODOXA}</p>`;

    const guardar = $("#guardar", raiz);
    const motivo = $("#motivo-guardar", raiz);
    motivo.hidden = !r.motivo;
    motivo.textContent = r.motivo ?? "";
    marcar(guardar, !r.puedeGuardar, r.motivo ? "motivo-guardar" : null);
    marcar($("#quitar-ultima", raiz), !estado.ids.length, null);

    for (const b of raiz.querySelectorAll("[data-grupo]")) b.setAttribute("aria-expanded", String(b.dataset.grupo === estado.grupo));
    const lista = baldosas(estado.grupo, estado.alCuerpo);
    $("#paleta", raiz).innerHTML = `
      ${estado.grupo === "golpe" ? `<div class="fila-cuerpo">
        <button type="button" role="switch" class="interruptor" id="al-cuerpo" aria-checked="${estado.alCuerpo}"
          aria-describedby="nota-cuerpo"><span class="pista" aria-hidden="true"></span>Al cuerpo</button>
        <span class="nota" id="nota-cuerpo">Del 7 al 12: los mismos golpes, abajo</span>
      </div>` : ""}
      <ul class="baldosas baldosas-${estado.grupo}">${lista.map((b, i) => `<li>
        <button type="button" class="baldosa baldosa-${b.tipo}" data-anadir="${esc(b.id)}" data-pos="${i}"
          ${r.lleno ? 'aria-disabled="true" aria-describedby="motivo-paleta"' : ""}>${b.numero
            ? `<b>${b.numero}</b>` : '<i aria-hidden="true"></i>'}<span>${esc(b.texto)}</span></button></li>`).join("")}</ul>
      ${r.motivoPaleta ? `<p class="nota motivo" id="motivo-paleta">${r.motivoPaleta}</p>` : ""}`;
    if (foco) $(foco, raiz)?.focus();
  }

  // aria-disabled (no `disabled`): el botón sigue en el orden del foco y dice por qué no se puede.
  function marcar(boton, apagado, describe) {
    if (apagado) boton.setAttribute("aria-disabled", "true");
    else boton.removeAttribute("aria-disabled");
    if (describe) boton.setAttribute("aria-describedby", describe);
    else boton.removeAttribute("aria-describedby");
  }

  function abrirEditor(propia) {
    editor = {
      estado: editorNuevo(propia?.ids ?? []),
      editando: propia?.id ?? null,
      numero: propia ? propias().indexOf(propia) + 1 : null,
      hash: location.hash,
      marca: history.state?.marca ?? 0,
      desdeListado: ultimaRuta === RUTA,
    };
    pintarEditor();
  }

  function clicEditor(boton) {
    const { estado } = editor;
    if (boton.dataset.grupo) {
      editor.estado = elegirGrupo(estado, boton.dataset.grupo);
      return actualizar({ foco: `[data-grupo="${boton.dataset.grupo}"]` });
    }
    if (boton.id === "al-cuerpo") {
      editor.estado = cambiarCuerpo(estado, !estado.alCuerpo);
      return actualizar({ foco: "#al-cuerpo" });
    }
    if (boton.dataset.anadir) {
      editor.estado = anadir(estado, boton.dataset.anadir);
      const r = resumen(editor.estado.ids, propias(), editor.editando);
      anunciar(`${anuncio("Añadido", boton.dataset.anadir, editor.estado.ids)}${r.lleno ? ` ${r.motivoPaleta}.` : ""}`);
      return actualizar({ foco: `[data-pos="${boton.dataset.pos}"]`, nuevo: true });
    }
    if (boton.dataset.quitar) {
      const i = Number(boton.dataset.quitar);
      const id = estado.ids[i];
      editor.estado = quitar(estado, i);
      anunciar(anuncio("Quitado", id, editor.estado.ids));
      // El foco, a la ficha que ocupa ahora su sitio (la siguiente) o a «Quitar la última».
      return actualizar({ foco: i < editor.estado.ids.length ? `[data-quitar="${i}"]` : "#quitar-ultima" });
    }
    if (boton.id === "quitar-ultima") {
      const id = estado.ids.at(-1);
      editor.estado = quitarUltima(estado);
      anunciar(anuncio("Quitado", id, editor.estado.ids));
      return actualizar({ foco: "#quitar-ultima" });
    }
    if (boton.id === "guardar") return intentarGuardar();
  }

  // Los avisos (sin golpes, igual que una de la biblioteca o que otra propia) no impiden guardar:
  // se enseñan todos a la vez y se elige «Guardar igual» o «Volver a editar».
  function intentarGuardar() {
    const { avisos } = resumen(editor.estado.ids, propias(), editor.editando);
    if (!avisos.length) return guardar();
    const dialogo = $("#d-avisos", raiz);
    $(".lista-avisos", dialogo).innerHTML = avisos.map((a) => `<li class="aviso">${esc(a.texto)}</li>`).join("");
    abrirDialogo(dialogo, 'button[value=""]', (valor) => {
      if (valor === "guardar") guardar();
      else $("#guardar", raiz)?.focus();
    });
  }

  function guardar() {
    const { ids } = editor.estado;
    let id = editor.editando;
    if (id) {
      if (!almacen.cambiarPropia(id, ids)) id = null;
    } else {
      id = almacen.anadirPropia(ids);
    }
    if (!id) return anunciar("No se ha podido guardar.");
    const n = propias().findIndex((p) => p.id === id) + 1;
    pendiente = { foco: `[data-editar="${CSS.escape(id)}"]`, anuncio: `Guardada la combinación ${n}.` };
    salirDelEditor();
  }

  // Vuelve al listado sin dejar el editor en el historial: si se llegó desde el listado, atrás; si
  // no (se abrió el enlace del editor), se sustituye.
  function salirDelEditor() {
    const desdeListado = editor.desdeListado;
    editor = null;
    if (desdeListado) history.back();
    else location.replace(RUTA);
  }

  // ---------- Clics y rutas ----------
  raiz.addEventListener("click", (e) => {
    const boton = e.target.closest("button");
    if (!boton || desactivado(boton) || boton.closest("dialog")) return;
    if (editor) return clicEditor(boton);
    if (boton.id === "anadir-propia") location.hash = `${RUTA}/nueva`;
    else if (boton.dataset.editar) location.hash = `${RUTA}/editar/${boton.dataset.editar}`;
    else if (boton.dataset.borrar) borrar(boton.dataset.borrar);
  });

  // ---------- Salir con cambios sin guardar ----------
  // Cada entrada del historial lleva una marca de cuándo se creó: al cambiar de ruta, si la nueva es
  // más antigua que la del editor se ha ido atrás. `hashchange` no se puede cancelar: se vuelve al
  // editor recorriendo el historial (adelante o atrás, sin crear entradas) y se pregunta.
  let ultimaRuta = null; // la ruta de antes (para saber si el editor se abrió desde el listado)
  let volviendo = null;  // el hash del editor mientras se vuelve a él
  const marcarEntrada = () => {
    if (history.state?.marca == null) history.replaceState({ ...history.state, marca: Date.now() }, "");
  };
  marcarEntrada();

  // Este oyente va antes que el del router (se conecta al iniciar las vistas; el router, después):
  // si corta el evento, el router no se entera y el editor sigue como estaba.
  window.addEventListener("hashchange", (e) => {
    marcarEntrada();
    if (volviendo) {
      const era = volviendo;
      volviendo = null;
      if (location.hash === era) return e.stopImmediatePropagation();
    }
    ultimaRuta = new URL(e.oldURL).hash;
    if (!editor || location.hash === editor.hash) return;
    if (!hayCambios(editor.estado)) {
      editor = null;
      return;
    }
    e.stopImmediatePropagation();
    const atras = history.state.marca < editor.marca;
    const destino = location.hash;
    volviendo = editor.hash;
    if (atras) history.forward();
    else history.back();
    preguntarDescartar({ destino, atras });
  });

  window.addEventListener("beforeunload", (e) => {
    if (editor && hayCambios(editor.estado)) e.preventDefault();
  });

  // «¿Descartar los cambios?». Con «Descartar», a donde se quería ir: atrás si se fue atrás; si no,
  // a la ruta pedida (al listado, atrás si el editor se abrió desde él).
  function preguntarDescartar({ destino, atras }) {
    const antes = document.activeElement;
    abrirDialogo($("#d-descartar", raiz), 'button[value=""]', (valor) => {
      if (valor !== "descartar") return (antes?.isConnected ? antes : $("#t-creador", raiz))?.focus();
      const desdeListado = editor.desdeListado;
      editor = null;
      if (atras || (destino === RUTA && desdeListado)) history.back();
      else location.hash = destino;
    });
  }

  // «← Mis combinaciones»: sin cambios, atrás si se vino del listado (sin apilar entradas); con
  // cambios, se pregunta antes.
  raiz.addEventListener("click", (e) => {
    if (!editor || !e.target.closest("#salir-editor")) return;
    if (hayCambios(editor.estado)) {
      e.preventDefault();
      preguntarDescartar({ destino: RUTA, atras: false });
    } else if (editor.desdeListado) {
      e.preventDefault();
      salirDelEditor();
    }
  });

  function aListado() {
    history.replaceState(history.state, "", RUTA);
    return mostrar("");
  }

  // `ruta`: lo que va detrás de «mis-combinaciones/» («», «nueva», «editar/<id>»).
  function mostrar(ruta) {
    editor = null;
    if (ruta === "nueva") {
      if (!puedeCrear(propias()).puede) return aListado();
      abrirEditor(null);
    } else if (ruta.startsWith("editar/")) {
      const propia = propias().find((p) => p.id === ruta.slice("editar/".length));
      if (!propia) return aListado();
      abrirEditor(propia);
    } else if (ruta !== "") {
      return aListado();
    } else {
      pintarListado();
    }
    window.scrollTo(0, 0);
    const avisar = !editor && pendiente;
    if (avisar) {
      $(pendiente.foco, raiz)?.focus();
      anunciar(pendiente.anuncio);
      pendiente = null;
    } else {
      $("#t-creador", raiz).focus({ preventScroll: true });
    }
  }

  return { mostrar };
}
