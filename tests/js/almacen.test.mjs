import assert from "node:assert/strict";
import { test } from "node:test";

import { VERSION, claveSesion, crearAlmacen, migrar, vacio } from "../../static/almacen.js";

// localStorage falso. `roto: true` simula un navegador que no deja guardar.
function almacenamiento(inicial = {}, { roto = false } = {}) {
  const mapa = new Map(Object.entries(inicial));
  return {
    mapa,
    getItem(k) { if (roto) throw new Error("bloqueado"); return mapa.has(k) ? mapa.get(k) : null; },
    setItem(k, v) { if (roto) throw new Error("bloqueado"); mapa.set(k, String(v)); },
    removeItem(k) { mapa.delete(k); },
  };
}

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

const SESION_V0 = {
  id: 1, fecha: "2026-10-26T10:02:13", asaltos: 2, nivel: 1, zurdo: false,
  duracion_asalto: 30, descanso: 10, num_combinaciones: 1,
  combinaciones: [{ asalto: 1, texto: "jab, directo", ids: ["jab", "directo"] }],
};

test("sin datos guardados empieza vacío y en la versión actual", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  assert.deepEqual(almacen.datos, vacio());
  assert.equal(almacen.persistente, true);
});

test("migra la v0 (boxeo.historial) a v1 conservando las sesiones", () => {
  const storage = almacenamiento({ "boxeo.historial": JSON.stringify([SESION_V0, { ...SESION_V0, id: 2 }]) });
  const almacen = crearAlmacen({ storage, crearId: ids() });
  assert.equal(almacen.datos.version, VERSION);
  assert.deepEqual(almacen.datos.sesiones, [{ ...SESION_V0, id: "id-1" }, { ...SESION_V0, id: "id-2" }]);
  assert.deepEqual(almacen.datos.valoraciones, {});
  // Se guarda en la clave nueva y solo entonces se borra la vieja.
  assert.equal(JSON.parse(storage.mapa.get("boxeo")).version, VERSION);
  assert.equal(storage.mapa.has("boxeo.historial"), false);
});

test("migrar dos veces no cambia nada", () => {
  const primera = migrar({ version: 0, sesiones: [SESION_V0] }, { crearId: ids() }).datos;
  const segunda = migrar(structuredClone(primera));
  assert.equal(segunda.migrado, false);
  assert.deepEqual(segunda.datos, primera);
});

test("completa campos que falten en datos v1 a medias", () => {
  const { datos } = migrar({ version: 1, perfil: { estilo: { cardio: "bueno" } } });
  assert.equal(datos.perfil.estilo.cardio, "bueno");
  assert.equal(datos.perfil.estilo.distancia, "no_se");
  assert.deepEqual(datos.sesiones, []);
});

test("datos de una versión más nueva no se tocan ni se sobrescriben", () => {
  const crudo = JSON.stringify({ version: VERSION + 1, sesiones: [] });
  const storage = almacenamiento({ boxeo: crudo });
  const almacen = crearAlmacen({ storage });
  assert.equal(almacen.persistente, false);
  assert.match(almacen.aviso, /versión más nueva/);
  almacen.anadirSesion({ asaltos: 1 });
  assert.equal(storage.mapa.get("boxeo"), crudo);
});

test("datos dañados no se sobrescriben", () => {
  const storage = almacenamiento({ boxeo: "{roto" });
  const almacen = crearAlmacen({ storage });
  assert.equal(almacen.persistente, false);
  almacen.guardarPerfil({ focos: ["x"] });
  assert.equal(storage.mapa.get("boxeo"), "{roto");
});

test("si el almacenamiento falla, sigue funcionando en memoria y avisa", () => {
  const almacen = crearAlmacen({ storage: almacenamiento({}, { roto: true }) });
  const id = almacen.anadirSesion({ asaltos: 3, combinaciones: [] });
  assert.equal(almacen.datos.sesiones[0].id, id);
  assert.equal(almacen.persistente, false);
  assert.ok(almacen.aviso);
});

