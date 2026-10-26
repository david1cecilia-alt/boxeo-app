// Pestaña Entrenar: configuración antes de empezar y pantalla de sesión (para usar con
// guantes a 1–2 m del móvil). No contiene reglas de boxeo: el guion lo genera el motor y
// el reproductor lo lanza en tiempo de sesión (con pausa).
import { nuevoGuion, preferencias } from "../ajustes.js";
import { crearAzar, semillaAleatoria } from "../motor/azar.js";
import { datos } from "../motor/datos.js";
import { PAUSA_POR_NIVEL } from "../motor/ritmo.js";
import { validarConfig } from "../motor/temporizador.js";
import { crearReproductor } from "../reproductor.js";
import { activarSonido, campana, pitido, tablillas } from "../sonido.js";
import { $, anunciar, minutos } from "./dom.js";

const SEGUNDOS_FINAL = 10;
const TEXTO_FASE = {
  asalto: "Asalto", final: "Últimos 10 s", descanso: "Descanso", reaccion: "¡Reacción!", pausa: "En pausa",
};

export function iniciarEntrenar({ almacen, historial, voz, alTerminar }) {
  const form = $("#config");
  const presets = datos().presets.presets;
  let estado = null;        // sesión en curso, o null
  let perfilAplicado = null;

  // ---------- Configuración ----------

  $("#preset").innerHTML = presets.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join("") +
    `<option value="">Personalizado</option>`;
  aplicarPreset(presets[0]);

  function aplicarPreset(p) {
    $("#asaltos").value = p.asaltos;
    $("#duracion").value = p.duracion_asalto;
    $("#descanso").value = p.descanso;
    resumir();
  }

  // Nivel y guardia del perfil (solo cuando el perfil cambia, para no pisar lo que se elija aquí).
  function aplicarPerfil() {
    if (perfilAplicado === almacen.datos.perfil) return;
    perfilAplicado = almacen.datos.perfil;
    const { nivel, zurdo } = preferencias(perfilAplicado);
    $(`input[name="nivel"][value="${nivel}"]`).checked = true;
    $("#zurdo").checked = zurdo;
    resumir();
  }

  function leerConfig() {
    const pausa = $("#pausa").value;
    return {
      asaltos: Number($("#asaltos").value),
      duracion_asalto: Number($("#duracion").value),
      descanso: Number($("#descanso").value),
      nivel: Number($('input[name="nivel"]:checked').value),
      zurdo: $("#zurdo").checked,
      modo_reaccion: $("#reaccion").checked,
      pausa: pausa === "" ? null : Number(pausa),
    };
  }

  function resumir() {
    const c = leerConfigSegura();
    if (!c) return;
    $("#pausa").placeholder = `${PAUSA_POR_NIVEL[c.nivel]} (la del nivel)`;
    $("#resumen-config").textContent =
      `${c.asaltos} × ${minutos(c.duracion_asalto)} · descanso ${minutos(c.descanso)}`;
  }

  function leerConfigSegura() {
    return $('input[name="nivel"]:checked') ? leerConfig() : null;
  }

  $("#preset").addEventListener("change", () => {
    const p = presets.find((x) => x.id === $("#preset").value);
    if (p) aplicarPreset(p);
  });
  for (const id of ["asaltos", "duracion", "descanso"]) {
    $(`#${id}`).addEventListener("input", () => { $("#preset").value = ""; resumir(); });
  }
  form.addEventListener("change", resumir);
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
    const eventos = nuevoGuion(config, almacen.datos.perfil, crearAzar(semillaAleatoria()));
    estado = {
      config,
      fase: "asalto",
      finFase: 0,
      reaccionHasta: -1,
      dictadas: [],
      asaltosCompletados: 0,
    };
    estado.reproductor = crearReproductor(eventos, { alLanzar: lanzar });
    estado.temporizador = setInterval(tic, 100);
    pedirPantallaEncendida();
    document.body.classList.add("entrenando");
    $("#pantalla").hidden = false;
    $("#combo").textContent = "Prepárate";
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
  }

  function lanzar(e) {
    const r = estado.reproductor;
    switch (e.tipo) {
      case "inicio_asalto":
        estado.fase = "asalto";
        estado.finFase = e.t + estado.config.duracion_asalto;
        $("#asalto").textContent = `Asalto ${e.asalto} / ${estado.config.asaltos}`;
        $("#combo").textContent = "¡Boxea!";
        $("#anterior").textContent = "";
        estado.ultimoCombo = null;
        campana(1);
        r.programar(1.2, () => voz.decir(e.texto)); // que no pise la campana
        break;
      case "combo":
        mostrarCombo(e.texto, true);
        voz.decir(e.texto);
        estado.dictadas.push({ asalto: e.asalto, texto: e.texto, ids: e.ids });
        break;
      case "reaccion":
        mostrarCombo(e.texto);
        estado.reaccionHasta = e.t + e.duracion;
        pitido();
        voz.decir(e.texto);
        break;
      case "aviso":
        tablillas();
        voz.decir(e.texto);
        break;
      case "fin_asalto":
        estado.asaltosCompletados = e.asalto;
        campana(3);
        break;
      case "descanso":
        estado.fase = "descanso";
        estado.finFase = e.t + e.duracion;
        mostrarCombo("Descanso");
        r.programar(1.5, () => voz.decir("Descanso"));
        break;
      case "fin_sesion":
        $("#combo").textContent = e.texto;
        setTimeout(() => voz.decir(e.texto), 1500); // la sesión ya ha terminado: fuera del reproductor
        terminar();
        break;
    }
  }

  // En grande lo actual; en pequeño, la combinación anterior (las señales no cuentan).
  function mostrarCombo(texto, esCombinacion = false) {
    if (esCombinacion) {
      $("#anterior").textContent = estado.ultimoCombo ? `Anterior: ${estado.ultimoCombo}` : "";
      estado.ultimoCombo = texto;
    }
    $("#combo").textContent = texto;
  }

  function pausarOReanudar() {
    if (!estado) return;
    if (estado.reproductor.pausado) {
      estado.reproductor.reanudar();
      anunciar("Reanudado");
    } else {
      estado.reproductor.pausar();
      voz.callar();
      anunciar("En pausa");
    }
    pintarPausa();
    tic();
  }

  function pintarPausa() {
    const pausado = estado?.reproductor.pausado ?? false;
    $("#pausa").textContent = pausado ? "Reanudar" : "Pausa";
    $("#pausa").setAttribute("aria-pressed", String(pausado));
  }

  function parar() {
    if (!estado) return;
    voz.callar();
    $("#combo").textContent = "Parado";
    terminar();
  }

  async function terminar() {
    const sesion = estado;
    estado = null;
    clearInterval(sesion.temporizador);
    sesion.reproductor.detener();
    document.body.classList.remove("entrenando");
    $("#pantalla").hidden = true;
    liberarPantalla();
    $("#empezar").focus();
    if (!sesion.dictadas.length) return;
    const datosSesion = {
      asaltos: sesion.asaltosCompletados,
      nivel: sesion.config.nivel,
      zurdo: sesion.config.zurdo,
      duracion_asalto: sesion.config.duracion_asalto,
      descanso: sesion.config.descanso,
      pausa: sesion.config.pausa,
      modo_reaccion: sesion.config.modo_reaccion,
      combinaciones: sesion.dictadas,
    };
    try {
      const id = await historial.guardar(datosSesion);
      alTerminar({ id, combinaciones: sesion.dictadas });
    } catch (e) {
      alert(`No se pudo guardar la sesión: ${e.message}`);
    }
  }

  $("#pausa").addEventListener("click", pausarOReanudar);
  $("#parar").addEventListener("click", parar);

  // ---------- Pantalla encendida ----------
  // Wake Lock durante toda la sesión, también en pausa. El navegador lo suelta al cambiar
  // de app o bloquear el móvil, así que se vuelve a pedir al volver.
  let bloqueoPantalla = null;
  async function pedirPantallaEncendida() {
    try { bloqueoPantalla = await navigator.wakeLock?.request("screen"); } catch { /* no soportado */ }
  }
  function liberarPantalla() {
    bloqueoPantalla?.release();
    bloqueoPantalla = null;
  }
  document.addEventListener("visibilitychange", () => {
    if (estado && document.visibilityState === "visible") pedirPantallaEncendida();
  });

  setTimeout(() => ($("#info-voz").textContent = `Voz: ${voz.descripcion}`), 500);

  return {
    mostrar() {
      if (!estado) aplicarPerfil();
    },
    get entrenando() { return estado !== null; },
  };
}

// Atajos de teclado en el PC durante la sesión: espacio = pausa, Esc = parar.
export function atajosEntrenar() {
  document.addEventListener("keydown", (e) => {
    if (!document.body.classList.contains("entrenando") || e.target.closest("dialog")) return;
    if (e.key === " " && e.target === document.body) { e.preventDefault(); $("#pausa").click(); }
    if (e.key === "Escape") $("#parar").click();
  });
}
