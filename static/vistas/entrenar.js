// Pestaña Entrenar: configuración antes de empezar y pantalla de sesión (para usar con
// guantes a 1–2 m del móvil). No contiene reglas de boxeo: el guion lo genera el motor y
// el reproductor lo lanza en tiempo de sesión (con pausa).
import {
  PRESET_DE_TIPO, conPrueba, configSesion, estadoMezcla, nuevoGuion, preferencias, recordarSesion, repetirColetillas,
  resumenElecciones,
} from "../ajustes.js";
import { crearAzar, semillaAleatoria } from "../motor/azar.js";
import { datos } from "../motor/datos.js";
import { COMBINACIONES, PREPARACION, validarConfig } from "../motor/temporizador.js";
import { PARA_REACCIONAR, crearDictado } from "../dictado.js";
import { crearPantallaEncendida } from "../pantalla.js";
import { crearReproductor } from "../reproductor.js";
import { activarSonido, campana, dejarDormir, mantenerDespierto, pitido, tablillas } from "../sonido.js";
import { MAX_PROPIAS } from "../motor/reglas.js";
import { iniciarAjustes } from "./ajustes.js";
import { RUTA as RUTA_CREADOR, iniciarCreador } from "./creador.js";
import { $, anunciar, esc, minutos } from "./dom.js";
import { iniciarMenu } from "./menu.js";
import { iniciarPersonalizar } from "./personalizar.js";
import { combinacionesParaVer, pasosCombo } from "./pasos.js";

const SEGUNDOS_FINAL = 10;
const TEXTO_FASE = {
  asalto: "En asalto", final: "Últimos 10 s", descanso: "Descanso", reaccion: "¡Reacción!", pausa: "En pausa",
};

