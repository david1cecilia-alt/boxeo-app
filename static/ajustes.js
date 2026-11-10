// Une los datos del usuario (almacén) con el motor: qué perfil usa el sorteo y
// qué se propone al entrenar (lo último elegido). Sin reglas de boxeo.
import { PERSONALIZADA_POR_DEFECTO, TIPOS } from "./almacen.js";
import { datos } from "./motor/datos.js";
import { VELOCIDADES, VELOCIDAD_POR_DEFECTO } from "./motor/ritmo.js";
import {
  MEZCLAS, MIN_SOLO_PROPIAS, PROBABILIDAD_PROPIAS, SorteoMezcla, coletillasRepetibles, esCorta, mezclaEfectiva,
  propiasValidas,
} from "./motor/sorteo.js";
import { construirGuion, validarConfig } from "./motor/temporizador.js";

export const NOMBRE_NIVEL = { 1: "Básico", 2: "Medio", 3: "Avanzado" };
export const NOMBRE_RITMO = { 1: "Calmado", 2: "Tranquilo", 3: "Constante", 4: "Vivo", 5: "Intenso" };
export const NOMBRE_VOZ = { numeros: "Números", nombres: "Nombres", ambos: "Ambos" };

// Lo elegido en una línea para «Tu sesión»: «Medio · Vivo · Números · Reacción». Zurdo y
// Reacción solo si están activados. `mezcla`, la efectiva (estadoMezcla): con «Solo las mías» el
// nivel no cuenta y no se dice; con «Ninguna», nada.
export function resumenElecciones({ nivel, ritmo, voz, zurdo, modo_reaccion, mezcla = "ninguna" }) {
  const nivelOMezcla = mezcla === "solo" ? [RESUMEN_MEZCLA.solo] : [NOMBRE_NIVEL[nivel], RESUMEN_MEZCLA[mezcla]];
  return [...nivelOMezcla, NOMBRE_RITMO[ritmo], NOMBRE_VOZ[voz], zurdo && "Zurdo", modo_reaccion && "Reacción"]
    .filter(Boolean).join(" · ");
}

// «Tus combinaciones» en Entrenar: cada opción con el porcentaje de propias que sale (de
// PROBABILIDAD_PROPIAS; «Solo las mías», todas).
export const NOMBRE_MEZCLA = { ninguna: "Ninguna", poco: "Poco", bastante: "Bastante", mucho: "Mucho", solo: "Solo las mías" };
const RESUMEN_MEZCLA = { poco: "Poco de las tuyas", bastante: "Bastante de las tuyas", mucho: "Mucho de las tuyas", solo: "Solo las tuyas" };
export const OPCIONES_MEZCLA = MEZCLAS.map((id) => ({
  id, nombre: NOMBRE_MEZCLA[id],
  porcentaje: id === "solo" ? 100 : Math.round(100 * (PROBABILIDAD_PROPIAS[id] ?? 0)),
}));

// Qué enseña Entrenar de «Tus combinaciones» con lo elegido (`mezcla`, la guardada), las propias del
// almacén y el nivel: cuántas se pueden sortear, la mezcla con la que se sorteará de verdad, si
// «Solo las mías» se puede elegir (y por qué no), si el nivel cuenta y el aviso que toque. Sin
// propias, el selector se desactiva (Entrenar pone el enlace al creador).
export function estadoMezcla(mezcla, propias, nivel) {
  const validas = propiasValidas(propias);
  const total = validas.length;
  const efectiva = mezclaEfectiva(mezcla, validas, nivel);
  const motivoSolo = total > 0 && total < MIN_SOLO_PROPIAS
    ? `«Solo las mías» necesita al menos ${MIN_SOLO_PROPIAS} combinaciones (tienes ${total})`
      + (mezcla === "solo" ? ": de momento salen las de la biblioteca." : ".")
    : null;
  let aviso = null;
  if (efectiva === "solo" && !validas.some(esCorta)) {
    aviso = "Añade alguna de 2-3 acciones para que el final del asalto sea solo tuyo.";
  } else if (total > 0 && Object.hasOwn(PROBABILIDAD_PROPIAS, mezcla) && efectiva === "ninguna") {
    aviso = `No tienes combinaciones de nivel ${NOMBRE_NIVEL[nivel].toLowerCase()}: solo saldrán las de la biblioteca.`;
  }
  return { total, efectiva, motivoSolo, aviso, nivelCuenta: efectiva !== "solo" };
}

