// Almacén de los datos del usuario en el navegador (localStorage): sesiones sin servidor,
// valoraciones, perfil, notas del entrenador y revisiones. Nunca va al repo ni a data/.
//
// Esquema versionado: si cambia, se sube VERSION y se añade una migración en MIGRACIONES.
// Si el almacenamiento falla, todo sigue funcionando en memoria y `persistente` pasa a false.

export const VERSION = 1;
const CLAVE = "boxeo";
const CLAVE_V0 = "boxeo.historial"; // versión 0: un array de sesiones, antes del almacén

export const NO_SE = "no_se";

export function perfilPorDefecto() {
  return {
    basicos: { guardia: NO_SE, nivel: NO_SE, inicio: null, altura_cm: null, peso_kg: null, alcance_cm: null },
    estilo: {
      distancia: NO_SE, presion: NO_SE, golpe_favorito: NO_SE, volumen: NO_SE,
      cardio: NO_SE, defensa: NO_SE, iniciativa: NO_SE,
    },
    focos: [],
    pesos: null, // null = los de data/perfil.json
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
} = {}) {
  let datos = vacio();
  let persistente = true;
  let aviso = null; // texto para el usuario si algo falla

  function fallo(texto) {
    persistente = false;
    aviso = texto;
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
