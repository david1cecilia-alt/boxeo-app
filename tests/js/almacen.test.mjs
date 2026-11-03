import assert from "node:assert/strict";
import { test } from "node:test";

import { VERSION, claveSesion, crearAlmacen, historialPorDefecto, migrar, sesionPorDefecto, vacio, vozPorDefecto } from "../../static/almacen.js";

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
    perfil: { ...vacio().perfil, pesos: { termina_en_gancho: 2, bloquear_y_devolver: 1, entrada_con_jab: 1 }, estilo: { ...vacio().perfil.estilo, mi_estilo: "boxer" } } };
  delete v2.perfil.sesion;
  const { datos, migrado } = migrar(v2);
  assert.equal(migrado, true);
  assert.equal(datos.version, VERSION);
  assert.equal(datos.perfil.sesion.voz, "nombres");
  assert.equal(datos.perfil.sesion.ritmo, 3);
  assert.equal(datos.perfil.estilo.mi_estilo, "boxer");
  assert.equal("pesos" in datos.perfil, false); // se van en la v6
  assert.deepEqual(datos.sesiones, [{ id: "a" }]);
});

test("v1 llega a la versión actual pasando por todas las migraciones", () => {
  const { datos } = migrar({ version: 1, sesiones: [], perfil: { estilo: { cardio: "bueno" } } });
  assert.equal(datos.version, VERSION);
  assert.equal(datos.perfil.estilo.mi_estilo, "no_se");
  assert.deepEqual(datos.perfil.sesion, sesionPorDefecto());
});

