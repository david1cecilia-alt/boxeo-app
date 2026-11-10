// Pestaña Entrenar: configuración antes de empezar y pantalla de sesión (para usar con
// guantes a 1–2 m del móvil). No contiene reglas de boxeo: el guion lo genera el motor y
// el reproductor lo lanza en tiempo de sesión (con pausa).
import {
  NOMBRE_RITMO, OPCIONES_MEZCLA, PRESET_DE_TIPO, conPrueba, configGeneral, configSesion, estadoMezcla, nuevoGuion, personalizadaValida, preferencias,
  recordarSesion, repetirColetillas, resumenElecciones,
} from "../ajustes.js";
import { crearAzar, semillaAleatoria } from "../motor/azar.js";
import { datos } from "../motor/datos.js";
import { PAUSA_POR_RITMO } from "../motor/ritmo.js";
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
const decimal = (x) => String(x).replace(".", ",");
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

  // El tipo de sesión como chips (radios): la General (con el nombre del preset «amateur»), Prueba
  // (solo con ?prueba, y no se guarda) y Personalizado. Los ajustes avanzados solo se ven con
  // "Personalizado".
  const nombrePreset = (tipo) => presets.find((p) => p.id === PRESET_DE_TIPO[tipo]).nombre;
  const chip = (tipo, nombre) =>
    `<label class="chip-opcion"><input type="radio" name="preset" value="${tipo}"><span>${esc(nombre)}</span></label>`;
  $("#presets").insertAdjacentHTML("beforeend", chip("general", nombrePreset("general"))
    + (conPrueba() ? chip("prueba", nombrePreset("prueba")) : "") + chip("personalizada", "Personalizado"));
  // «Tus combinaciones»: Ninguna · Poco · Bastante · Mucho en una fila y «Solo las mías» debajo.
  $("#mezclas").insertAdjacentHTML("beforeend", OPCIONES_MEZCLA.map(({ id, nombre, porcentaje }) =>
    `<label${id === "solo" ? ' class="mezcla-solo"' : ""}><input type="radio" name="mezcla" value="${id}">`
    + `<span><b>${porcentaje} %</b>${esc(nombre)}</span></label>`).join(""));
  aplicarPreferencias();

  // Marca el tipo y rellena sus valores: los del preset o los de la personalizada guardada.
  function elegirTipo(tipo, personalizada) {
    $(`input[name="preset"][value="${tipo}"]`).checked = true;
    const personalizado = tipo === "personalizada";
    $("#avanzados").hidden = !personalizado;
    if (personalizado) $("#avanzados").open = true;
    const p = personalizado ? personalizada
      : tipo === "general" ? configGeneral() : presets.find((x) => x.id === PRESET_DE_TIPO[tipo]);
    $("#asaltos").value = p.asaltos;
    $("#duracion").value = p.duracion_asalto;
    $("#descanso").value = p.descanso;
  }

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

  // Lo último que se eligió aquí (o lo que se cambió en Guardia/Nivel del perfil). Se aplica solo
  // si el perfil ha cambiado: lo de aquí ya está guardado, así que aplicarlo de nuevo no pisa nada.
  function aplicarPreferencias() {
    if (perfilAplicado === almacen.datos.perfil) return;
    perfilAplicado = almacen.datos.perfil;
    const { tipo, nivel, ritmo, reaccion, mezcla, personalizada } = preferencias(perfilAplicado);
    // Prueba no se guarda: si estaba elegida, se queda mientras no se elija otra cosa.
    const prueba = $('input[name="preset"][value="prueba"]:checked') && tipo !== "personalizada";
    elegirTipo(prueba ? "prueba" : tipo, personalizada);
    $(`input[name="nivel"][value="${nivel}"]`).checked = true;
    $(`input[name="mezcla"][value="${mezcla}"]`).checked = true;
    $("#ritmo").value = ritmo;
    $("#reaccion").checked = reaccion;
    resumir();
  }

  // Cada cambio se guarda al momento para la próxima sesión.
  function recordar(cambios) {
    recordarSesion(almacen, cambios);
    perfilAplicado = almacen.datos.perfil;
  }

  // Lo que marcan los controles ahora mismo (para guardarlo al cambiar).
  function leerControles() {
    return {
      asaltos: Number($("#asaltos").value),
      duracion_asalto: Number($("#duracion").value),
      descanso: Number($("#descanso").value),
      nivel: Number($('input[name="nivel"]:checked').value),
      modo_reaccion: $("#reaccion").checked,
      ritmo: Number($("#ritmo").value),
      mezcla: $('input[name="mezcla"]:checked')?.value ?? "ninguna",
    };
  }

  // La sesión que sale al pulsar Empezar: la del tipo marcado, con lo guardado (configSesion). La General
  // nunca lee lo de la Personalizada.
  function leerConfig() {
    return configSesion(almacen.datos.perfil, { tipo: $('input[name="preset"]:checked')?.value });
  }

  function resumir() {
    const controles = leerConfigSegura();
    if (!controles) return;
    // Hueco desde que la voz termina hasta la siguiente (se golpea mientras se oye).
    const [min, max] = PAUSA_POR_RITMO[controles.ritmo];
    const hueco = min === max ? decimal(min) : `${decimal(min)}–${decimal(max)}`;
    $("#resumen-ritmo").textContent = `${NOMBRE_RITMO[controles.ritmo]} · ${hueco} s entre combinaciones`;
    $("#ritmo").style.setProperty("--lleno", `${(controles.ritmo - 1) * 25}%`);
    const c = leerConfig();
    const resumen = `${c.asaltos} × ${minutos(c.duracion_asalto)} · descanso ${minutos(c.descanso)}`;
    $("#resumen-config").textContent = resumen;
    $("#resumen-grande").textContent = resumen;
    $("#resumen-elecciones").textContent = resumenElecciones({ ...c, mezcla: pintarMezcla(c) });
  }

  // Estados de «Tus combinaciones» (y del nivel) con las propias de ahora. Devuelve la mezcla con
  // la que se sorteará de verdad. Los desactivados lo están de verdad (disabled): el motivo va
  // escrito debajo y en aria-describedby del grupo.
  function pintarMezcla(c) {
    const { total, efectiva, motivoSolo, aviso, nivelCuenta } = estadoMezcla(c.mezcla, almacen.datos.combinacionesPropias, c.nivel);
    $("#mezclas").disabled = total === 0;
    $('input[name="mezcla"][value="solo"]').disabled = total > 0 && Boolean(motivoSolo);
    $("#niveles").disabled = !nivelCuenta;
    const notaNivel = $("#nota-nivel");
    notaNivel.hidden = nivelCuenta;
    notaNivel.textContent = nivelCuenta ? "" : "Con «Solo las mías» no cuenta el nivel: salen todas las tuyas.";
    const nota = $("#nota-mezcla");
    if (total === 0) {
      nota.innerHTML = `Aún no tienes combinaciones propias. <a href="${RUTA_CREADOR}/nueva">Crea la primera</a> y mézclala con la biblioteca.`;
    } else {
      nota.textContent = [motivoSolo, aviso].filter(Boolean).join(" ");
    }
    nota.hidden = !nota.textContent;
    return efectiva;
  }

  function leerConfigSegura() {
    return $('input[name="nivel"]:checked') ? leerControles() : null;
  }

  // Elegir la General o Prueba no borra la personalizada: sigue guardada para cuando se vuelva.
  // Prueba no se recuerda: es solo para probar.
  $("#presets").addEventListener("change", (e) => {
    elegirTipo(e.target.value, preferencias(almacen.datos.perfil).personalizada);
    if (e.target.value !== "prueba") recordar({ tipo: e.target.value });
  });
  // La personalizada se guarda en cuanto es válida (a medio escribir, no).
  for (const id of ["asaltos", "duracion", "descanso"]) {
    $(`#${id}`).addEventListener("input", () => {
      const { asaltos, duracion_asalto, descanso } = leerControles();
      const personalizada = { asaltos, duracion_asalto, descanso };
      if (personalizadaValida(personalizada)) recordar({ personalizada });
      resumir();
    });
  }
  form.addEventListener("change", (e) => {
    const { nivel, modo_reaccion, ritmo, mezcla } = leerControles();
    const cambio = { nivel: { nivel }, mezcla: { mezcla } }[e.target.name]
      ?? { ritmo: { ritmo }, reaccion: { reaccion: modo_reaccion } }[e.target.id];
    if (cambio) recordar(cambio);
    resumir();
  });
  $("#ritmo").addEventListener("input", resumir);
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
  const personalizar = iniciarPersonalizar({ almacen, alCambiar: alCambiarMenu });
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
        menu.abrirPorRuta(veniaDelCreador ? "combinaciones" : resto[0]);
        if (veniaDelCreador) $("#ir-creador").focus({ preventScroll: true });
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