test("las sesiones locales usan ids aleatorios (UUID), no correlativos", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  const a = almacen.anadirSesion({ asaltos: 1, combinaciones: [] });
  const b = almacen.anadirSesion({ asaltos: 1, combinaciones: [] });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(a, uuid);
  assert.match(b, uuid);
  assert.notEqual(a, b);
});

test("borrar una sesión e importar no mezclan valoraciones", () => {
  // Con ids correlativos, borrar la última y crear otra reutilizaría su id y su valoración.
  const almacen = crearAlmacen({ storage: almacenamiento() });
  const vieja = almacen.anadirSesion({ asaltos: 1, combinaciones: [] });
  almacen.guardarValoracion(claveSesion("local", vieja), { rpe: 9 });
  almacen.borrarSesion(vieja);
  assert.equal(almacen.valoracion(claveSesion("local", vieja)), null);
  const nueva = almacen.anadirSesion({ asaltos: 1, combinaciones: [] });
  assert.notEqual(nueva, vieja);
  assert.equal(almacen.valoracion(claveSesion("local", nueva)), null);

  // Importar otra copia y volver a añadir no choca con los ids importados.
  const otra = crearAlmacen({ storage: almacenamiento() });
  const importada = otra.anadirSesion({ asaltos: 2, combinaciones: [] });
  otra.guardarValoracion(claveSesion("local", importada), { rpe: 4 });
  almacen.importar(JSON.parse(JSON.stringify(otra.exportar())));
  const tras = almacen.anadirSesion({ asaltos: 1, combinaciones: [] });
  assert.notEqual(tras, importada);
  assert.equal(almacen.valoracion(claveSesion("local", tras)), null);
  assert.equal(almacen.valoracion(claveSesion("local", importada)).rpe, 4);
});

test("exportar e importar dan exactamente los mismos datos", () => {
  const origen = crearAlmacen({ storage: almacenamiento() });
  const id = origen.anadirSesion({
    asaltos: 3, nivel: 2, zurdo: true, duracion_asalto: 180, descanso: 60, pausa: null, modo_reaccion: true,
    combinaciones: [{ asalto: 1, texto: "jab, directo", ids: ["jab", "directo"] }],
  });
  origen.guardarValoracion(claveSesion("local", id), { rpe: 7, sensacion: 4, bien: "ritmo", corregir: "guardia", costosas: [0] });
  origen.guardarValoracion(claveSesion("servidor", 12), { rpe: 5, sensacion: 3, bien: "", corregir: "", costosas: [] });
  origen.guardarPerfil({ ...origen.datos.perfil, focos: ["acabar en gancho"], pesos: { termina_en_gancho: 3, bloquear_y_devolver: 1, entrada_con_jab: 1.5 } });
  origen.anadirNotaEntrenador("Baja la barbilla", "2026-10-20");
  origen.guardarRevision("parada", { respuesta: "Tras parar, jab", confirmado: true });

  // Ida y vuelta por un fichero JSON, como en la app.
  const fichero = JSON.stringify(origen.exportar());
  const storage = almacenamiento();
  const destino = crearAlmacen({ storage });
  assert.equal(destino.importar(JSON.parse(fichero)), true);
  assert.deepEqual(destino.datos, origen.datos);
  assert.deepEqual(crearAlmacen({ storage }).datos, origen.datos); // y persiste
});

test("la copia con servidor lleva las sesiones de SQLite solo como referencia", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  const copia = almacen.exportar([{ id: 1, fecha: "2026-10-26T10:00:00" }]);
  assert.equal(copia.servidor.length, 1);
  const destino = crearAlmacen({ storage: almacenamiento() });
  destino.importar(copia);
  assert.deepEqual(destino.datos.sesiones, []);
});

test("importar rechaza ficheros que no son copias de Boxeo", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  assert.throws(() => almacen.importar({ hola: 1 }), /no es una copia/);
  assert.throws(() => almacen.importar({ app: "boxeo", datos: { version: 99 } }), /más nueva/);
});
