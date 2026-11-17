import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

// El service worker en un contexto de mentira: cuenta qué peticiones responde y qué guarda en la caché.
function cargarSW() {
  const manejadores = {};
  const registro = { abiertas: 0, guardadas: [], pedidas: [] };
  const cache = {
    async match() { return undefined; },
    async put(peticion) { registro.guardadas.push(peticion.url); },
    async addAll() {},
  };
  const contexto = {
    URL,
    location: { origin: "http://boxeo.local" },
    self: {
      addEventListener: (tipo, fn) => { manejadores[tipo] = fn; },
      skipWaiting() {},
      clients: { claim: async () => {} },
    },
    caches: {
      async open() { registro.abiertas++; return cache; },
      async keys() { return []; },
    },
    async fetch(peticion) {
      registro.pedidas.push(peticion.url);
      return { ok: true, clone() { return this; } };
    },
    Response: { error: () => ({ error: true }) },
  };
  vm.runInNewContext(readFileSync(new URL("../../static/sw.js", import.meta.url), "utf-8"), contexto);
  return { manejadores, registro };
}

async function pedir(sw, ruta) {
  const promesas = [];
  let respondida = false;
  sw.manejadores.fetch({
    request: { url: `http://boxeo.local/${ruta}`, method: "GET" },
    respondWith(p) { respondida = true; promesas.push(p); },
    waitUntil(p) { promesas.push(p); },
  });
  await Promise.all(promesas);
  return respondida;
}

for (const ruta of ["video/ring-horizontal.mp4", "video/ring-horizontal.webm", "video/ring-vertical.mp4",
  "video/ring-vertical.webm"]) {
  test(`${ruta} no pasa por la caché: el navegador lo pide directo a la red`, async () => {
    const sw = cargarSW();
    assert.equal(await pedir(sw, ruta), false); // sin respondWith: ni se busca ni se guarda
    assert.equal(sw.registro.abiertas, 0);
    assert.deepEqual(sw.registro.guardadas, []);
  });
}

for (const ruta of ["prueba-audio.html", "prueba-audio.js"]) {
  test(`${ruta} (la prueba de audio con cascos) no pasa por la caché: siempre la última versión`, async () => {
    const sw = cargarSW();
    assert.equal(await pedir(sw, ruta), false);
    assert.deepEqual(sw.registro.guardadas, []);
  });
}

test("el vídeo no está en el precache", () => {
  const sw = readFileSync(new URL("../../static/sw.js", import.meta.url), "utf-8");
  const lista = sw.match(/const FICHEROS = \[([\s\S]*?)\];/)[1];
  assert.doesNotMatch(lista, /"video\//);
});

test("el resto de la app sí sale de la caché y se guarda al vuelo", async () => {
  const sw = cargarSW();
  assert.equal(await pedir(sw, "imagenes/ring-cenital.webp"), true);
  assert.deepEqual(sw.registro.guardadas, ["http://boxeo.local/imagenes/ring-cenital.webp"]);
});
