// Almacén de los datos del usuario en el navegador (localStorage): sesiones sin servidor,
// valoraciones, combinaciones propias (las del creador) y perfil (con lo elegido en Entrenar, la voz
// y «Practicar más» de Ajustes, cómo se agrupa el Historial, el nombre y el avatar o la foto, y las
// pistas ya vistas). Nunca va al repo ni a data/.
//
// Esquema versionado: si cambia, se sube VERSION y se añade una migración en MIGRACIONES.
// Si el almacenamiento falla, todo sigue funcionando en memoria y `persistente` pasa a false.

import { datos as datosMotor } from "./motor/datos.js";
import { MAX_ACCIONES, MAX_PROPIAS } from "./motor/reglas.js";
import { MEZCLAS, MIN_ACCIONES_PROPIA } from "./motor/sorteo.js";

export const VERSION = 9;
const CLAVE = "boxeo";
const CLAVE_V0 = "boxeo.historial"; // versión 0: un array de sesiones, antes del almacén

export const NO_SE = "no_se";

// Un UUID v4 para los ids locales. crypto.randomUUID solo existe en contextos seguros (https o
// localhost); abriendo la app por http desde otra máquina de la red local (el móvil contra el PC) no
// está, pero getRandomValues sí: con él se forma el mismo v4 (versión 4, variante 10xx).
export function crearUuid(c = globalThis.crypto) {
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Lo que se elige en Entrenar y se recuerda para la próxima sesión. `nivel` y `zurdo` en null:
// los de data/perfil.json (aún no se han elegido). `tipo`: la sesión elegida, una de TIPOS («Prueba»
// no se guarda nunca: solo existe con ?prueba en la URL, ver ajustes.js).
export const PERSONALIZADA_POR_DEFECTO = Object.freeze({ asaltos: 3, duracion_asalto: 180, descanso: 60 });
export const TIPOS = Object.freeze(["general", "personalizada"]);

// Lo fijo de la General, salvo los asaltos (los de «amateur» en data/presets.json) y el nivel (el de
// data/perfil.json). Voz, «Nombrar combinaciones» y guardia no van aquí: son de Ajustes.
export const FIJO_GENERAL = Object.freeze({ ritmo: 3, mezcla: "ninguna", reaccion: false });

export function sesionPorDefecto() {
  return {
    voz: "nombres", ritmo: 3, tipo: "general", nivel: null, zurdo: null, reaccion: false,
    mezcla: "ninguna", // «Tus combinaciones»: una de MEZCLAS de motor/sorteo.js
    personalizada: { ...PERSONALIZADA_POR_DEFECTO },
  };
}

// Nivel y zurdo de Entrenar a partir de la guardia y el nivel que tenía «Tus datos» hasta la v6
// (null si «No lo sé»). Solo lo usan las migraciones.
export function sesionDesdeBasicos(basicos) {
  const { nivel, guardia } = basicos ?? {};
  return {
    nivel: nivel == null || nivel === NO_SE ? null : Number(nivel),
    zurdo: guardia === "zurda" ? true : guardia === "ortodoxa" ? false : null,
  };
}

// Voz de los dictados, elegida en Ajustes. `id`: voiceURI de la voz del navegador (null = la
// automática); `velocidad`: una clave de VELOCIDADES de static/motor/ritmo.js.
export function vozPorDefecto() {
  return { id: null, velocidad: "normal" };
}

// Nivel con el que abre la galería del Historial: "semana", "mes" o "ano" (AGRUPACIONES de vistas/resumen.js).
export function historialPorDefecto() {
  return { agrupar: "semana" };
}

// Nombre y avatar de la cabecera. `avatar`: null (la inicial del nombre), { tipo: "predefinido", id }
// (uno de data/avatares.json) o { tipo: "foto", datos } (data URL JPEG o WebP, ver fotoValida).
export function identidadPorDefecto() {
  return { nombre: "", avatar: null };
}

// Pistas de la interfaz ya enseñadas (true) o por enseñar (false).
export function pistasPorDefecto() {
  return { asa: false };
}

export function perfilPorDefecto() {
  return {
    basicos: { inicio: null, altura_cm: null, peso_kg: null, alcance_cm: null },
    estilo: {
      mi_estilo: NO_SE, // el que elige el usuario: la app no clasifica
      distancia: NO_SE, presion: NO_SE, golpe_favorito: NO_SE, volumen: NO_SE,
      cardio: NO_SE, defensa: NO_SE, iniciativa: NO_SE,
    },
    practicar: [], // «Practicar más»: [{ movimiento }] (motor/sorteo.js)
    sesion: sesionPorDefecto(),
    voz: vozPorDefecto(),
    historial: historialPorDefecto(),
    identidad: identidadPorDefecto(),
    pistas: pistasPorDefecto(),
  };
}

export function vacio() {
  return {
    version: VERSION,
    sesiones: [],
    valoraciones: {},
    combinacionesPropias: [], // [{ id: "p-<uuid>", ids, creada }], en ortodoxo y en su orden
    perfil: perfilPorDefecto(),
  };
}

export class ErrorAlmacen extends Error {}

// Si lo elegido en Entrenar hasta la v8 es exactamente la General: Amateur 3×3 (o Prueba, que nunca se
// queda), el nivel de data/perfil.json, ritmo Constante, sin mezcla, sin Reacción y sin «Practicar más».
function eraGeneral(sesion, practicar, nivelGeneral) {
  return ["amateur", "prueba"].includes(sesion.asalto ?? "amateur")
    && (sesion.nivel == null || sesion.nivel === nivelGeneral())
    && (sesion.ritmo ?? FIJO_GENERAL.ritmo) === FIJO_GENERAL.ritmo
    && (sesion.mezcla ?? FIJO_GENERAL.mezcla) === FIJO_GENERAL.mezcla
    && (sesion.reaccion ?? FIJO_GENERAL.reaccion) === FIJO_GENERAL.reaccion
    && practicar.length === 0;
}

// Cada función pasa de la versión n a la n+1.
const MIGRACIONES = {
  // v0 → v1: las sesiones de "boxeo.historial" (ids correlativos) pasan al almacén con
  // ids aleatorios. En v0 no había valoraciones, así que cambiar el id no rompe nada.
  0: (v0, { crearId }) => ({
    ...vacio(),
    version: 1,
    sesiones: v0.sesiones.map((s) => ({ ...s, id: crearId() })),
  }),
  // v1 → v2: el perfil gana "Mi estilo" (perfil.estilo.mi_estilo), sin elegir.
  1: (v1) => ({
    ...v1,
    version: 2,
    perfil: { ...v1.perfil, estilo: { ...v1.perfil?.estilo, mi_estilo: NO_SE } },
  }),
  // v2 → v3: el perfil recuerda «Cómo te las digo» y el ritmo (perfil.sesion); hasta ahora
  // se decían siempre por su nombre.
  2: (v2) => ({
    ...v2,
    version: 3,
    perfil: { ...v2.perfil, sesion: { voz: "nombres", ritmo: 3 } },
  }),
  // v3 → v4: Entrenar recuerda también el asalto, el nivel, el zurdo, la reacción y la sesión
  // personalizada. Nivel y zurdo salen de «Tus datos» para que al actualizar no cambie nada.
  3: (v3) => ({
    ...v3,
    version: 4,
    perfil: {
      ...v3.perfil,
      sesion: { ...sesionPorDefecto(), ...v3.perfil?.sesion, ...sesionDesdeBasicos(v3.perfil?.basicos) },
    },
  }),
  // v4 → v5: el perfil recuerda la voz y su velocidad (Ajustes), con la automática y la velocidad
  // de siempre, y cómo se agrupa el Historial (por semana); los focos de trabajo desaparecen.
  4: (v4) => {
    const { focos, ...perfil } = v4.perfil ?? {};
    return { ...v4, version: 5, perfil: { ...perfil, voz: vozPorDefecto(), historial: historialPorDefecto() } };
  },
  // v5 → v6: los pesos de «Qué te dicta la app» desaparecen (el sorteo ya no los usa) y el perfil
  // gana «Practicar más», sin nada elegido.
  5: (v5) => {
    const { pesos, ...perfil } = v5.perfil ?? {};
    return { ...v5, version: 6, perfil: { ...perfil, practicar: [] } };
  },
  // v6 → v7: fuera lo que ya no se usa: las notas del entrenador y las revisiones, y la guardia y el
  // nivel de «Tus datos» (ya solo se eligen en Entrenar). Si Entrenar aún no los tenía elegidos, se
  // quedan los de «Tus datos» para que al actualizar no cambie nada.
  6: (v6) => {
    const { notas_entrenador, revisiones, ...resto } = v6;
    const { guardia, nivel, ...basicos } = v6.perfil?.basicos ?? {};
    const desde = sesionDesdeBasicos({ guardia, nivel });
    const sesion = { ...v6.perfil?.sesion };
    sesion.nivel ??= desde.nivel;
    sesion.zurdo ??= desde.zurdo;
    return { ...resto, version: 7, perfil: { ...v6.perfil, basicos, sesion } };
  },
  // v7 → v8: el creador de combinaciones. Sin propias, y Entrenar sin mezclarlas («Ninguna»).
  7: (v7) => ({
    ...v7,
    version: 8,
    combinacionesPropias: [],
    perfil: { ...v7.perfil, sesion: { ...v7.perfil?.sesion, mezcla: "ninguna" } },
  }),
  // v8 → v9: General | Personalizada. El asalto pasa a `tipo`: «Personalizado» → Personalizada; Amateur
  // o Prueba → General solo si todo lo demás es lo fijo de la General; si no, Personalizada 3×3, para
  // que al actualizar no cambie la sesión. «Practicar más» pierde el cuánto (ya hay un solo nivel) y el
  // perfil gana el nombre y el avatar, vacíos, y la pista del asa sin ver.
  8: (v8, { nivelGeneral }) => {
    const perfil = v8.perfil ?? {};
    const { asalto, ...sesion } = perfil.sesion ?? {};
    const practicar = Array.isArray(perfil.practicar) ? perfil.practicar.map(({ cuanto, ...p }) => p) : [];
    if (asalto === "personalizado") sesion.tipo = "personalizada";
    else if (eraGeneral({ ...sesion, asalto }, practicar, nivelGeneral)) sesion.tipo = "general";
    else Object.assign(sesion, { tipo: "personalizada", personalizada: { ...PERSONALIZADA_POR_DEFECTO } });
    return {
      ...v8,
      version: 9,
      perfil: { ...perfil, sesion, practicar, identidad: identidadPorDefecto(), pistas: pistasPorDefecto() },
    };
  },
};

// Foto propia del avatar: solo un data URL JPEG o WebP en base64, como mucho MAX_FOTO caracteres
// (una de 256 px ocupa unos 15-35 KB). Se pinta siempre con img.src, nunca con innerHTML.
export const MAX_FOTO = 200_000;
const FOTO = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export function fotoValida(datos) {
  return typeof datos === "string" && datos.length <= MAX_FOTO && FOTO.test(datos);
}
export const AVISO_FOTO = "La foto de tu avatar no era válida y se ha quitado.";

// El avatar guardado si está bien formado; si no, null (y `quitada`: true si era una foto mala).
function avatarValido(avatar) {
  if (avatar?.tipo === "predefinido" && typeof avatar.id === "string" && avatar.id) {
    return { avatar: { tipo: "predefinido", id: avatar.id }, quitada: false };
  }
  if (avatar?.tipo === "foto" && fotoValida(avatar.datos)) return { avatar: { tipo: "foto", datos: avatar.datos }, quitada: false };
  return { avatar: null, quitada: avatar?.tipo === "foto" };
}

// «Practicar más» bien formado: [{ movimiento }], sin repetir (lo que traiga de más se ignora).
function practicarValido(practicar) {
  if (!Array.isArray(practicar)) return [];
  const vistos = new Set();
  return practicar
    .filter((p) => typeof p?.movimiento === "string" && !vistos.has(p.movimiento) && vistos.add(p.movimiento))
    .map(({ movimiento }) => ({ movimiento }));
}

// Una combinación propia bien formada: id de texto e ids de 2 a 10 (los que el catálogo no conozca
// los ignora el sorteo). Como mucho se guardan MAX_PROPIAS.
function propiaValida(p) {
  return typeof p?.id === "string" && Array.isArray(p.ids)
    && p.ids.length >= MIN_ACCIONES_PROPIA && p.ids.length <= MAX_ACCIONES && p.ids.every((i) => typeof i === "string");
}

// Rellena lo que falte con los valores por defecto (datos escritos a mano o a medias) y quita lo mal
// formado. En `avisos` deja lo quitado que hay que decir al usuario (una foto mala).
function completar(datos, avisos = []) {
  const base = vacio();
  const perfil = datos.perfil ?? {};
  const sesion = { ...base.perfil.sesion, ...perfil.sesion };
  const identidad = { ...base.perfil.identidad, ...perfil.identidad };
  const { avatar, quitada } = avatarValido(identidad.avatar);
  if (quitada) avisos.push(AVISO_FOTO);
  return {
    ...base,
    ...datos,
    // Escritas a mano o de una copia rara: fuera las mal formadas, como mucho MAX_PROPIAS.
    combinacionesPropias: (Array.isArray(datos.combinacionesPropias) ? datos.combinacionesPropias : [])
      .filter(propiaValida).slice(0, MAX_PROPIAS),
    perfil: {
      ...base.perfil,
      ...perfil,
      basicos: { ...base.perfil.basicos, ...perfil.basicos },
      estilo: { ...base.perfil.estilo, ...perfil.estilo },
      sesion: {
        ...sesion,
        tipo: TIPOS.includes(sesion.tipo) ? sesion.tipo : base.perfil.sesion.tipo,
        mezcla: MEZCLAS.includes(sesion.mezcla) ? sesion.mezcla : base.perfil.sesion.mezcla,
        personalizada: { ...base.perfil.sesion.personalizada, ...perfil.sesion?.personalizada },
      },
      voz: { ...base.perfil.voz, ...perfil.voz },
      historial: { ...base.perfil.historial, ...perfil.historial },
      practicar: practicarValido(perfil.practicar),
      identidad: { nombre: typeof identidad.nombre === "string" ? identidad.nombre : "", avatar },
      pistas: { asa: perfil.pistas?.asa === true },
    },
  };
}

/**
 * Lleva unos datos de cualquier versión conocida a la actual.
 * Devuelve { datos, migrado, avisos }. Lanza ErrorAlmacen si la versión es de una app más nueva.
 * `nivelGeneral`: el nivel de la General (data/perfil.json); solo se pide al migrar una v8 con nivel.
 */
export function migrar(datos, { crearId = () => crearUuid(), nivelGeneral = () => datosMotor().perfil.nivel } = {}) {
  if (datos == null) return { datos: vacio(), migrado: false, avisos: [] };
  let version = datos.version;
  if (!Number.isInteger(version) || version < 0) throw new ErrorAlmacen("Datos sin versión válida");
  if (version > VERSION) {
    throw new ErrorAlmacen(`Los datos son de una versión más nueva de la app (v${version})`);
  }
  const migrado = version < VERSION;
  while (version < VERSION) {
    datos = MIGRACIONES[version](datos, { crearId, nivelGeneral });
    version = datos.version;
  }
  const avisos = [];
  return { datos: completar(datos, avisos), migrado, avisos };
}

export const claveSesion = (origen, id) => `${origen}:${id}`;

export function crearAlmacen({
  storage = globalThis.localStorage,
  crearId = () => crearUuid(),
  ahora = () => new Date().toISOString(),
  alFallar = () => {}, // la app muestra el aviso
  alAvisar = () => {}, // al leer se ha quitado algo (una foto mala): se dice, pero se sigue guardando
  nivelGeneral, // para migrar (ver migrar); por defecto, el de data/perfil.json
} = {}) {
  let datos = vacio();
  let persistente = true;
  let aviso = null; // texto para el usuario si algo falla
  let avisos = []; // lo quitado al leer o al importar la última vez
  const opciones = nivelGeneral ? { crearId, nivelGeneral } : { crearId };

  function fallo(texto) {
    persistente = false;
    aviso = texto;
    alFallar(texto);
  }

  function guardar() {
    if (!persistente) return false;
    try {
      storage.setItem(CLAVE, JSON.stringify(datos));
      return true;
    } catch {
      fallo("No se puede guardar en este navegador: exporta tus datos para no perderlos.");
      return false;
    }
  }

  // Carga inicial: lee la versión actual o, si no hay, la v0.
  try {
    const crudo = storage.getItem(CLAVE);
    const crudoV0 = crudo === null ? storage.getItem(CLAVE_V0) : null;
    let leidos = null;
    if (crudo !== null) leidos = JSON.parse(crudo);
    else if (crudoV0 !== null) leidos = { version: 0, sesiones: JSON.parse(crudoV0) ?? [] };
    const resultado = migrar(leidos, opciones);
    datos = resultado.datos;
    avisos = resultado.avisos;
    if (resultado.migrado && guardar() && crudoV0 !== null) storage.removeItem(CLAVE_V0);
    for (const texto of avisos) alAvisar(texto);
  } catch (e) {
    // Datos dañados o de una versión más nueva: no se sobrescriben.
    datos = vacio();
    fallo(e instanceof ErrorAlmacen
      ? `${e.message}. No se guardará nada para no estropearlos.`
      : "No se pueden leer los datos guardados. No se guardará nada para no estropearlos.");
  }

  return {
    get persistente() { return persistente; },
    get aviso() { return aviso; },
    get datos() { return datos; },
    get avisos() { return avisos; },

    // ---- Sesiones locales (sin servidor) ----
    anadirSesion(sesion) {
      const id = crearId();
      datos.sesiones.unshift({ ...sesion, id, fecha: sesion.fecha ?? ahora() });
      guardar();
      return id;
    },
    borrarSesion(id) {
      datos.sesiones = datos.sesiones.filter((s) => s.id !== id);
      delete datos.valoraciones[claveSesion("local", id)];
      guardar();
    },

    // ---- Valoraciones (clave: "local:<id>" o "servidor:<id>") ----
    valoracion: (clave) => datos.valoraciones[clave] ?? null,
    guardarValoracion(clave, valoracion) {
      datos.valoraciones[clave] = { ...valoracion, actualizada: ahora() };
      guardar();
    },
    borrarValoracion(clave) {
      delete datos.valoraciones[clave];
      guardar();
    },

    // ---- Combinaciones propias (las del creador, en ortodoxo) ----
    // Comprueba antes avisosCreador (motor/reglas.js): aquí solo se rechaza lo mal formado (null).
    anadirPropia(ids) {
      const propia = { id: `p-${crearId()}`, ids: [...ids], creada: ahora() };
      if (!propiaValida(propia) || datos.combinacionesPropias.length >= MAX_PROPIAS) return null;
      datos.combinacionesPropias.push(propia);
      guardar();
      return propia.id;
    },
    cambiarPropia(id, ids) {
      const propia = datos.combinacionesPropias.find((p) => p.id === id);
      if (!propia || !propiaValida({ id, ids })) return false;
      propia.ids = [...ids];
      guardar();
      return true;
    },
    borrarPropia(id) {
      datos.combinacionesPropias = datos.combinacionesPropias.filter((p) => p.id !== id);
      guardar();
    },

    // ---- Perfil ----
    guardarPerfil(perfil) {
      datos.perfil = completar({ perfil }).perfil;
      guardar();
    },

    // ---- Copia de seguridad ----
    // `servidor`: copia de las sesiones de SQLite, solo como referencia (no se importa).
    exportar(servidor = null) {
      const copia = { app: "boxeo", version: VERSION, exportado: ahora(), datos: structuredClone(datos) };
      if (servidor) copia.servidor = servidor;
      return copia;
    },
    // Sustituye todos los datos. Lanza ErrorAlmacen si el fichero no es válido. Lo que se haya quitado
    // de la copia (una foto mala) queda en `avisos`, para decírselo al usuario.
    importar(copia) {
      if (copia?.app !== "boxeo" || typeof copia.datos !== "object" || copia.datos === null) {
        throw new ErrorAlmacen("El fichero no es una copia de seguridad de Boxeo");
      }
      ({ datos, avisos } = migrar(structuredClone(copia.datos), opciones));
      return guardar();
    },
  };
}