export const NOMBRE_VELOCIDAD = { lenta: "Lenta", normal: "Normal", rapida: "Rápida" };

// Voz y velocidad (número, para la voz y el motor) elegidas en Ajustes. Una velocidad que no se
// conoce vale la de por defecto.
export function opcionesVoz(perfilUsuario) {
  const { id = null, velocidad } = perfilUsuario?.voz ?? {};
  return { id, velocidad: VELOCIDADES[velocidad] ?? VELOCIDADES[VELOCIDAD_POR_DEFECTO] };
}

// «Practicar más»: cuántos movimientos se pueden elegir a la vez. Con más, todo pesaría casi igual.
export const MAX_PRACTICAR = 3;

// Perfil para el sorteo: el de data/perfil.json con lo elegido en «Practicar más».
export function perfilSorteo(perfilUsuario) {
  const base = datos().perfil;
  const practicar = perfilUsuario?.practicar ?? [];
  return practicar.length ? { ...base, practicar: practicar.map((p) => ({ ...p })) } : base;
}

// Elige (`elegir` true) o quita (false) un movimiento de «Practicar más», con un solo nivel. Devuelve
// la lista nueva; uno nuevo no entra si ya hay MAX_PRACTICAR, y elegir uno ya elegido no cambia nada.
export function cambiarPracticar(practicar, movimiento, elegir) {
  if (!elegir) return practicar.filter((p) => p.movimiento !== movimiento);
  if (practicar.some((p) => p.movimiento === movimiento) || practicar.length >= MAX_PRACTICAR) return practicar;
  return [...practicar, { movimiento }];
}

// El guion de la sesión: la biblioteca del nivel con «Practicar más» y, según `config.mezcla` («Tus
// combinaciones»), las propias del almacén (`propias`, en ortodoxo; el zurdo, como la biblioteca).
// Con «Ninguna», o una mezcla que no se puede cumplir, sale lo mismo que sin propias.
export function nuevoGuion(config, perfilUsuario, azar, propias = []) {
  const sorteo = new SorteoMezcla(config.nivel, {
    perfil: perfilSorteo(perfilUsuario), zurdo: config.zurdo, azar, propias, mezcla: config.mezcla ?? "ninguna",
  });
  return construirGuion(config, azar, sorteo);
}

// Si el dictado puede repetir una coletilla reciente: lo mismo que decide el sorteo de nuevoGuion.
export function repetirColetillas(config, propias = []) {
  const validas = propiasValidas(propias);
  return coletillasRepetibles(mezclaEfectiva(config.mezcla ?? "ninguna", validas, config.nivel), validas);
}

// Lo que se propone al entrenar: lo último que se eligió en Entrenar. `tipo`: "general" o
// "personalizada" (uno desconocido, la General). Nivel y guardia, si no se han elegido nunca, son los
// de data/perfil.json.
export function preferencias(perfilUsuario) {
  const base = datos().perfil;
  const s = perfilUsuario.sesion;
  return {
    tipo: TIPOS.includes(s.tipo) ? s.tipo : TIPOS[0],
    nivel: s.nivel ?? base.nivel,
    zurdo: s.zurdo ?? base.guardia === "zurda",
    voz: s.voz,
    ritmo: s.ritmo,
    reaccion: s.reaccion === true,
    mezcla: MEZCLAS.includes(s.mezcla) ? s.mezcla : "ninguna",
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

// Guarda en el perfil lo elegido en Entrenar: solo los campos que llegan.
export function recordarSesion(almacen, cambios) {
  const perfil = almacen.datos.perfil;
  almacen.guardarPerfil({ ...perfil, sesion: { ...perfil.sesion, ...cambios } });
}
