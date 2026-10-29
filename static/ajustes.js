// Une los datos del usuario (almacén) con el motor: qué perfil usa el generador y
// qué se propone al entrenar (lo último elegido). Sin reglas de boxeo.
import { NO_SE, PERSONALIZADA_POR_DEFECTO, sesionDesdeBasicos } from "./almacen.js";
import { datos } from "./motor/datos.js";
import { VELOCIDADES, VELOCIDAD_POR_DEFECTO } from "./motor/ritmo.js";
import { SorteoBiblioteca } from "./motor/sorteo.js";
import { construirGuion, validarConfig } from "./motor/temporizador.js";

export const PERSONALIZADO = "personalizado"; // el asalto que no es un preset de data/presets.json

export const NOMBRE_NIVEL = { 1: "Básico", 2: "Medio", 3: "Avanzado" };
export const NOMBRE_RITMO = { 1: "Calmado", 2: "Tranquilo", 3: "Constante", 4: "Vivo", 5: "Intenso" };
export const NOMBRE_VOZ = { numeros: "Números", nombres: "Nombres", ambos: "Ambos" };

// Lo elegido en una línea para «Tu sesión»: «Medio · Vivo · Números · Reacción». Zurdo y
// Reacción solo si están activados.
export function resumenElecciones({ nivel, ritmo, voz, zurdo, modo_reaccion }) {
  return [NOMBRE_NIVEL[nivel], NOMBRE_RITMO[ritmo], NOMBRE_VOZ[voz], zurdo && "Zurdo", modo_reaccion && "Reacción"]
    .filter(Boolean).join(" · ");
}

export const NOMBRE_VELOCIDAD = { lenta: "Lenta", normal: "Normal", rapida: "Rápida" };

// Voz y velocidad (número, para la voz y el motor) elegidas en Ajustes. Una velocidad que no se
// conoce vale la de por defecto.
export function opcionesVoz(perfilUsuario) {
  const { id = null, velocidad } = perfilUsuario?.voz ?? {};
  return { id, velocidad: VELOCIDADES[velocidad] ?? VELOCIDADES[VELOCIDAD_POR_DEFECTO] };
}

export const PESOS = ["termina_en_gancho", "bloquear_y_devolver", "entrada_con_jab"];

// Perfil para el generador: los pesos editados SUSTITUYEN a los de data/perfil.json.
export function perfilGenerador(perfilUsuario) {
  const base = datos().perfil;
  return perfilUsuario?.pesos ? { ...base, pesos: { ...perfilUsuario.pesos } } : base;
}

export function nuevoGuion(config, perfilUsuario, azar) {
  const generador = new SorteoBiblioteca(config.nivel,
    { perfil: perfilGenerador(perfilUsuario), zurdo: config.zurdo, azar });
  return construirGuion(config, azar, generador);
}

// Lo que se propone al entrenar: lo último que se eligió en Entrenar. Nivel y guardia, si no se
// han elegido nunca, son los del perfil (o los de data/perfil.json si "No lo sé").
export function preferencias(perfilUsuario) {
  const base = datos().perfil;
  const { guardia, nivel } = perfilUsuario.basicos;
  const s = perfilUsuario.sesion;
  const asaltos = [...datos().presets.presets.map((p) => p.id), PERSONALIZADO];
  return {
    asalto: asaltos.includes(s.asalto) ? s.asalto : asaltos[0],
    nivel: s.nivel ?? (nivel === NO_SE ? base.nivel : Number(nivel)),
    zurdo: s.zurdo ?? (guardia === NO_SE ? base.guardia : guardia) === "zurda",
    voz: s.voz,
    ritmo: s.ritmo,
    reaccion: s.reaccion === true,
    personalizada: { ...(personalizadaValida(s.personalizada) ? s.personalizada : PERSONALIZADA_POR_DEFECTO) },
  };
}

// Asaltos, duración y descanso dentro de los límites del motor (lo demás no cuenta aquí).
export function personalizadaValida(p) {
  if (!p) return false;
  const { asaltos, duracion_asalto, descanso } = p;
  return !validarConfig({ asaltos, duracion_asalto, descanso, nivel: 1, ritmo: 3, pausa: null, voz: "nombres" })
    .length;
}

// Guarda en el perfil lo elegido en Entrenar: solo los campos que llegan, sin tocar «Tus datos».
export function recordarSesion(almacen, cambios) {
  const perfil = almacen.datos.perfil;
  almacen.guardarPerfil({ ...perfil, sesion: { ...perfil.sesion, ...cambios } });
}

// Gana lo último que se toque: cambiar Guardia o Nivel en «Tus datos» pone igual lo de Entrenar.
// Cambia el perfil que recibe (la copia que la pestaña Perfil va a guardar).
export function seguirBasicos(perfilUsuario, campo) {
  const clave = { guardia: "zurdo", nivel: "nivel" }[campo];
  if (!clave) return;
  perfilUsuario.sesion = { ...perfilUsuario.sesion, [clave]: sesionDesdeBasicos(perfilUsuario.basicos)[clave] };
}
