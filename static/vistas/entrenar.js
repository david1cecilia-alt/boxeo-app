// Pestaña Entrenar: configuración antes de empezar y pantalla de sesión (para usar con
// guantes a 1–2 m del móvil). No contiene reglas de boxeo: el guion lo genera el motor y
// el reproductor lo lanza en tiempo de sesión (con pausa).
import { nuevoGuion, preferencias, recordarSesion } from "../ajustes.js";
import { catalogo, nombreCorto, numero } from "../motor/acciones.js";
import { crearAzar, semillaAleatoria } from "../motor/azar.js";
import { datos } from "../motor/datos.js";
import { PAUSA_POR_RITMO } from "../motor/ritmo.js";
import { validarConfig } from "../motor/temporizador.js";
import { crearReproductor } from "../reproductor.js";
import { activarSonido, campana, pitido, tablillas } from "../sonido.js";
import { $, anunciar, esc, minutos } from "./dom.js";

const SEGUNDOS_FINAL = 10;
const NOMBRE_RITMO = { 1: "Calmado", 2: "Tranquilo", 3: "Constante", 4: "Vivo", 5: "Intenso" };
const decimal = (x) => String(x).replace(".", ",");
const TEXTO_FASE = {
  asalto: "En asalto", final: "Últimos 10 s", descanso: "Descanso", reaccion: "¡Reacción!", pausa: "En pausa",
};

export function iniciarEntrenar({ almacen, historial, voz, alTerminar }) {
  const form = $("#config");
  const presets = datos().presets.presets;
  let estado = null;        // sesión en curso, o null
  let perfilAplicado = null;

  // ---------- Configuración ----------

  // Presets como chips (radios); los ajustes avanzados solo se ven con "Personalizado".
  const chip = (id, nombre) =>
    `<label class="chip-opcion"><input type="radio" name="preset" value="${id}"><span>${esc(nombre)}</span></label>`;
  $("#presets").insertAdjacentHTML("beforeend",
    presets.map((p) => chip(p.id, p.nombre)).join("") + chip("", "Personalizado"));
  marcarPreset(presets[0].id);
  aplicarPreset(presets[0]);

  function marcarPreset(id) {
    $(`input[name="preset"][value="${id}"]`).checked = true;
    $("#avanzados").hidden = id !== "";
  }

  function aplicarPreset(p) {
    $("#asaltos").value = p.asaltos;
    $("#duracion").value = p.duracion_asalto;
    $("#descanso").value = p.descanso;
    resumir();
  }

  // Nivel, guardia, voz y ritmo del perfil (solo cuando el perfil cambia, para no pisar lo que
  // se elija aquí).
  function aplicarPerfil() {
    if (perfilAplicado === almacen.datos.perfil) return;
    perfilAplicado = almacen.datos.perfil;
    const { nivel, zurdo, voz, ritmo } = preferencias(perfilAplicado);
    $(`input[name="nivel"][value="${nivel}"]`).checked = true;
    $(`input[name="voz"][value="${voz}"]`).checked = true;
    $("#ritmo").value = ritmo;
    $("#zurdo").checked = zurdo;
    resumir();
  }

  // Voz y ritmo se recuerdan para la próxima sesión.
  function recordar() {
    const { voz, ritmo } = leerConfig();
    recordarSesion(almacen, { voz, ritmo });
    perfilAplicado = almacen.datos.perfil;
  }

  function leerConfig() {
    return {
      asaltos: Number($("#asaltos").value),
      duracion_asalto: Number($("#duracion").value),
      descanso: Number($("#descanso").value),
      nivel: Number($('input[name="nivel"]:checked').value),
      zurdo: $("#zurdo").checked,
      modo_reaccion: $("#reaccion").checked,
      pausa: null, // la del ritmo
      ritmo: Number($("#ritmo").value),
      voz: $('input[name="voz"]:checked')?.value ?? "nombres",
    };
  }

  function resumir() {
    const c = leerConfigSegura();
    if (!c) return;
    const [min, max] = PAUSA_POR_RITMO[c.ritmo];
    $("#resumen-ritmo").textContent = `${NOMBRE_RITMO[c.ritmo]} · ${decimal(min)}–${decimal(max)} s entre combinaciones`;
    $("#ritmo").style.setProperty("--lleno", `${(c.ritmo - 1) * 25}%`);
    const resumen = `${c.asaltos} × ${minutos(c.duracion_asalto)} · descanso ${minutos(c.descanso)}`;
    $("#resumen-config").textContent = resumen;
    $("#resumen-grande").textContent = resumen;
  }

  function leerConfigSegura() {
    return $('input[name="nivel"]:checked') ? leerConfig() : null;
  }

  $("#presets").addEventListener("change", (e) => {
    const p = presets.find((x) => x.id === e.target.value);
    marcarPreset(e.target.value);
    if (p) aplicarPreset(p);
    else $("#avanzados").open = true;
  });
  for (const id of ["asaltos", "duracion", "descanso"]) {
    $(`#${id}`).addEventListener("input", () => { marcarPreset(""); resumir(); });
  }
  form.addEventListener("change", (e) => {
    if (e.target.name === "voz" || e.target.id === "ritmo") recordar();
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
    const eventos = nuevoGuion(config, almacen.datos.perfil, crearAzar(semillaAleatoria()));
    estado = {
      config,
      fase: "asalto",
      finFase: 0,
      reaccionHasta: -1,
      dictadas: [],
      asalto: 0,
      asaltosCompletados: 0,
    };
    estado.reproductor = crearReproductor(eventos, { alLanzar: lanzar });
    estado.temporizador = setInterval(tic, 100);
    pedirPantallaEncendida();
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

  function lanzar(e) {
    const r = estado.reproductor;
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
        r.programar(1.2, () => voz.decir(e.texto)); // que no pise la campana
        break;
      case "combo":
        mostrarCombo(e.texto, e.ids);
        voz.decir(e.texto);
        estado.dictadas.push({ asalto: e.asalto, texto: e.texto, ids: e.ids });
        break;
      case "reaccion":
        mostrarTexto(e.texto);
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
        mostrarTexto("Descanso");
        r.programar(1.5, () => voz.decir("Descanso"));
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
  // Ambos, cada golpe lleva su número (el del zurdo, por su mano adelantada/trasera); con
  // Nombres, el círculo solo marca el tipo. Los ids ya vienen en espejo para el zurdo.
  function mostrarCombo(texto, ids) {
    const acciones = ids.map((id) => catalogo().get(id));
    const anterior = estado.ultimoCombo;
    $("#anterior").textContent = anterior ? `Anterior: ${anterior}` : "";
    if (acciones.includes(undefined)) {
      estado.ultimoCombo = texto;
      return mostrarTexto(texto);
    }
    const { voz, zurdo } = estado.config;
    const cortos = acciones.map(nombreCorto);
    const numeros = acciones.map((a) => (voz === "nombres" ? null : numero(a, zurdo)));
    estado.ultimoCombo = cortos.map((c, i) => (numeros[i] ? `${numeros[i]} ${c}` : c)).join(" · ");
    $("#combo").innerHTML = `<ol class="pasos" aria-label="${esc(texto)}">${acciones.map((a, i) =>
      `<li class="paso-${a.tipo}"><i aria-hidden="true">${numeros[i] ?? ""}</i>${esc(cortos[i])}</li>`).join("")}</ol>`;
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
      ritmo: sesion.config.ritmo,
      voz: sesion.config.voz,
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
