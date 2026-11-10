// El asa y el menú lateral de Entrenar (#entrenar/menu[/personalizar|combinaciones|ajustes]). Solo presenta,
// abre y cierra: el contenido lo pintarán las secciones.
//
// Manda la ruta. Abrir añade #entrenar/menu al historial (con la marca `menu: true` en history.state, que
// sobrevive a recargar); el <dialog> solo refleja la ruta: entrenar.mostrar() llama a abrirPorRuta() o
// cerrarPorRuta(). Por eso el menú no escucha hashchange: si la redirección de rutas.js o el creador cortan
// el evento, el menú tampoco se entera, que es lo correcto.
// Todos los cierres del usuario («✕», Esc, velo, arrastre, el asa del panel) pasan por pedirCierre():
// con entrada propia, history.back(); si se llegó directo (recarga sin marca, enlace, redirección),
// location.replace("#entrenar"), para no salir de la app. «Atrás» cambia la ruta y cierra por el mismo camino.
import { $, $$, atraparFoco } from "./dom.js";

export const RUTA_MENU = "#entrenar/menu";
export const SECCIONES = ["personalizar", "combinaciones", "ajustes"];
const TOQUE = 8;          // px: menos es un toque, no un arrastre
const FRACCION = 0.3;     // del ancho del panel para abrir o cerrar al soltar
const VELOCIDAD = 0.5;    // px/ms: un gesto rápido abre o cierra aunque sea corto
const VENTANA = 100;      // ms de movimiento con los que se mide la velocidad al soltar
const DURACION = 220;     // ms de la transición del panel (la del CSS)

export const enRutaMenu = (hash = location.hash) => hash === RUTA_MENU || hash.startsWith(`${RUTA_MENU}/`);

