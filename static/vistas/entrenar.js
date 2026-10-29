// Pestaña Entrenar: configuración antes de empezar y pantalla de sesión (para usar con
// guantes a 1–2 m del móvil). No contiene reglas de boxeo: el guion lo genera el motor y
// el reproductor lo lanza en tiempo de sesión (con pausa).
import {
  NOMBRE_RITMO, PERSONALIZADO, nuevoGuion, personalizadaValida, preferencias, recordarSesion, resumenElecciones,
} from "../ajustes.js";
import { crearAzar, semillaAleatoria } from "../motor/azar.js";
import { datos } from "../motor/datos.js";
import { PAUSA_POR_RITMO } from "../motor/ritmo.js";
import { validarConfig } from "../motor/temporizador.js";
import { PARA_REACCIONAR, crearDictado } from "../dictado.js";
import { crearPantallaEncendida } from "../pantalla.js";
import { crearReproductor } from "../reproductor.js";
import { activarSonido, campana, pitido, tablillas } from "../sonido.js";
import { $, anunciar, esc, minutos } from "./dom.js";
import { pasosCombo } from "./pasos.js";

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

  // Presets como chips (radios); los ajustes avanzados solo se ven con "Personalizado".
  const chip = (id, nombre) =>
    `<label class="chip-opcion"><input type="radio" name="preset" value="${id}"><span>${esc(nombre)}</span></label>`;
  $("#presets").insertAdjacentHTML("beforeend",
    presets.map((p) => chip(p.id, p.nombre)).join("") + chip(PERSONALIZADO, "Personalizado"));
  aplicarPreferencias();

  // Marca el asalto y rellena sus valores: los del preset o los de la personalizada guardada.
  function elegirAsalto(id, personalizada) {
    $(`input[name="preset"][value="${id}"]`).checked = true;
    const personalizado = id === PERSONALIZADO;
    $("#avanzados").hidden = !personalizado;
    if (personalizado) $("#avanzados").open = true;
    const p = personalizado ? personalizada : presets.find((x) => x.id === id);
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
    const { asalto, nivel, zurdo, voz, ritmo, reaccion, personalizada } = preferencias(perfilAplicado);
    elegirAsalto(asalto, personalizada);
    $(`input[name="nivel"][value="${nivel}"]`).checked = true;
    $(`input[name="voz"][value="${voz}"]`).checked = true;
    $("#ritmo").value = ritmo;
    $("#zurdo").checked = zurdo;
    $("#reaccion").checked = reaccion;
    resumir();
  }

  // Cada cambio se guarda al momento para la próxima sesión.
  function recordar(cambios) {
    recordarSesion(almacen, cambios);
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
    // Hueco desde que la voz termina hasta la siguiente (se golpea mientras se oye).
    const [min, max] = PAUSA_POR_RITMO[c.ritmo];
    const hueco = min === max ? decimal(min) : `${decimal(min)}–${decimal(max)}`;
    $("#resumen-ritmo").textContent = `${NOMBRE_RITMO[c.ritmo]} · ${hueco} s entre combinaciones`;
    $("#ritmo").style.setProperty("--lleno", `${(c.ritmo - 1) * 25}%`);
    const resumen = `${c.asaltos} × ${minutos(c.duracion_asalto)} · descanso ${minutos(c.descanso)}`;
    $("#resumen-config").textContent = resumen;
    $("#resumen-grande").textContent = resumen;
    $("#resumen-elecciones").textContent = resumenElecciones(c);
  }

  function leerConfigSegura() {
    return $('input[name="nivel"]:checked') ? leerConfig() : null;
  }

  // Elegir Amateur o Prueba no borra la personalizada: sigue guardada para cuando se vuelva.
  $("#presets").addEventListener("change", (e) => {
    elegirAsalto(e.target.value, preferencias(almacen.datos.perfil).personalizada);
    recordar({ asalto: e.target.value });
  });
  // La personalizada se guarda en cuanto es válida (a medio escribir, no).
  for (const id of ["asaltos", "duracion", "descanso"]) {
    $(`#${id}`).addEventListener("input", () => {
      const { asaltos, duracion_asalto, descanso } = leerConfig();
      const personalizada = { asaltos, duracion_asalto, descanso };
      if (personalizadaValida(personalizada)) recordar({ personalizada });
      resumir();
    });
  }
  form.addEventListener("change", (e) => {
    const { nivel, zurdo, modo_reaccion, ritmo, voz } = leerConfig();
    const cambio = { nivel: { nivel }, voz: { voz } }[e.target.name]
      ?? { ritmo: { ritmo }, zurdo: { zurdo }, reaccion: { reaccion: modo_reaccion } }[e.target.id];
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
    // Las combinaciones no van a hora fija: las dicta el dictado, que espera a que la voz termine.
    estado.combos = eventos.filter((e) => e.tipo === "combo");
    estado.fijos = eventos.filter((e) => e.tipo !== "combo");
    estado.reproductor = crearReproductor(estado.fijos, { alLanzar: lanzar });
    estado.dictado = crearDictado({
      reproductor: estado.reproductor, voz, config, azar: crearAzar(semillaAleatoria()),
      alDecir: (c) => {
        mostrarCombo(c.texto, c.ids);
        estado.dictadas.push({ asalto: c.asalto, texto: c.texto, ids: c.ids });
      },
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
        r.programar(1.2, () => dictado.senal(e.texto)); // que no pise la campana
        dictado.asalto({
          combos: estado.combos.filter((c) => c.asalto === e.asalto),
          reservados: reservados(e.asalto),
          fin: estado.finFase,
        });
        break;
      case "reaccion": {
        mostrarTexto(e.texto);
        estado.reaccionHasta = e.t + e.duracion;
        pitido();
        const sesion = estado;
        dictado.senal(e.texto, PARA_REACCIONAR).then(() => {
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
    sesion.dictado.cortar();
    sesion.reproductor.detener();
    document.body.classList.remove("entrenando");
    $("#pantalla").hidden = true;
    pantalla.apagar();
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


  // Completa en el móvil; en escritorio, la corta para que quepa en una línea.
  setTimeout(() => ($("#info-voz").innerHTML =
    `<span class="voz-larga">Voz: ${esc(voz.descripcion)}</span>`
    + `<span class="voz-corta">Voz: ${esc(voz.descripcionCorta ?? voz.descripcion)}</span>`), 500);

  return {
    mostrar() {
      if (estado) return;
      aplicarPreferencias();
      document.fonts.ready.then(verChipElegido); // el ancho de los chips depende de la fuente
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
