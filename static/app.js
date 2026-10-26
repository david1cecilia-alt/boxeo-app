// Reproductor del guion. No contiene reglas de boxeo: solo pide el guion
// al backend y lanza cada evento cuando llega su segundo.
import { crearVoz } from "./voz.js";
import { activarSonido, campana, tablillas, pitido } from "./sonido.js";

const $ = (id) => document.getElementById(id);
const voz = crearVoz();

let presets = [];
let pausaPorNivel = {};
let estado = null; // datos de la sesión en curso, o null si no hay ninguna

// ---------- Configuración ----------

async function cargarConfig() {
  const datos = await (await fetch("/api/config")).json();
  presets = datos.presets;
  pausaPorNivel = datos.pausa_por_nivel;
  $("preset").innerHTML =
    presets.map((p) => `<option value="${p.id}">${p.nombre}</option>`).join("") +
    `<option value="">Personalizado</option>`;
  aplicarPreset(presets[0]);
  $("nivel").value = datos.perfil.nivel;
  $("zurdo").checked = datos.perfil.guardia === "zurda";
  actualizarPausa();
  setTimeout(() => ($("info-voz").textContent = `Voz: ${voz.descripcion}`), 500);
}

function aplicarPreset(p) {
  $("asaltos").value = p.asaltos;
  $("duracion").value = p.duracion_asalto;
  $("descanso").value = p.descanso;
}

function actualizarPausa() {
  $("pausa").placeholder = `${pausaPorNivel[$("nivel").value]} (por nivel)`;
}

function leerConfig() {
  const pausa = $("pausa").value;
  return {
    asaltos: Number($("asaltos").value),
    duracion_asalto: Number($("duracion").value),
    descanso: Number($("descanso").value),
    nivel: Number($("nivel").value),
    zurdo: $("zurdo").checked,
    modo_reaccion: $("reaccion").checked,
    pausa: pausa === "" ? null : Number(pausa),
  };
}

// ---------- Reproducción ----------

async function empezar() {
  activarSonido(); // tiene que ser dentro del clic
  const r = await fetch("/api/sesion/guion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(leerConfig()),
  });
  if (!r.ok) {
    alert("Configuración no válida:\n" + (await r.text()));
    return;
  }
  const { config, eventos } = await r.json();
  estado = {
    config, eventos,
    siguiente: 0,              // índice del próximo evento a lanzar
    inicio: performance.now(), // reloj absoluto: no se desvía con el tiempo
    finFase: 0,
    dictadas: [],
    asaltosCompletados: 0,
    guardada: false,
    temporizador: setInterval(tic, 100),
  };
  pedirPantallaEncendida();
  document.body.classList.add("entrenando");
  $("boton").textContent = "Parar";
  $("boton").classList.add("parar");
  $("combo").textContent = "";
}

function tic() {
  const ahora = (performance.now() - estado.inicio) / 1000;
  while (estado.siguiente < estado.eventos.length && estado.eventos[estado.siguiente].t <= ahora) {
    lanzar(estado.eventos[estado.siguiente++]);
    if (!estado) return; // fin_sesion
  }
  const restante = Math.max(0, estado.finFase - ahora);
  $("tiempo").textContent = formatear(restante);
  $("tiempo").classList.toggle("final", $("fase").textContent === "Asalto" && restante <= 10);
}

function lanzar(e) {
  switch (e.tipo) {
    case "inicio_asalto":
      estado.finFase = e.t + estado.config.duracion_asalto;
      $("asalto").textContent = `Asalto ${e.asalto} / ${estado.config.asaltos}`;
      $("fase").textContent = "Asalto";
      $("pantalla").classList.remove("descanso");
      $("combo").textContent = "¡Boxea!";
      campana(1);
      setTimeout(() => voz.decir(e.texto), 1200); // que no pise la campana
      break;
    case "combo":
      $("combo").textContent = e.texto;
      voz.decir(e.texto);
      estado.dictadas.push({ asalto: e.asalto, texto: e.texto, ids: e.ids });
      break;
    case "reaccion":
      $("combo").textContent = e.texto;
      $("pantalla").classList.add("reaccion");
      setTimeout(() => $("pantalla").classList.remove("reaccion"), e.duracion * 1000);
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
      estado.finFase = e.t + e.duracion;
      $("fase").textContent = "Descanso";
      $("pantalla").classList.add("descanso");
      $("combo").textContent = "Descanso";
      setTimeout(() => voz.decir("Descanso"), 1500);
      break;
    case "fin_sesion":
      $("combo").textContent = e.texto;
      setTimeout(() => voz.decir(e.texto), 1500);
      terminar();
      break;
  }
}

async function terminar() {
  clearInterval(estado.temporizador);
  const sesion = estado;
  estado = null;
  document.body.classList.remove("entrenando");
  $("boton").textContent = "Empezar";
  $("boton").classList.remove("parar");
  $("fase").textContent = "Listo";
  $("pantalla").classList.remove("descanso", "reaccion");
  liberarPantalla();
  if (sesion.dictadas.length > 0) await guardar(sesion);
  cargarHistorial();
}

function parar() {
  voz.callar();
  $("combo").textContent = "Parado";
  terminar();
}

async function guardar(s) {
  await fetch("/api/sesiones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      asaltos: s.asaltosCompletados,
      nivel: s.config.nivel,
      zurdo: s.config.zurdo,
      duracion_asalto: s.config.duracion_asalto,
      descanso: s.config.descanso,
      combinaciones: s.dictadas,
    }),
  });
}

// ---------- Utilidades ----------

function formatear(segundos) {
  const s = Math.ceil(segundos);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

let bloqueoPantalla = null;
async function pedirPantallaEncendida() {
  try { bloqueoPantalla = await navigator.wakeLock?.request("screen"); } catch { /* no soportado */ }
}
function liberarPantalla() {
  bloqueoPantalla?.release();
  bloqueoPantalla = null;
}

async function cargarHistorial() {
  const sesiones = await (await fetch("/api/sesiones")).json();
  $("historial").innerHTML = sesiones.slice(0, 5).map((s) =>
    `<li>${s.fecha.replace("T", " ")} · nivel ${s.nivel} · ${s.asaltos} asaltos · ${s.num_combinaciones} combinaciones</li>`
  ).join("") || "<li>Aún no hay sesiones</li>";
}

// ---------- Eventos de la página ----------

$("boton").addEventListener("click", () => (estado ? parar() : empezar()));
$("preset").addEventListener("change", () => {
  const p = presets.find((x) => x.id === $("preset").value);
  if (p) aplicarPreset(p);
});
for (const id of ["asaltos", "duracion", "descanso"]) {
  $(id).addEventListener("input", () => ($("preset").value = ""));
}
$("nivel").addEventListener("change", actualizarPausa);

cargarConfig();
cargarHistorial();