export function iniciarEntrenar({ almacen, historial, voz, alTerminar }) {
  const form = $("#config");
  const presets = datos().presets.presets;
  let estado = null;        // sesión en curso, o null
  // Wake Lock de empezar a parar/terminar (pausa y descanso incluidos); se repide al volver.
  const pantalla = crearPantallaEncendida();
  let perfilAplicado = null;

  // ---------- Configuración ----------
  // Aquí solo se elige el tipo de sesión y se ve su resumen; la Personalizada se cambia en el menú
  // (vistas/personalizar.js) y voz, Nombrar y guardia, en su sección Ajustes (vistas/ajustes.js).

  // El tipo de sesión como chips (radios): la General, Prueba (solo con ?prueba, y no se guarda) y la
  // Personalizada.
  const nombrePreset = (tipo) => presets.find((p) => p.id === PRESET_DE_TIPO[tipo]).nombre;
  const chip = (tipo, nombre) =>
    `<label class="chip-opcion"><input type="radio" name="preset" value="${tipo}"><span>${esc(nombre)}</span></label>`;
  $("#presets").insertAdjacentHTML("beforeend", chip("general", "General")
    + (conPrueba() ? chip("prueba", nombrePreset("prueba")) : "") + chip("personalizada", "Personalizada"));
  const tipoElegido = () => $('input[name="preset"]:checked')?.value ?? "general";
  aplicarPreferencias();

  // En el móvil la fila de chips se desplaza en horizontal: si el elegido no se ve entero, se mueve
  // lo justo para mostrarlo (sin animación y sin tocar el scroll vertical de la página).
  function verChipElegido() {
    const fila = $("#presets");
    const chip = $('input[name="preset"]:checked')?.parentElement;
    if (!chip || fila.scrollWidth <= fila.clientWidth) return;
    const relleno = parseFloat(getComputedStyle(fila).paddingLeft) || 0;
    const f = fila.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    if (c.right > f.right - relleno) fila.scrollLeft += c.right - (f.right - relleno);
    else if (c.left < f.left + relleno) fila.scrollLeft -= f.left + relleno - c.left;
  }

  // Lo último que se eligió (o lo que se cambió en el menú). Se aplica solo si el perfil ha cambiado: lo de
  // aquí ya está guardado, así que aplicarlo de nuevo no pisa nada.
  function aplicarPreferencias() {
    if (perfilAplicado === almacen.datos.perfil) return;
    perfilAplicado = almacen.datos.perfil;
    // El tipo guardado. Prueba no se guarda: con ?prueba se arranca en ella y se queda mientras no se elija
    // otro tipo o se toque algo de la Personalizada (personalizar.js).
    const { tipo } = preferencias(perfilAplicado, { prueba: false });
    const marcado = $('input[name="preset"]:checked')?.value;
    const prueba = marcado ? marcado === "prueba" : conPrueba();
    $(`input[name="preset"][value="${prueba ? "prueba" : tipo}"]`).checked = true;
    resumir();
  }

  // La sesión que sale al pulsar Empezar: la del tipo marcado, con lo guardado (configSesion). La General
  // nunca lee lo de la Personalizada.
  function leerConfig() {
    return configSesion(almacen.datos.perfil, { tipo: tipoElegido() });
  }

  function resumir() {
    const c = leerConfig();
    const resumen = `${c.asaltos} × ${minutos(c.duracion_asalto)} · descanso ${minutos(c.descanso)}`;
    $("#resumen-config").textContent = resumen;
    $("#resumen-grande").textContent = resumen;
    // La mezcla con la que se sorteará de verdad (con «Solo las mías», el nivel no cuenta).
    const { efectiva } = estadoMezcla(c.mezcla, almacen.datos.combinacionesPropias, c.nivel);
    $("#resumen-elecciones").textContent = resumenElecciones({ ...c, mezcla: efectiva });
  }

  // Elegir la General o Prueba no borra la Personalizada: sigue guardada para cuando se vuelva. Prueba no se
  // recuerda: es solo para probar.
  $("#presets").addEventListener("change", (e) => {
    if (e.target.value !== "prueba") {
      recordarSesion(almacen, { tipo: e.target.value });
      perfilAplicado = almacen.datos.perfil;
    }
    resumir();
    personalizar.actualizar(); // el aviso del menú
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); empezar(); });

  // ---------- Sesión ----------

  function empezar() {
    activarSonido(); // tiene que ser dentro del clic
    const config = leerConfig();
    const errores = validarConfig(config);
    if (errores.length) {
      alert("Configuración no válida:\n" + errores.join("\n"));
      return;
    }
    const eventos = nuevoGuion(config, almacen.datos.perfil, crearAzar(semillaAleatoria()),
      almacen.datos.combinacionesPropias);
    estado = {
      config,
      repetibles: repetirColetillas(config, almacen.datos.combinacionesPropias),
      fase: "asalto",
      finFase: 0,
      reaccionHasta: -1,
      asalto: 0,
      asaltosCompletados: 0,
    };
    // Las combinaciones no van a hora fija: las dicta el dictado, que espera a que la voz termine.
    estado.combos = eventos.filter((e) => COMBINACIONES.includes(e.tipo));
    estado.fijos = eventos.filter((e) => !COMBINACIONES.includes(e.tipo));
    estado.reproductor = crearReproductor(estado.fijos, { alLanzar: lanzar });
    estado.dictado = crearDictado({
      reproductor: estado.reproductor, voz, config,
      alDecir: (c) => mostrarCombo(c.texto, c.ids),
    });
    estado.temporizador = setInterval(tic, 100);
    pantalla.encender();
    document.body.classList.add("entrenando");
    $("#pantalla").hidden = false;
    $("#progreso").innerHTML = "<i><b></b></i>".repeat(config.asaltos);
    $("#asalto").innerHTML = `Asalto <span class="acento">1</span>/${config.asaltos}`;
    mostrarTexto("Prepárate");
    $("#anterior").textContent = "";
    pintarPausa();
    tic();
    $("#pausa").focus();
  }

  function tic() {
    estado.reproductor.tic();
    if (!estado) return; // fin_sesion lo ha terminado
    const ahora = estado.reproductor.tiempo();
    const restante = Math.max(0, estado.finFase - ahora);
    $("#tiempo").textContent = minutos(Math.ceil(restante));
    let fase = estado.fase;
    if (estado.reproductor.pausado) fase = "pausa";
    else if (ahora < estado.reaccionHasta) fase = "reaccion";
    else if (fase === "asalto" && restante <= SEGUNDOS_FINAL) fase = "final";
    $("#pantalla").dataset.fase = fase;
    $("#fase").textContent = TEXTO_FASE[fase];
    pintarProgreso(restante);
    $("#despues").textContent = despues();
  }

  // Una barra por asalto: los pasados llenos y el actual según el tiempo que lleva.
  function pintarProgreso(restante) {
    const { asalto, fase, config } = estado;
    const actual = fase === "asalto" ? 1 - restante / config.duracion_asalto : 1;
    [...$("#progreso").children].forEach((barra, i) => {
      const lleno = i + 1 < asalto ? 1 : i + 1 === asalto ? actual : 0;
      barra.firstChild.style.width = `${Math.round(lleno * 100)}%`;
    });
  }

  function despues() {
    const { asalto, fase, config } = estado;
    if (fase === "descanso" || asalto === 0) return `Después · asalto ${asalto + 1}`;
    if (asalto >= config.asaltos) return "Último asalto";
    return config.descanso > 0 ? `Después · descanso ${minutos(config.descanso)}` : `Después · asalto ${asalto + 1}`;
  }

  // Señales previstas del asalto n (aviso y reacciones), que una combinación no debe pisar.
  function reservados(n) {
    return estado.fijos.filter((e) => e.asalto === n && (e.tipo === "aviso" || e.tipo === "reaccion"))
      .map((e) => [e.t, e.t + e.duracion]);
  }

  function lanzar(e) {
    const r = estado.reproductor;
    const dictado = estado.dictado;
    switch (e.tipo) {
      case "inicio_asalto":
        estado.fase = "asalto";
        estado.asalto = e.asalto;
        estado.finFase = e.t + estado.config.duracion_asalto;
        $("#asalto").innerHTML = `Asalto <span class="acento">${e.asalto}</span>/${estado.config.asaltos}`;
        $("#marca-asalto").textContent = `R${e.asalto}`;
        mostrarTexto("¡Boxea!");
        $("#anterior").textContent = "";
        estado.ultimoCombo = null;
        campana(1);
        mantenerDespierto(); // solo con el asalto en marcha: ni en pausa, ni en descanso, ni al acabar
        r.programar(1.2, () => dictado.senal(e.texto)); // que no pise la campana
        dictado.asalto({
          cola: estado.combos.filter((c) => c.asalto === e.asalto && c.tipo !== "coletilla"),
          coletillas: estado.combos.filter((c) => c.asalto === e.asalto && c.tipo === "coletilla" && c.t >= estado.finFase),
          reservados: reservados(e.asalto),
          desde: e.t + PREPARACION,
          fin: estado.finFase,
          repetibles: estado.repetibles,
        });
        break;
      case "reaccion": {
        mostrarTexto(e.texto);
        estado.reaccionHasta = e.t + e.duracion;
        pitido();
        const sesion = estado;
        dictado.reaccion(e.texto).then(() => {
          sesion.reaccionHasta = Math.max(sesion.reaccionHasta, r.tiempo() + PARA_REACCIONAR);
        });
        break;
      }
      case "aviso":
        tablillas();
        dictado.senal(e.texto);
        break;
      case "fin_asalto":
        estado.asaltosCompletados = e.asalto;
        dictado.cortar();
        dejarDormir();
        campana(3);
        break;
      case "descanso":
        estado.fase = "descanso";
        estado.finFase = e.t + e.duracion;
        mostrarTexto("Descanso");
        r.programar(1.5, () => dictado.hablar("Descanso"));
        break;
      case "fin_sesion":
        mostrarTexto(e.texto);
        setTimeout(() => voz.decir(e.texto), 1500); // la sesión ya ha terminado: fuera del reproductor
        terminar();
        break;
    }
  }

  // En grande lo actual, paso a paso con el tipo de cada acción (golpe, defensa, pies) y su
  // nombre corto; en pequeño, la combinación anterior (las señales no cuentan). Con Números o
  // Ambos, cada golpe lleva su número; con Nombres, el círculo solo marca el tipo (pasos.js).
  function mostrarCombo(texto, ids) {
    const pasos = pasosCombo(ids, estado.config);
    const anterior = estado.ultimoCombo;
    $("#anterior").textContent = anterior ? `Anterior: ${anterior}` : "";
    if (!pasos) {
      estado.ultimoCombo = texto;
      return mostrarTexto(texto);
    }
    estado.ultimoCombo = pasos.map((p) => (p.numero ? `${p.numero} ${p.texto}` : p.texto)).join(" · ");
    $("#combo").innerHTML = `<ol class="pasos" aria-label="${esc(texto)}">${pasos.map((p) =>
      `<li class="paso-${p.tipo}"><i aria-hidden="true">${p.numero ?? ""}</i>${esc(p.texto)}</li>`).join("")}</ol>`;
    $("#leyenda").hidden = false;
  }

  function mostrarTexto(texto) {
    $("#combo").innerHTML = `<p class="combo-texto">${esc(texto)}</p>`;
    $("#leyenda").hidden = true;
  }

  function pausarOReanudar() {
    if (!estado) return;
    if (estado.reproductor.pausado) {
      estado.reproductor.reanudar();
      if (estado.fase === "asalto") mantenerDespierto();
      anunciar("Reanudado");
    } else {
      estado.reproductor.pausar();
      dejarDormir();
      voz.callar();
      anunciar("En pausa");
    }
    pintarPausa();
    tic();
  }

  function pintarPausa() {
    const pausado = estado?.reproductor.pausado ?? false;
    $("#pausa span").textContent = pausado ? "Seguir" : "Pausa";
    $("#pausa").setAttribute("aria-pressed", String(pausado));
  }

  function parar() {
    if (!estado) return;
    voz.callar();
    mostrarTexto("Parado");
    terminar();
  }

  async function terminar() {
    const sesion = estado;
    estado = null;
    clearInterval(sesion.temporizador);
    sesion.dictado.cortar();
    sesion.reproductor.detener();
    dejarDormir();
    document.body.classList.remove("entrenando");
    $("#pantalla").hidden = true;
    pantalla.apagar();
    $("#empezar").focus();
    const dichas = sesion.dictado.dichas; // solo lo que se dijo: nunca las reservas sin usar
    if (!dichas.length) return;
    const datosSesion = {
      asaltos: sesion.asaltosCompletados,
      nivel: sesion.config.nivel,
      zurdo: sesion.config.zurdo,
      duracion_asalto: sesion.config.duracion_asalto,
      descanso: sesion.config.descanso,
      pausa: sesion.config.pausa,
      ritmo: sesion.config.ritmo,
      voz: sesion.config.voz,
      modo_reaccion: sesion.config.modo_reaccion,
      tipo: sesion.config.tipo, // General, Personalizada o Prueba: el nombre en el Historial
      combinaciones: dichas,
    };
    try {
      const id = await historial.guardar(datosSesion);
      // En la valoración, como en el Historial: con los números en cifra («1 jab»).
      alTerminar({ id, combinaciones: combinacionesParaVer(datosSesion, dichas) });
    } catch (e) {
      alert(`No se pudo guardar la sesión: ${e.message}`);
    }
  }

  $("#pausa").addEventListener("click", pausarOReanudar);
  $("#parar").addEventListener("click", parar);


  // La voz que de verdad se usa (cambia al cargar las voces o al elegir otra en Ajustes).
  // Completa en el móvil; en escritorio, la corta para que quepa en una línea.
  function pintarVoz() {
    $("#info-voz").innerHTML =
      `<span class="voz-larga">Voz: ${esc(voz.descripcion)}</span>`
      + `<span class="voz-corta">Voz: ${esc(voz.descripcionCorta ?? voz.descripcion)}</span>`;
  }
  pintarVoz();
  voz.alCambiar?.(pintarVoz);

  // ---------- «Mis combinaciones» (#entrenar/mis-combinaciones/…) ----------
  // Se pinta en #entrenar-sub y, mientras se ve, el CSS esconde lo demás de Entrenar (#vista-entrenar[data-sub]).
  // Se crea aquí, antes que el router: su oyente de hashchange tiene que ir antes que el del router.
  const vista = $("#vista-entrenar");
  const sub = $("#entrenar-sub");
  const creador = iniciarCreador({ almacen, raiz: sub, voz });

  function mostrarCreador(ruta) {
    vista.dataset.sub = "creador";
    vista.setAttribute("aria-labelledby", "t-creador");
    sub.hidden = false;
    creador.mostrar(ruta);
  }

  // Al salir del creador se vacía (sus diálogos y botones no se quedan en la página) y vuelve Entrenar.
  function cerrarCreador() {
    if (!vista.dataset.sub) return false;
    delete vista.dataset.sub;
    vista.setAttribute("aria-labelledby", "t-entrenar");
    sub.hidden = true;
    sub.replaceChildren();
    return true;
  }

  // ---------- El asa y el menú lateral (#entrenar/menu[/<seccion>]) ----------
  // Lo abre y cierra la ruta: mostrar() le dice qué hacer en cada cambio. Sus secciones: Personalizar
  // sesión (personalizar.js), Mis combinaciones (aquí) y Ajustes (ajustes.js). Lo que se guarda en ellas
  // se refleja al momento aquí debajo (el selector y «Tu sesión»).
  const menu = iniciarMenu();
  const alCambiarMenu = () => {
    aplicarPreferencias();
    resumir();
  };
  const personalizar = iniciarPersonalizar({
    almacen, tipoElegido,
    alCambiar() {
      $('input[name="preset"][value="personalizada"]').checked = true; // también desde Prueba (D3)
      alCambiarMenu();
    },
  });
  const ajustes = iniciarAjustes({
    almacen, voz,
    alCambiar() {
      alCambiarMenu();
      personalizar.pintar(); // los nombres de «Practicar más» llevan la mano de la guardia
    },
  });

  function pintarCombinaciones() {
    $("#menu-combinaciones").innerHTML = `
      <p class="nota">Crea las tuyas y mézclalas con la biblioteca en tu Personalizada.</p>
      <a href="${RUTA_CREADOR}" class="tarjeta tarjeta-enlace" id="ir-creador">
        <span class="tarjeta-enlace-texto">
          <span class="titular">Mis combinaciones
            <span class="acento">${almacen.datos.combinacionesPropias.length}/${MAX_PROPIAS}</span></span>
        </span>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </a>`;
  }
  pintarCombinaciones();

  // Cerrar el menú cierra también la hoja de «Practicar más», que va encima de él.
  function cerrarMenu(opciones) {
    personalizar.cerrar();
    menu.cerrarPorRuta(opciones);
  }

  return {
    mostrar(parametro = "") {
      const [primera, ...resto] = parametro.split("/");
      if (primera === "mis-combinaciones") {
        cerrarMenu({ animar: false, foco: false }); // el foco lo pone el creador
        // Con una sesión en marcha no se abre: la sesión sigue y la ruta vuelve a #entrenar.
        if (estado) return location.replace("#entrenar");
        return mostrarCreador(resto.join("/"));
      }
      const enMenu = primera === "menu";
      const veniaDelCreador = cerrarCreador();
      if (estado) {
        // Con una sesión en marcha tampoco se abre el menú.
        if (enMenu) location.replace("#entrenar");
        return;
      }
      aplicarPreferencias();
      resumir(); // las propias pueden haber cambiado en el creador
      if (enMenu) {
        // Al volver de Mis combinaciones, su sección abierta y el foco en su enlace (de donde se salió).
        if (!menu.abierto) {
          pintarCombinaciones();
          personalizar.pintar();
          ajustes.pintar();
        }
        // La sección de la ruta manda; sin ella (atrás desde el listado), la de Mis combinaciones.
        const seccion = resto[0] || (veniaDelCreador ? "combinaciones" : undefined);
        menu.abrirPorRuta(seccion);
        if (veniaDelCreador && seccion === "combinaciones") $("#ir-creador").focus({ preventScroll: true });
      } else {
        cerrarMenu();
      }
      // Del creador a Entrenar sin cambiar de vista (atrás, un enlace): el router no mueve el foco.
      if (veniaDelCreador && !enMenu) $("#t-entrenar").focus({ preventScroll: true });
      document.fonts.ready.then(verChipElegido); // el ancho de los chips depende de la fuente
    },
    // Al dejar Entrenar, el menú se cierra al momento (sin tocar el historial ni el foco).
    ocultar() { cerrarMenu({ animar: false, foco: false }); },
    get entrenando() { return estado !== null; },
  };
}

// Atajos de teclado en el PC durante la sesión: espacio = pausa, Esc = parar. Nunca con el menú abierto:
// un oyente de document sigue recibiendo teclas aunque el <dialog> modal deje la página inerte.
export function atajosEntrenar() {
  document.addEventListener("keydown", (e) => {
    if (!document.body.classList.contains("entrenando") || e.target.closest("dialog")) return;
    if ($("#menu")?.open) return;
    if (e.key === " " && e.target === document.body) { e.preventDefault(); $("#pausa").click(); }
    if (e.key === "Escape") $("#parar").click();
  });
}
