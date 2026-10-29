// Rutas por hash (#entrenar, #historial, #historial/<clave>, #perfil, #ajustes): funcionan en
// GitHub Pages y sin conexión porque nunca piden otra página al servidor.
// `vistas`: { nombre: { mostrar(parametro) } }. Cada vista vive en <section id="vista-<nombre>">.
// <body data-vista="<nombre>"> dice cuál se ve (el CSS esconde el engranaje en Ajustes).

export function iniciarRutas(vistas, porDefecto) {
  let primera = true;

  function ir() {
    const [nombre, ...resto] = location.hash.slice(1).split("/");
    const actual = nombre in vistas ? nombre : porDefecto;
    for (const n of Object.keys(vistas)) {
      document.getElementById(`vista-${n}`).hidden = n !== actual;
      const enlace = document.querySelector(`#pestanas a[href="#${n}"]`);
      if (n === actual) enlace?.setAttribute("aria-current", "page");
      else enlace?.removeAttribute("aria-current");
    }
    document.body.dataset.vista = actual;
    vistas[actual].mostrar?.(decodeURIComponent(resto.join("/")));
    // Al cambiar de pestaña, el foco va al título de la vista (lectores de pantalla y teclado).
    if (!primera) document.querySelector(`#vista-${actual} h1`)?.focus({ preventScroll: true });
    primera = false;
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", ir);
  ir();
}
