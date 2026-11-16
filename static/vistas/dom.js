// Utilidades de presentación compartidas por las vistas.

export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

// Escapa texto para meterlo en HTML (las notas las escribe el usuario o vienen de un JSON importado).
export function esc(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// Las fechas se guardan como "2026-10-26T10:02:13" en hora local (sin zona).
export const aFecha = (iso) => new Date(iso);

const FORMATO_FECHA = new Intl.DateTimeFormat("es-ES", {
  weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
// "Lun, 26 oct, 19:15": mayúscula solo en la primera letra.
export function fechaLarga(iso) {
  const texto = FORMATO_FECHA.format(aFecha(iso));
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const FORMATO_DIA = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" });
export const diaCorto = (fecha) => FORMATO_DIA.format(fecha);

export function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Singular o plural según la cifra: palabra(1, "sesión", "sesiones") → «sesión»; plural(…) → «1 sesión».
export const palabra = (n, una, varias) => (n === 1 ? una : varias);
export const plural = (n, una, varias) => `${n} ${palabra(n, una, varias)}`;

export function minutos(segundos) {
  const s = Math.round(segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Mensaje para lectores de pantalla (región role="status").
export function anunciar(texto) {
  const estado = document.getElementById("estado");
  if (!estado) return;
  estado.textContent = "";
  setTimeout(() => (estado.textContent = texto), 50);
}

// Se cumple cuando la intro (intro.js) ya no está: al momento si no hay #intro, o al llegar «intro-fin».
export function esperarIntro() {
  if (!document.getElementById("intro")) return Promise.resolve();
  return new Promise((listo) => document.addEventListener("intro-fin", () => listo(), { once: true }));
}

// El <dialog> modal deja el resto de la página inerte, pero con Tab el foco puede irse a la barra
// del navegador: del último se vuelve al primero (y al revés con Mayús+Tab). Para su `keydown`.
export function atraparFoco(e) {
  if (e.key !== "Tab") return;
  // Solo los que Tab alcanza de verdad: ni lo de dentro de un <details> cerrado (checkVisibility) ni, de un
  // grupo de radios con uno marcado, los demás (Tab solo para en el marcado).
  const raiz = e.currentTarget;
  const marcado = (nombre) => $$(`input[type="radio"]`, raiz).some((r) => r.name === nombre && r.checked);
  const enfocables = $$("button, input, select, textarea, a[href], summary", raiz)
    .filter((el) => el.tabIndex >= 0 && el.getClientRects().length && !el.closest("[hidden]")
      && (el.checkVisibility?.() ?? true) && (el.type !== "radio" || el.checked || !marcado(el.name)));
  const [primero, ultimo] = [enfocables[0], enfocables.at(-1)];
  if (!primero) return;
  // El foco puede estar fuera de la lista (un título con tabindex="-1"): cuenta si va antes del primero
  // o después del último.
  const actual = document.activeElement;
  const fuera = !enfocables.includes(actual);
  const antes = fuera && actual.compareDocumentPosition(primero) & Node.DOCUMENT_POSITION_FOLLOWING;
  const despues = fuera && actual.compareDocumentPosition(ultimo) & Node.DOCUMENT_POSITION_PRECEDING;
  if (e.shiftKey ? actual === primero || antes : actual === ultimo || despues) {
    e.preventDefault();
    (e.shiftKey ? ultimo : primero).focus();
  }
}

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
export function conectarDialogo(dialogo) {
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
