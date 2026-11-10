// Rutas por hash (#entrenar, #entrenar/mis-combinaciones[/nueva|/editar/<id>], #aprende, #aprende/<id>,
// #historial, #historial/<clave>, #perfil, #ajustes): funcionan en GitHub Pages y sin conexión porque nunca
// piden otra página al servidor.
// `vistas`: { nombre: { mostrar(parametro, { mismaVista }) } }. Cada vista vive en <section id="vista-<nombre>">.
// <body data-vista="<nombre>"> dice cuál se ve (el CSS esconde el engranaje en Ajustes).
// Dentro de la misma vista (#historial/... → #historial/...) la vista se encarga del foco y del scroll.
// Al cambiar de vista, el foco va a su h1, salvo que la vista ya lo haya puesto dentro de ella (el creador
// en su título; Ajustes, al volver del creador, en su tarjeta).

// ---------- Rutas viejas ----------
// «Mis combinaciones» vivía en #ajustes/mis-combinaciones[/nueva|/editar/<id>]: marcadores y enlaces viejos
// llevan a #entrenar/mis-combinaciones con el resto de la ruta. #ajustes a secas sigue siendo Ajustes.
// Se hace antes que nadie, al cargar este módulo (app.js lo importa el primero), para que ni el creador
// ni el router vean nunca la ruta vieja y sin dejarla en el historial (history.length no crece):
// - al arrancar, con replaceState: no salta otro hashchange y el router pinta una sola vez;
// - después, cortando el hashchange de la vieja y sustituyéndola (location.replace): llega otro con la nueva.
const VIEJA_CREADOR = "#ajustes/mis-combinaciones";
const NUEVA_CREADOR = "#entrenar/mis-combinaciones";

export function rutaNueva(hash) {
  if (hash !== VIEJA_CREADOR && !hash.startsWith(`${VIEJA_CREADOR}/`)) return null;
  return NUEVA_CREADOR + hash.slice(VIEJA_CREADOR.length);
}

const alArrancar = rutaNueva(location.hash);
if (alArrancar) history.replaceState(history.state, "", alArrancar);

window.addEventListener("hashchange", (e) => {
  const nueva = rutaNueva(location.hash);
  if (!nueva) return;
  e.stopImmediatePropagation();
  location.replace(nueva);
});

export function iniciarRutas(vistas, porDefecto) {
  let anterior = null;

  function ir() {
    const [nombre, ...resto] = location.hash.slice(1).split("/");
    const actual = nombre in vistas ? nombre : porDefecto;
    const mismaVista = actual === anterior;
    for (const n of Object.keys(vistas)) {
      document.getElementById(`vista-${n}`).hidden = n !== actual;
      const enlace = document.querySelector(`#pestanas a[href="#${n}"]`);
      if (n === actual) enlace?.setAttribute("aria-current", "page");
      else enlace?.removeAttribute("aria-current");
    }
    document.body.dataset.vista = actual;
    const focoAntes = document.activeElement;
    vistas[actual].mostrar?.(decodeURIComponent(resto.join("/")), { mismaVista });
    if (!mismaVista) {
      // Al cambiar de pestaña, el foco va al título de la vista (lectores de pantalla y teclado), salvo
      // que la vista lo acabe de poner dentro de ella.
      const vista = document.getElementById(`vista-${actual}`);
      const puestoPorLaVista = document.activeElement !== focoAntes && vista.contains(document.activeElement);
      if (anterior && !puestoPorLaVista) vista.querySelector("h1")?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
    anterior = actual;
  }

  window.addEventListener("hashchange", ir);
  ir();
}
