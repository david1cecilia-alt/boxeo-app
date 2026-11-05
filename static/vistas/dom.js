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

// El <dialog> modal deja el resto de la página inerte, pero con Tab el foco puede irse a la barra
// del navegador: del último se vuelve al primero (y al revés con Mayús+Tab). Para su `keydown`.
export function atraparFoco(e) {
  if (e.key !== "Tab") return;
  const enfocables = $$("button, input, a[href]", e.currentTarget)
    .filter((el) => el.tabIndex >= 0 && el.getClientRects().length && !el.closest("[hidden]"));
  const [primero, ultimo] = [enfocables[0], enfocables.at(-1)];
  if (e.shiftKey ? document.activeElement === primero : document.activeElement === ultimo) {
    e.preventDefault();
    (e.shiftKey ? ultimo : primero).focus();
  }
}
