import assert from "node:assert/strict";
import { test } from "node:test";

import { VERSION, claveSesion, crearAlmacen, migrar, sesionPorDefecto, vacio } from "../../static/almacen.js";

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

test("v2 → v3: el perfil gana voz «nombres» y ritmo 3, y conserva lo demás", () => {
  const v2 = { ...vacio(), version: 2, sesiones: [{ id: "a" }],
    perfil: { ...vacio().perfil, focos: ["jab"], estilo: { ...vacio().perfil.estilo, mi_estilo: "boxer" } } };
  delete v2.perfil.sesion;
  const { datos, migrado } = migrar(v2);
  assert.equal(migrado, true);
  assert.equal(datos.version, VERSION);
  assert.equal(datos.perfil.sesion.voz, "nombres");
  assert.equal(datos.perfil.sesion.ritmo, 3);
  assert.equal(datos.perfil.estilo.mi_estilo, "boxer");
  assert.deepEqual(datos.perfil.focos, ["jab"]);
  assert.deepEqual(datos.sesiones, [{ id: "a" }]);
});

test("v1 llega a la versión actual pasando por todas las migraciones", () => {
  const { datos } = migrar({ version: 1, sesiones: [], perfil: { estilo: { cardio: "bueno" } } });
  assert.equal(datos.version, VERSION);
  assert.equal(datos.perfil.estilo.mi_estilo, "no_se");
  assert.deepEqual(datos.perfil.sesion, sesionPorDefecto());
});

// Almacén v3 completo, como lo tiene hoy quien ya usa la app.
function almacenV3() {
  const perfil = vacio().perfil;
  return {
    version: 3,
    sesiones: [{ ...SESION_V0, id: "s-1", ritmo: 4, voz: "numeros" }],
    valoraciones: { "local:s-1": { rpe: 7, sensacion: 4, bien: "ritmo", corregir: "", costosas: [0], actualizada: "2026-10-26" } },
    perfil: {
      basicos: { ...perfil.basicos, guardia: "zurda", nivel: "2", altura_cm: 178 },
      estilo: { ...perfil.estilo, mi_estilo: "boxer", cardio: "bueno" },
      focos: ["jab doble"],
      pesos: { termina_en_gancho: 3, bloquear_y_devolver: 1, entrada_con_jab: 1.5 },
      sesion: { voz: "ambos", ritmo: 5 },
    },
    notas_entrenador: [{ id: "n-1", fecha: "2026-10-20", texto: "Baja la barbilla" }],
    revisiones: {
      "reglas-dbd1d8ab": { respuesta: "Tras parar, jab o directo", confirmado: true, fecha: "2026-10-21" },
      "acciones-635f79cf": { respuesta: "Pendiente de ver en el saco", confirmado: false, fecha: "2026-10-22" },
    },
  };
}

test("v3 → v4: nivel y zurdo salen de «Tus datos» y se conserva todo lo demás", () => {
  const v3 = almacenV3();
  const { datos, migrado } = migrar(structuredClone(v3));
  assert.equal(migrado, true);
  assert.equal(datos.version, 4);
  assert.deepEqual(datos.perfil.sesion, {
    voz: "ambos", ritmo: 5, asalto: "amateur", nivel: 2, zurdo: true, reaccion: false,
    personalizada: { asaltos: 3, duracion_asalto: 180, descanso: 60 },
  });
  // Historial, valoraciones, notas, revisiones del entrenador y el resto del perfil, intactos.
  assert.deepEqual(datos.sesiones, v3.sesiones);
  assert.deepEqual(datos.valoraciones, v3.valoraciones);
  assert.deepEqual(datos.notas_entrenador, v3.notas_entrenador);
  assert.deepEqual(datos.revisiones, v3.revisiones);
  const { sesion, ...resto } = datos.perfil;
  const { sesion: _, ...restoV3 } = v3.perfil;
  assert.deepEqual(resto, restoV3);
});

test("v3 → v4: con «No lo sé» en guardia y nivel, Entrenar usa los de data/perfil.json", () => {
  const v3 = almacenV3();
  v3.perfil.basicos = { ...v3.perfil.basicos, guardia: "no_se", nivel: "no_se" };
  const { datos } = migrar(v3);
  assert.equal(datos.perfil.sesion.nivel, null);
  assert.equal(datos.perfil.sesion.zurdo, null);
});

test("v3 → v4: guardia ortodoxa queda como diestro", () => {
  const v3 = almacenV3();
  v3.perfil.basicos.guardia = "ortodoxa";
  assert.equal(migrar(v3).datos.perfil.sesion.zurdo, false);
});

test("al abrir un almacén v3 se migra, se guarda en v4 y no se pierde nada", () => {
  const v3 = almacenV3();
  const storage = almacenamiento({ boxeo: JSON.stringify(v3) });
  const almacen = crearAlmacen({ storage });
  const guardado = JSON.parse(storage.mapa.get("boxeo"));
  assert.equal(guardado.version, 4);
  assert.deepEqual(guardado, almacen.datos);
  assert.deepEqual(guardado.revisiones, v3.revisiones);
  assert.deepEqual(guardado.sesiones, v3.sesiones);
});

test("importar una copia v3 la migra a v4 conservando revisiones y valoraciones", () => {
  const v3 = almacenV3();
  const almacen = crearAlmacen({ storage: almacenamiento() });
  almacen.importar({ app: "boxeo", version: 3, datos: v3 });
  assert.equal(almacen.datos.version, 4);
  assert.deepEqual(almacen.datos.revisiones, v3.revisiones);
  assert.deepEqual(almacen.datos.valoraciones, v3.valoraciones);
  assert.equal(almacen.datos.perfil.sesion.nivel, 2);
});

test("completa la sesión personalizada a medias con los valores por defecto", () => {
  const datos = { ...vacio(), perfil: { ...vacio().perfil, sesion: { voz: "numeros", personalizada: { asaltos: 5 } } } };
  const { sesion } = migrar(datos).datos.perfil;
  assert.equal(sesion.voz, "numeros");
  assert.equal(sesion.asalto, "amateur");
  assert.deepEqual(sesion.personalizada, { asaltos: 5, duracion_asalto: 180, descanso: 60 });
});

test("guardar y releer la sesión: cada elección y la personalizada persisten", () => {
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  const sesion = {
    voz: "numeros", ritmo: 4, asalto: "personalizado", nivel: 3, zurdo: true, reaccion: true,
    personalizada: { asaltos: 4, duracion_asalto: 120, descanso: 45 },
  };
  almacen.guardarPerfil({ ...almacen.datos.perfil, sesion });
  assert.deepEqual(crearAlmacen({ storage }).datos.perfil.sesion, sesion);
});

test("v1 → v2: el perfil gana «Mi estilo» sin elegir y conserva lo demás", () => {
  const v1 = { ...vacio(), version: 1, perfil: { ...vacio().perfil, estilo: { cardio: "bueno", distancia: "media" } } };
  delete v1.perfil.estilo.mi_estilo;
  const { datos, migrado } = migrar(v1);
  assert.equal(migrado, true);
  assert.equal(datos.version, VERSION);
  assert.equal(datos.perfil.estilo.mi_estilo, "no_se");
  assert.equal(datos.perfil.estilo.cardio, "bueno");
  assert.equal(datos.perfil.estilo.distancia, "media");
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