export function iniciarMenu() {
  const asa = $("#asa");
  const dialogo = $("#menu");
  const panel = $(".menu-panel", dialogo);
  const titulo = $("#t-menu", dialogo);
  const raiz = document.documentElement;
  let retirada = null;   // temporizador del cierre animado
  let arrastre = null;
  let tragarClic = false;
  let pendiente = false; // se pidió cerrar por el historial y aún no ha cambiado la ruta

  const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // El panel sigue al dedo: x = cuánto asoma fuera por la derecha (0 = abierto del todo).
  function seguir(x, ancho) {
    if (x == null) {
      panel.style.transform = "";
      dialogo.style.removeProperty("--progreso");
      return;
    }
    panel.style.transform = `translateX(${x}px)`;
    dialogo.style.setProperty("--progreso", String(1 - x / ancho));
  }

  // Pone el <dialog> modal en pantalla, con el panel aún fuera (sin «visible»).
  function ponerDialogo() {
    clearTimeout(retirada);
    retirada = null;
    if (!dialogo.open) dialogo.showModal();
  }

  // Lleva el panel a abierto. Desde un arrastre, la transición parte de donde está el dedo.
  function asentarAbierto() {
    ponerDialogo();
    panel.getBoundingClientRect(); // fija la posición de partida para que haya transición
    dialogo.classList.remove("arrastrando");
    seguir(null);
    dialogo.classList.add("visible");
    raiz.classList.add("menu-abierto");
    asa.setAttribute("aria-expanded", "true");
  }

  // Quita el <dialog> del todo y devuelve el foco al asa (salvo al salir de Entrenar).
  function quitarDialogo({ foco }) {
    clearTimeout(retirada);
    retirada = null;
    arrastre = null;
    dialogo.classList.remove("visible", "arrastrando");
    seguir(null);
    raiz.classList.remove("menu-abierto");
    asa.setAttribute("aria-expanded", "false");
    if (dialogo.open) dialogo.close();
    if (foco) asa.focus({ preventScroll: true });
  }

  // El panel se va (animado si se puede) y después se quita el <dialog>. No toca el historial.
  function retirar({ foco = true, animar = true } = {}) {
    if (!dialogo.open) return;
    if (!animar || sinMovimiento()) return quitarDialogo({ foco });
    dialogo.classList.remove("arrastrando", "visible");
    seguir(null);
    clearTimeout(retirada);
    retirada = setTimeout(() => quitarDialogo({ foco }), DURACION);
  }

  // ---------- Abrir y cerrar (lo que pide el usuario) ----------
  function pedirApertura() {
    asentarAbierto();
    if (enRutaMenu()) return;
    location.hash = RUTA_MENU;
    // La entrada nueva ya existe (el hashchange llega después): se marca como propia.
    history.replaceState({ ...history.state, menu: true }, "");
  }

  // La única puerta de los cierres del usuario. `pendiente`: ya se pidió volver y aún no ha llegado el
  // cambio de ruta (dos Esc seguidos, Esc y velo…); pedirlo otra vez sacaría de la app.
  function pedirCierre() {
    if (!enRutaMenu() || pendiente) return retirar(); // un arrastre a medias nunca llegó a la ruta
    pendiente = true;
    retirar();
    if (history.state?.menu) history.back();
    else location.replace("#entrenar");
  }

  // ---------- Lo que manda la ruta (entrenar.mostrar) ----------
  function abrirPorRuta(seccion) {
    pendiente = false;
    if (SECCIONES.includes(seccion)) {
      for (const d of $$("details", dialogo)) d.open = d.dataset.seccion === seccion;
    }
    asentarAbierto();
    if (!dialogo.contains(document.activeElement)) titulo.focus({ preventScroll: true });
    if (SECCIONES.includes(seccion)) $(`details[data-seccion="${seccion}"]`, dialogo).scrollIntoView({ block: "nearest" });
  }

  // ---------- Toques ----------
  asa.addEventListener("click", pedirApertura);
  $(".asa-panel", dialogo).addEventListener("click", pedirCierre);
  $(".menu-cerrar", dialogo).addEventListener("click", pedirCierre);
  // El velo: el <dialog> ocupa la pantalla y el panel va dentro; un clic en el propio <dialog> es fuera.
  dialogo.addEventListener("click", (e) => {
    if (e.target === dialogo) pedirCierre();
  });
  // El clic que sigue a un arrastre no es un toque.
  document.addEventListener("click", (e) => {
    if (!tragarClic) return;
    tragarClic = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  // Tab no sale del panel (sin esto, del último se iría a la barra del navegador).
  dialogo.addEventListener("keydown", atraparFoco);

  // Esc: el <dialog> se cerraría solo y el historial se quedaría en #entrenar/menu. Pasa por pedirCierre().
  dialogo.addEventListener("cancel", (e) => {
    e.preventDefault();
    pedirCierre();
  });
  // Si aun así el navegador lo cierra (un segundo Esc seguido ya no se puede cancelar), se sincroniza.
  dialogo.addEventListener("close", () => {
    if (dialogo.open || !raiz.classList.contains("menu-abierto")) return; // lo cerramos nosotros
    quitarDialogo({ foco: true });
    if (enRutaMenu()) pedirCierre();
  });

  // ---------- Arrastre (eventos de puntero; touch-action: none en el asa, la franja y la cabecera) ----------
  function empezar(e, desde) {
    if (e.button !== 0 || arrastre) return;
    if (desde === "panel" && !dialogo.classList.contains("visible")) return;
    arrastre = {
      desde, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, movido: false, ancho: 0,
      muestras: [{ t: e.timeStamp, x: e.clientX }], elemento: e.currentTarget,
    };
  }

  function mover(e) {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const a = arrastre;
    a.x = e.clientX;
    a.muestras.push({ t: e.timeStamp, x: e.clientX });
    const dx = e.clientX - a.x0;
    if (!a.movido) {
      if (Math.hypot(dx, e.clientY - a.y0) < TOQUE) return;
      a.movido = true;
      // La captura, solo ya arrastrando: con ella el clic iría al elemento capturado (la cabecera) y no
      // al «✕» que se tocó. Los oyentes de window siguen el dedo aunque no la haya.
      try { a.elemento.setPointerCapture(a.id); } catch { /* sin captura */ }
      if (a.desde === "asa") ponerDialogo();
      dialogo.classList.add("arrastrando");
      a.ancho = panel.offsetWidth;
    }
    const x = a.desde === "asa" ? a.ancho + dx : dx;
    seguir(Math.min(Math.max(x, 0), a.ancho), a.ancho);
  }

  // Velocidad (px/ms, positiva hacia la derecha) de lo último que se movió.
  function velocidad(muestras, ahora) {
    const recientes = muestras.filter((m) => ahora - m.t <= VENTANA);
    if (recientes.length < 2) return 0;
    const [primera, ultima] = [recientes[0], recientes.at(-1)];
    const tiempo = ultima.t - primera.t;
    return tiempo > 0 ? (ultima.x - primera.x) / tiempo : 0;
  }

  // Soltar. `cancelado` (pointercancel, lostpointercapture): como soltar sin llegar al umbral.
  function soltar(e, cancelado) {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const a = arrastre;
    arrastre = null;
    if (!a.movido) return; // un toque: lo hace el clic
    tragarClic = true;
    setTimeout(() => (tragarClic = false), 0);
    if (!cancelado) a.muestras.push({ t: e.timeStamp, x: e.clientX });
    const dx = a.x - a.x0;
    const v = cancelado ? 0 : velocidad(a.muestras, e.timeStamp);
    if (a.desde === "asa") {
      if (!cancelado && (-dx >= FRACCION * a.ancho || -v > VELOCIDAD)) pedirApertura();
      else retirar();
    } else if (!cancelado && (dx >= FRACCION * a.ancho || v > VELOCIDAD)) {
      pedirCierre();
    } else {
      asentarAbierto();
    }
  }

  for (const [elemento, desde] of [[asa, "asa"], [$(".asa-panel", dialogo), "panel"], [$(".menu-cabecera", dialogo), "panel"]]) {
    elemento.addEventListener("pointerdown", (e) => empezar(e, desde));
    // Solo cuenta perder NUESTRA captura: con el dedo, el navegador captura antes el hijo tocado (el «✕» de
    // la cabecera) y, al capturar nosotros, su lostpointercapture sube hasta aquí.
    elemento.addEventListener("lostpointercapture", (e) => {
      if (e.target === elemento) soltar(e, true);
    });
  }
  window.addEventListener("pointermove", mover);
  window.addEventListener("pointerup", (e) => soltar(e, false));
  window.addEventListener("pointercancel", (e) => soltar(e, true));

  return {
    abrirPorRuta,
    // `animar: false` y `foco: false` al salir de Entrenar o ir a Mis combinaciones.
    cerrarPorRuta(opciones) {
      pendiente = false;
      retirar(opciones);
    },
    get abierto() { return dialogo.open; },
  };
}