// Almacén v3 completo, como lo tenía quien usaba la app antes de la v4.
function almacenV3() {
  const { voz, historial, ...perfil } = vacio().perfil;
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
  assert.equal(datos.version, VERSION);
  assert.deepEqual(datos.perfil.sesion, {
    voz: "ambos", ritmo: 5, asalto: "amateur", nivel: 2, zurdo: true, reaccion: false,
    personalizada: { asaltos: 3, duracion_asalto: 180, descanso: 60 },
  });
  // Historial, valoraciones y el resto del perfil, intactos; las notas y revisiones del entrenador,
  // y la guardia y el nivel de «Tus datos», se van en la v7.
  assert.deepEqual(datos.sesiones, v3.sesiones);
  assert.deepEqual(datos.valoraciones, v3.valoraciones);
  assert.equal("notas_entrenador" in datos, false);
  assert.equal("revisiones" in datos, false);
  const { sesion, voz, historial, practicar, ...resto } = datos.perfil;
  const { sesion: _, focos, pesos, ...restoV3 } = v3.perfil;
  const { guardia, nivel, ...basicosV3 } = restoV3.basicos;
  assert.deepEqual(resto, { ...restoV3, basicos: basicosV3 });
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

test("al abrir un almacén v3 se migra, se guarda en la versión actual y no se pierde nada", () => {
  const v3 = almacenV3();
  const storage = almacenamiento({ boxeo: JSON.stringify(v3) });
  const almacen = crearAlmacen({ storage });
  const guardado = JSON.parse(storage.mapa.get("boxeo"));
  assert.equal(guardado.version, VERSION);
  assert.deepEqual(guardado, almacen.datos);
  assert.equal("revisiones" in guardado, false);
  assert.deepEqual(guardado.sesiones, v3.sesiones);
});

test("importar una copia v3 la migra a la versión actual conservando las valoraciones", () => {
  const v3 = almacenV3();
  const almacen = crearAlmacen({ storage: almacenamiento() });
  almacen.importar({ app: "boxeo", version: 3, datos: v3 });
  assert.equal(almacen.datos.version, VERSION);
  assert.equal("revisiones" in almacen.datos, false);
  assert.deepEqual(almacen.datos.valoraciones, v3.valoraciones);
  assert.equal(almacen.datos.perfil.sesion.nivel, 2);
});

// Almacén v4 completo, como lo tiene hoy quien ya usa la app.
function almacenV4() {
  const v4 = migrar(almacenV3()).datos;
  const { voz, historial, practicar, ...perfil } = v4.perfil;
  return {
    ...v4,
    version: 4,
    perfil: {
      ...perfil,
      focos: ["jab doble", "salir por el ángulo"],
      pesos: almacenV3().perfil.pesos,
      sesion: { ...perfil.sesion, asalto: "personalizado", personalizada: { asaltos: 4, duracion_asalto: 120, descanso: 45 } },
    },
  };
}

test("v4 → v5: voz automática a velocidad normal, Historial por semana, sin focos, y se conserva todo lo demás", () => {
  const v4 = almacenV4();
  const { datos, migrado } = migrar(structuredClone(v4));
  assert.equal(migrado, true);
  assert.equal(datos.version, VERSION);
  assert.deepEqual(datos.perfil.voz, { id: null, velocidad: "normal" });
  assert.deepEqual(datos.perfil.historial, { agrupar: "semana" });
  assert.equal("focos" in datos.perfil, false);
  const { voz, historial, practicar, ...perfil } = datos.perfil;
  const { focos, pesos, ...perfilV4 } = v4.perfil;
  assert.deepEqual(perfil, perfilV4);
  for (const campo of ["sesiones", "valoraciones"]) {
    assert.deepEqual(datos[campo], v4[campo], campo);
  }
});

test("v4 → v5: un perfil sin nada también migra", () => {
  const { datos } = migrar({ version: 4, sesiones: [] });
  assert.equal(datos.version, VERSION);
  assert.deepEqual(datos.perfil, vacio().perfil);
});

test("al abrir un almacén v4 se guarda en la versión actual sin focos y sin perder nada", () => {
  const v4 = almacenV4();
  const storage = almacenamiento({ boxeo: JSON.stringify(v4) });
  const almacen = crearAlmacen({ storage });
  const guardado = JSON.parse(storage.mapa.get("boxeo"));
  assert.equal(guardado.version, VERSION);
  assert.deepEqual(guardado, almacen.datos);
  assert.equal("focos" in guardado.perfil, false);
  assert.deepEqual(guardado.perfil.historial, { agrupar: "semana" });
  assert.deepEqual(guardado.perfil.sesion, v4.perfil.sesion);
});

test("importar una copia v4 la deja en la versión actual", () => {
  const v4 = almacenV4();
  const almacen = crearAlmacen({ storage: almacenamiento() });
  almacen.importar({ app: "boxeo", version: 4, datos: v4 });
  assert.equal(almacen.datos.version, VERSION);
  assert.deepEqual(almacen.datos.perfil.voz, vozPorDefecto());
  assert.deepEqual(almacen.datos.perfil.historial, historialPorDefecto());
  assert.deepEqual(almacen.datos.valoraciones, v4.valoraciones);
});

// Almacén v5, como lo tenía quien usaba la app antes de «Practicar más»: con sus pesos.
function almacenV5() {
  const v5 = migrar(almacenV4()).datos;
  const { practicar, ...perfil } = v5.perfil;
  return { ...v5, version: 5, perfil: { ...perfil, pesos: { termina_en_gancho: 3, bloquear_y_devolver: 1, entrada_con_jab: 1.5 } } };
}

test("v5 → v6: los pesos se van, «Practicar más» empieza sin nada y se conserva todo lo demás", () => {
  const v5 = almacenV5();
  const { datos, migrado } = migrar(structuredClone(v5));
  assert.equal(migrado, true);
  assert.equal(datos.version, VERSION);
  assert.deepEqual(datos.perfil.practicar, []);
  assert.equal("pesos" in datos.perfil, false);
  const { practicar, ...perfil } = datos.perfil;
  const { pesos, ...perfilV5 } = v5.perfil;
  assert.deepEqual(perfil, perfilV5);
  for (const campo of ["sesiones", "valoraciones"]) {
    assert.deepEqual(datos[campo], v5[campo], campo);
  }
});

test("v5 → v6: un perfil sin nada también migra", () => {
  const { datos } = migrar({ version: 5, sesiones: [] });
  assert.equal(datos.version, VERSION);
  assert.deepEqual(datos.perfil, vacio().perfil);
});

test("al abrir un almacén v5 se guarda en la versión actual sin pesos; importar una copia v5 también", () => {
  const v5 = almacenV5();
  const storage = almacenamiento({ boxeo: JSON.stringify(v5) });
  const almacen = crearAlmacen({ storage });
  const guardado = JSON.parse(storage.mapa.get("boxeo"));
  assert.equal(guardado.version, VERSION);
  assert.deepEqual(guardado, almacen.datos);
  assert.equal("pesos" in guardado.perfil, false);
  assert.deepEqual(guardado.sesiones, v5.sesiones);
  const otro = crearAlmacen({ storage: almacenamiento() });
  otro.importar({ app: "boxeo", version: 5, datos: v5 });
  assert.deepEqual(otro.datos, almacen.datos);
});

test("importar una copia de seguridad v5 con pesos pasa por la migración: sin pesos y sin nada en «Practicar más»", () => {
  const v5 = almacenV5();
  const copia = JSON.parse(JSON.stringify({ app: "boxeo", version: 5, exportado: "2026-10-30T10:00:00Z", datos: v5 }));
  assert.equal(copia.datos.version, 5);
  assert.ok(copia.datos.perfil.pesos);
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  assert.equal(almacen.importar(copia), true);
  for (const datos of [almacen.datos, JSON.parse(storage.mapa.get("boxeo"))]) {
    assert.equal(datos.version, VERSION);
    assert.equal("pesos" in datos.perfil, false);
    assert.deepEqual(datos.perfil.practicar, []);
  }
});

// Almacén v6 completo, como lo tiene hoy quien ya usa la app: con notas y revisiones del entrenador
// guardadas de antes y la guardia y el nivel de «Tus datos», sin haber elegido aún nada en Entrenar.
function almacenV6() {
  const { practicar, ...perfil } = vacio().perfil;
  return {
    version: 6,
    sesiones: [{ ...SESION_V0, id: "s-1" }],
    valoraciones: { "local:s-1": { rpe: 6, sensacion: 3, actualizada: "2026-10-30" } },
    perfil: {
      ...perfil,
      basicos: { guardia: "zurda", nivel: "3", inicio: "2025-09-01", altura_cm: 178, peso_kg: 75, alcance_cm: 183 },
      estilo: { ...perfil.estilo, mi_estilo: "boxer", distancia: "larga" },
      sesion: { ...sesionPorDefecto(), voz: "numeros", ritmo: 4 },
      voz: { id: "urn:voz", velocidad: "rapida" },
      historial: { agrupar: "mes", grafica: "rpe" },
      practicar: [{ movimiento: "3", cuanto: "bastante" }],
    },
    notas_entrenador: [{ id: "n-1", fecha: "2026-10-20", texto: "Baja la barbilla" }],
    revisiones: { "reglas-dbd1d8ab": { respuesta: "Tras parar, jab", confirmado: true, fecha: "2026-10-21" } },
  };
}

test("v6 → v7: fuera notas, revisiones y la guardia y el nivel de «Tus datos», que pasan a Entrenar si no estaban", () => {
  const v6 = almacenV6();
  const { datos, migrado } = migrar(structuredClone(v6));
  assert.equal(migrado, true);
  assert.equal(datos.version, 7);
  assert.equal("notas_entrenador" in datos, false);
  assert.equal("revisiones" in datos, false);
  assert.deepEqual(datos.perfil.basicos, { inicio: "2025-09-01", altura_cm: 178, peso_kg: 75, alcance_cm: 183 });
  assert.equal(datos.perfil.sesion.nivel, 3);
  assert.equal(datos.perfil.sesion.zurdo, true);
  // Todo lo demás, intacto.
  assert.deepEqual(datos.sesiones, v6.sesiones);
  assert.deepEqual(datos.valoraciones, v6.valoraciones);
  const { basicos, sesion, ...perfil } = datos.perfil;
  const { basicos: _, sesion: sesionV6, ...perfilV6 } = v6.perfil;
  assert.deepEqual(perfil, perfilV6);
  assert.deepEqual({ ...sesion, nivel: null, zurdo: null }, sesionV6);
  assert.deepEqual(Object.keys(datos).sort(), ["perfil", "sesiones", "valoraciones", "version"]);
});

test("v6 → v7: lo ya elegido en Entrenar manda sobre «Tus datos»; con «No lo sé», sin elegir", () => {
  const v6 = almacenV6();
  v6.perfil.sesion = { ...v6.perfil.sesion, nivel: 1, zurdo: false };
  assert.deepEqual([migrar(v6).datos.perfil.sesion.nivel, migrar(almacenV6()).datos.perfil.sesion.nivel], [1, 3]);
  assert.equal(migrar(v6).datos.perfil.sesion.zurdo, false);
  const sinSaber = almacenV6();
  sinSaber.perfil.basicos = { ...sinSaber.perfil.basicos, guardia: "no_se", nivel: "no_se" };
  const { sesion } = migrar(sinSaber).datos.perfil;
  assert.deepEqual([sesion.nivel, sesion.zurdo], [null, null]);
  // Un v6 casi vacío también migra.
  assert.deepEqual(migrar({ version: 6, sesiones: [] }).datos.perfil, vacio().perfil);
});

test("al abrir un almacén v6 se guarda en v7 sin lo que sobra; importar una copia v6 da lo mismo", () => {
  const v6 = almacenV6();
  const storage = almacenamiento({ boxeo: JSON.stringify(v6) });
  const almacen = crearAlmacen({ storage });
  const guardado = JSON.parse(storage.mapa.get("boxeo"));
  assert.equal(guardado.version, 7);
  assert.deepEqual(guardado, almacen.datos);
  assert.equal("notas_entrenador" in guardado, false);
  // Copia de seguridad v6 por un fichero JSON, como en la app.
  const copia = JSON.parse(JSON.stringify({ app: "boxeo", version: 6, exportado: "2026-11-01T10:00:00Z", datos: v6 }));
  const otroStorage = almacenamiento();
  const otro = crearAlmacen({ storage: otroStorage });
  assert.equal(otro.importar(copia), true);
  assert.deepEqual(otro.datos, almacen.datos);
  assert.deepEqual(JSON.parse(otroStorage.mapa.get("boxeo")), almacen.datos);
  // Y la copia nueva ya no lleva notas ni revisiones.
  const nueva = otro.exportar();
  assert.equal(nueva.version, 7);
  assert.equal("revisiones" in nueva.datos, false);
});

test("el almacén ya no tiene funciones de notas ni de revisiones", () => {
  const almacen = crearAlmacen({ storage: almacenamiento() });
  for (const f of ["anadirNotaEntrenador", "borrarNotaEntrenador", "guardarRevision"]) assert.equal(f in almacen, false, f);
});

test("«Practicar más» se guarda y se relee; si no es una lista vuelve a vacío", () => {
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  const elegidos = [{ movimiento: "6", cuanto: "poco" }, { movimiento: "rodar", cuanto: "bastante" }];
  almacen.guardarPerfil({ ...almacen.datos.perfil, practicar: elegidos });
  assert.deepEqual(crearAlmacen({ storage }).datos.perfil.practicar, elegidos);
  almacen.guardarPerfil({ ...almacen.datos.perfil, practicar: "6" });
  assert.deepEqual(almacen.datos.perfil.practicar, []);
});

test("la voz elegida se guarda y se relee; a medias se completa", () => {
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  almacen.guardarPerfil({ ...almacen.datos.perfil, voz: { id: "urn:voz-helena", velocidad: "rapida" } });
  assert.deepEqual(crearAlmacen({ storage }).datos.perfil.voz, { id: "urn:voz-helena", velocidad: "rapida" });
  almacen.guardarPerfil({ ...almacen.datos.perfil, voz: { velocidad: "lenta" } });
  assert.deepEqual(almacen.datos.perfil.voz, { id: null, velocidad: "lenta" });
});

test("la agrupación del Historial se guarda y se relee; un v5 sin ella (anterior a este cambio) la completa", () => {
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  almacen.guardarPerfil({ ...almacen.datos.perfil, historial: { agrupar: "mes" } });
  assert.deepEqual(crearAlmacen({ storage }).datos.perfil.historial, { agrupar: "mes" });
  const { historial, ...perfil } = vacio().perfil;
  const { datos, migrado } = migrar({ ...vacio(), perfil });
  assert.equal(migrado, false);
  assert.deepEqual(datos.perfil.historial, { agrupar: "semana" });
});

test("la gráfica del Historial (asaltos o RPE) se guarda y se relee sin cambiar la versión", () => {
  const storage = almacenamiento();
  const almacen = crearAlmacen({ storage });
  almacen.guardarPerfil({ ...almacen.datos.perfil, historial: { ...almacen.datos.perfil.historial, grafica: "rpe" } });
  const releido = crearAlmacen({ storage }).datos;
  assert.deepEqual(releido.perfil.historial, { agrupar: "semana", grafica: "rpe" });
  assert.equal(releido.version, VERSION);
  assert.equal(VERSION, 7);
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
  almacen.guardarPerfil({ practicar: [] });
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
  origen.guardarPerfil({ ...origen.datos.perfil, voz: { id: "urn:voz", velocidad: "lenta" }, practicar: [{ movimiento: "3", cuanto: "bastante" }] });

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
