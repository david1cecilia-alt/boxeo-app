// Intro «QUE EMPIECE EL ASALTO» (plan del rediseño, 3.6). Script clásico, justo después de <div id="intro">:
// decide antes de pintar, así no se ve Entrenar un instante antes de la intro. Todo lo que se ve está en
// estilos.css (solo transform y opacity); aquí solo se montan las letras, se cuentan los tiempos y se quita.
//
// Una vez por arranque en frío (sessionStorage, D13); si sessionStorage falla, se muestra. Con
// prefers-reduced-motion no sale. El primer toque o tecla la salta con un fundido corto, y ni ese toque (ni
// el clic que lo sigue) ni esa tecla llegan a lo de debajo. Al salir del DOM lanza «intro-fin» en document
// (vistas/dom.js: esperarIntro).
(() => {
  const intro = document.getElementById("intro");
  if (!intro) return;
  const CLAVE = "boxeo.intro";
  const TEXTO = "QUE EMPIECE EL ASALTO";
  const ZOOM = 1500;   // ms: la cámara avanza y la vista se acerca
  const FIN = 1900;    // ms: la capa sale del DOM
  const SALTO = 150;   // ms del fundido al saltarla

  function quitar() {
    intro.remove();
    document.documentElement.classList.remove("con-intro", "intro-acercando");
    document.dispatchEvent(new Event("intro-fin"));
  }

  let vista = false;
  try {
    vista = sessionStorage.getItem(CLAVE) !== null;
  } catch { /* sin sessionStorage: se muestra */ }
  if (vista || matchMedia("(prefers-reduced-motion: reduce)").matches) return quitar();
  try {
    sessionStorage.setItem(CLAVE, "vista");
  } catch { /* se mostrará también la próxima vez */ }

  // Cada letra en su span, en orden de lectura (--i; los espacios no cuentan). Se parte solo entre palabras.
  let i = 0;
  const escena = document.createElement("div");
  escena.className = "intro-escena";
  const lema = document.createElement("p");
  lema.className = "intro-lema";
  for (const palabra of TEXTO.split(" ")) {
    const p = document.createElement("span");
    p.className = "intro-palabra";
    for (const letra of palabra) {
      const l = document.createElement("span");
      l.className = "intro-letra";
      l.dataset.l = letra;
      l.textContent = letra;
      l.style.setProperty("--i", String(i++));
      p.append(l);
    }
    lema.append(p, " ");
  }
  escena.append(lema);
  intro.append(escena);
  document.documentElement.classList.add("con-intro");

  // ---------- Saltarla sin que el toque o la tecla lleguen a lo de debajo ----------
  // Mientras está, se traga todo en captura. Después, solo lo que queda del gesto que la saltó: el pointerup
  // y el click de ese puntero, o el keyup (Espacio pulsa al soltar) y el click sintético de esa tecla.
  let viva = true;
  let puntero = null; // pointerId del toque que la saltó, hasta soltarlo
  let tecla = null;   // code de la tecla que la saltó, hasta soltarla
  let tragarClic = false;
  const tragar = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const tiposRaton = ["mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu"];

  function alPulsar(e) {
    if (!viva) {
      if (e.type === "keydown" && e.code === tecla) return tragar(e); // la repetición de la tecla aún pulsada
      // Un gesto nuevo: el del salto ya acabó sin clic (se soltó fuera, o Intro, que no da clic al soltar).
      tragarClic = false;
      return soltarOyentes();
    }
    tragar(e);
    if (e.type === "pointerdown") puntero ??= e.pointerId;
    else tecla ??= e.code;
    saltar();
  }
  function alSoltar(e) {
    const delGesto = e.type === "pointerup" || e.type === "pointercancel" ? e.pointerId === puntero : e.code === tecla;
    if (!viva && !delGesto) return;
    tragar(e);
    if (!delGesto) return;
    if (e.type === "keyup") tecla = null;
    else puntero = null;
    // El click, si llega, va justo después del pointerup / keyup: se traga y ahí acaba el gesto.
    tragarClic = true;
    soltarOyentes();
  }
  function alRaton(e) {
    if (!viva && !tragarClic && puntero === null) return;
    tragar(e);
    if (!viva && e.type === "click") {
      tragarClic = false;
      soltarOyentes();
    }
  }

  const oyentes = [
    ["pointerdown", alPulsar], ["keydown", alPulsar],
    ["pointerup", alSoltar], ["pointercancel", alSoltar], ["keyup", alSoltar],
    ...tiposRaton.map((tipo) => [tipo, alRaton]),
  ];
  for (const [tipo, oyente] of oyentes) window.addEventListener(tipo, oyente, true);
  // Se quitan cuando ya no queda nada del gesto (con tragarClic aún puesto siguen, hasta el clic o el gesto
  // siguiente).
  function soltarOyentes() {
    if (viva || puntero !== null || tecla !== null || tragarClic) return;
    for (const [tipo, oyente] of oyentes) window.removeEventListener(tipo, oyente, true);
  }

  // ---------- Tiempos ----------
  const temporizadores = [
    setTimeout(() => document.documentElement.classList.add("intro-acercando"), ZOOM),
    setTimeout(terminar, FIN),
  ];

  function terminar() {
    if (!viva) return;
    viva = false;
    temporizadores.forEach(clearTimeout);
    quitar();
    soltarOyentes();
  }

  let saltando = false;
  function saltar() {
    if (saltando) return;
    saltando = true;
    temporizadores.forEach(clearTimeout);
    // El fundido parte de la opacidad de ahora (si ya se estaba desvaneciendo, no vuelve a encenderse).
    intro.style.setProperty("--desde", getComputedStyle(intro).opacity);
    intro.classList.add("saltando");
    setTimeout(terminar, SALTO);
  }
})();
