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
import { $, $$, atraparFoco, esperarIntro } from "./dom.js";

export const RUTA_MENU = "#entrenar/menu";
export const SECCIONES = ["personalizar", "combinaciones", "ajustes"];
const TOQUE = 8;          // px: menos es un toque, no un arrastre
const MITAD = 0.5;        // al soltar despacio: más de la mitad del panel a la vista = abierto
const VELOCIDAD = 0.5;    // px/ms: más rápido que esto, manda el sentido del gesto (a la izquierda abre)
const VENTANA = 100;      // ms de movimiento con los que se mide la velocidad al soltar
const DURACION = 300;     // ms de la transición del panel, tipo muelle (la del CSS)
const LENGUETA = 1700;    // ms de la lengüeta de la pista: entra, ~1,2 s quieta y se recoge (pista-asomar en el CSS)
const GLOBO = 4000;       // ms del globo de la pista, con o sin movimiento (pista-globo en el CSS)

export const enRutaMenu = (hash = location.hash) => hash === RUTA_MENU || hash.startsWith(`${RUTA_MENU}/`);

// `pistaVista()`: si la pista del asa ya se enseñó (perfil.pistas.asa); `marcarPista()` lo guarda.
export function iniciarMenu({ pistaVista = () => true, marcarPista = () => {} } = {}) {
  const asa = $("#asa");
  const dialogo = $("#menu");
  const panel = $(".menu-panel", dialogo);
  const titulo = $("#t-menu", dialogo);
  const lengueta = $(".pista-panel");
  const globo = $("#pista-asa");
  const raiz = document.documentElement;
  let retirada = null;   // temporizador del cierre animado
  let arrastre = null;
  let tragarClic = false;
  let pendiente = false; // se pidió cerrar por el historial y aún no ha cambiado la ruta
  let esperandoIntro = false;
  let finPista = null;   // temporizador de la pista que se está viendo (el del globo, que dura más)
  let finLengueta = null;

  const sinMovimiento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- La pista de la primera vez (plan del rediseño, 3.5) ----------
  // Asoma una lengüeta con el aspecto del panel y un globo junto al asa, sin abrir el <dialog> (nada queda
  // inerte y los toques pasan: pointer-events: none). Siempre después de la intro, solo en Entrenar con el
  // menú cerrado y fuera de la sesión. Se da por vista al enseñarla o al abrir el menú. La lengüeta se recoge
  // enseguida; el globo se queda 4 s para que dé tiempo a leerlo, salvo que antes se toque o se pulse una tecla
  // (el toque o la tecla siguen su camino: solo se retira el globo).
  const asaALaVista = () => document.body.dataset.vista === "entrenar" && !document.body.classList.contains("entrenando")
    && !dialogo.open && !enRutaMenu() && asa.getClientRects().length > 0 && getComputedStyle(asa).visibility !== "hidden";

  function recogerLengueta() {
    clearTimeout(finLengueta);
    finLengueta = null;
    lengueta.hidden = true;
    lengueta.classList.remove("asomando");
  }

  function retirarPista() {
    clearTimeout(finPista);
    finPista = null;
    recogerLengueta();
    globo.hidden = true;
    globo.classList.remove("asomando");
    window.removeEventListener("pointerdown", retirarPista, true);
    window.removeEventListener("keydown", retirarPista, true);
  }

  function darPistaPorVista() {
    if (!pistaVista()) marcarPista();
  }

  async function pista() {
    if (pistaVista() || esperandoIntro || finPista) return;
    esperandoIntro = true;
    await esperarIntro();
    esperandoIntro = false;
    if (pistaVista() || finPista || !asaALaVista()) return;
    marcarPista();
    const quieta = sinMovimiento();
    lengueta.hidden = quieta;
    globo.hidden = false;
    if (!quieta) {
      lengueta.classList.add("asomando");
      globo.classList.add("asomando");
    }
    if (!quieta) finLengueta = setTimeout(recogerLengueta, LENGUETA);
    finPista = setTimeout(retirarPista, GLOBO);
    window.addEventListener("pointerdown", retirarPista, true);
    window.addEventListener("keydown", retirarPista, true);
  }

  // El panel sigue al dedo 1:1: x = cuánto queda fuera por la derecha (0 = abierto del todo).
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
    retirarPista();
    darPistaPorVista();
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

  // Al soltar: si el gesto va rápido (más de VELOCIDAD), manda su sentido; si no, la posición (más de la mitad a
  // la vista, abierto). Da igual desde dónde empezó: el asa o el panel.
  function quedaAbierto(x, ancho, v) {
    if (Math.abs(v) > VELOCIDAD) return v < 0;
    return 1 - x / ancho > MITAD;
  }

  // Soltar. `cancelado` (pointercancel, lostpointercapture): vuelve a como estaba.
  function soltar(e, cancelado) {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const a = arrastre;
    arrastre = null;
    if (!a.movido) return; // un toque: lo hace el clic
    tragarClic = true;
    setTimeout(() => (tragarClic = false), 0);
    if (!cancelado) a.muestras.push({ t: e.timeStamp, x: e.clientX });
    const dx = a.x - a.x0;
    const x = Math.min(Math.max(a.desde === "asa" ? a.ancho + dx : dx, 0), a.ancho);
    const abrir = cancelado ? a.desde === "panel" : quedaAbierto(x, a.ancho, velocidad(a.muestras, e.timeStamp));
    if (a.desde === "asa") {
      if (abrir) pedirApertura();
      else retirar();
    } else if (abrir) {
      asentarAbierto();
    } else {
      pedirCierre();
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
    // Entrenar a la vista con el menú cerrado: la pista, si toca (espera a que acabe la intro).
    pista,
    // Al salir de Entrenar, ir a Mis combinaciones o empezar la sesión: fuera al momento.
    retirarPista,
    get abierto() { return dialogo.open; },
  };
}
