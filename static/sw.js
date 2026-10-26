// Service worker: guarda toda la app en caché para entrenar sin conexión.
// Estrategia "stale-while-revalidate": responde al instante desde la caché y, si hay
// red, actualiza la copia en segundo plano para la próxima vez.
// El despliegue sustituye VERSION por el commit, así cada versión estrena caché.
const VERSION = "boxeo-dev";

const FICHEROS = [
  "./",
  "index.html",
  "estilos.css",
  "app.js",
  "almacen.js",
  "reproductor.js",
  "historial.js",
  "sonido.js",
  "voz.js",
  "manifest.json",
  "motor/acciones.js",
  "motor/azar.js",
  "motor/datos.js",
  "motor/generador.js",
  "motor/reglas.js",
  "motor/ritmo.js",
  "motor/temporizador.js",
  "data/acciones.json",
  "data/combos.json",
  "data/perfil.json",
  "data/presets.json",
  "iconos/guante.svg",
  "iconos/icono-192.png",
  "iconos/icono-512.png",
  "iconos/icono-maskable-512.png",
  "iconos/apple-touch-icon.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FICHEROS)));
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil((async () => {
    for (const nombre of await caches.keys()) {
      if (nombre !== VERSION) await caches.delete(nombre);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  // Solo GET de este mismo sitio; la API (si hay servidor) nunca se cachea.
  if (evento.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/")) return;

  evento.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const guardada = await cache.match(evento.request, { ignoreSearch: true });
    const deRed = fetch(evento.request)
      .then((respuesta) => {
        if (respuesta.ok) cache.put(evento.request, respuesta.clone());
        return respuesta;
      })
      .catch(() => null);
    if (guardada) {
      evento.waitUntil(deRed);
      return guardada;
    }
    return (await deRed) ?? Response.error();
  })());
});
