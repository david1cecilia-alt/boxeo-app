// Almacén de los datos del usuario en el navegador (localStorage): sesiones sin servidor,
// valoraciones, perfil (con la voz elegida en Ajustes y cómo se agrupa el Historial), notas del
// entrenador y revisiones. Nunca va al repo ni a data/.
//
// Esquema versionado: si cambia, se sube VERSION y se añade una migración en MIGRACIONES.
// Si el almacenamiento falla, todo sigue funcionando en memoria y `persistente` pasa a false.

export const VERSION = 5;
const CLAVE = "boxeo";
const CLAVE_V0 = "boxeo.historial"; // versión 0: un array de sesiones, antes del almacén

export const NO_SE = "no_se";

// Lo que se elige en Entrenar y se recuerda para la próxima sesión. `nivel` y `zurdo` en null:
// los de «Tus datos» del perfil (o los de data/perfil.json si «No lo sé»).
export const PERSONALIZADA_POR_DEFECTO = Object.freeze({ asaltos: 3, duracion_asalto: 180, descanso: 60 });

export function sesionPorDefecto() {
  return {
    voz: "nombres", ritmo: 3, asalto: "amateur", nivel: null, zurdo: null, reaccion: false,
    personalizada: { ...PERSONALIZADA_POR_DEFECTO },
  };
}

// Nivel y zurdo de Entrenar a partir de «Tus datos» del perfil (null si «No lo sé»).
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

// Cómo se agrupa la lista del Historial: "semana", "mes" o "ano" (AGRUPACIONES de vistas/resumen.js).
export function historialPorDefecto() {
  return { agrupar: "semana" };
}

export function perfilPorDefecto() {
  return {
    basicos: { guardia: NO_SE, nivel: NO_SE, inicio: null, altura_cm: null, peso_kg: null, alcance_cm: null },
    estilo: {
      mi_estilo: NO_SE, // el que elige el usuario: la app no clasifica
      distancia: NO_SE, presion: NO_SE, golpe_favorito: NO_SE, volumen: NO_SE,
      cardio: NO_SE, defensa: NO_SE, iniciativa: NO_SE,
    },
    pesos: null, // null = los de data/perfil.json
    sesion: sesionPorDefecto(),
    voz: vozPorDefecto(),
    historial: historialPorDefecto(),
  };
}

export function vacio() {
  return {
    version: VERSION,
    sesiones: [],
    valoraciones: {},
    perfil: perfilPorDefecto(),
    notas_entrenador: [],
    revisiones: {},
  };
}

export class ErrorAlmacen extends Error {}

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
};

// Rellena lo que falte con los valores por defecto (datos escritos a mano o a medias).
function completar(datos) {
  const base = vacio();
  const perfil = datos.perfil ?? {};
  return {
    ...base,
    ...datos,
    perfil: {
      ...base.perfil,
      ...perfil,
      basicos: { ...base.perfil.basicos, ...perfil.basicos },
      estilo: { ...base.perfil.estilo, ...perfil.estilo },
      sesion: {
        ...base.perfil.sesion,
        ...perfil.sesion,
        personalizada: { ...base.perfil.sesion.personalizada, ...perfil.sesion?.personalizada },
      },
      voz: { ...base.perfil.voz, ...perfil.voz },
      historial: { ...base.perfil.historial, ...perfil.historial },
    },
  };
}

/**
 * Lleva unos datos de cualquier versión conocida a la actual.
 * Devuelve { datos, migrado }. Lanza ErrorAlmacen si la versión es de una app más nueva.
 */
export function migrar(datos, { crearId = () => crypto.randomUUID() } = {}) {
  if (datos == null) return { datos: vacio(), migrado: false };
  let version = datos.version;
  if (!Number.isInteger(version) || version < 0) throw new ErrorAlmacen("Datos sin versión válida");
  if (version > VERSION) {
    throw new ErrorAlmacen(`Los datos son de una versión más nueva de la app (v${version})`);
  }
  const migrado = version < VERSION;
  while (version < VERSION) {
    datos = MIGRACIONES[version](datos, { crearId });
    version = datos.version;
  }
  return { datos: completar(datos), migrado };
}

export const claveSesion = (origen, id) => `${origen}:${id}`;

export function crearAlmacen({
  storage = globalThis.localStorage,
  crearId = () => crypto.randomUUID(),
  ahora = () => new Date().toISOString(),
  alFallar = () => {}, // la app muestra el aviso
} = {}) {
  let datos = vacio();
  let persistente = true;
  let aviso = null; // texto para el usuario si algo falla

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
    const resultado = migrar(leidos, { crearId });
    datos = resultado.datos;
    if (resultado.migrado && guardar() && crudoV0 !== null) storage.removeItem(CLAVE_V0);
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

    // ---- Perfil, notas del entrenador y revisiones ----
    guardarPerfil(perfil) {
      datos.perfil = completar({ perfil }).perfil;
      guardar();
    },
    anadirNotaEntrenador(texto, fecha = ahora().slice(0, 10)) {
      datos.notas_entrenador.unshift({ id: crearId(), fecha, texto });
      guardar();
    },
    borrarNotaEntrenador(id) {
      datos.notas_entrenador = datos.notas_entrenador.filter((n) => n.id !== id);
      guardar();
    },
    guardarRevision(id, revision) {
      datos.revisiones[id] = { ...revision, fecha: ahora().slice(0, 10) };
      guardar();
    },

    // ---- Copia de seguridad ----
    // `servidor`: copia de las sesiones de SQLite, solo como referencia (no se importa).
    exportar(servidor = null) {
      const copia = { app: "boxeo", version: VERSION, exportado: ahora(), datos: structuredClone(datos) };
      if (servidor) copia.servidor = servidor;
      return copia;
    },
    // Sustituye todos los datos. Lanza ErrorAlmacen si el fichero no es válido.
    importar(copia) {
      if (copia?.app !== "boxeo" || typeof copia.datos !== "object" || copia.datos === null) {
        throw new ErrorAlmacen("El fichero no es una copia de seguridad de Boxeo");
      }
      datos = migrar(structuredClone(copia.datos), { crearId }).datos;
      return guardar();
    },
  };
}
