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
  "dictado.js",
  "ajustes.js",
  "almacen.js",
  "historial.js",
  "pantalla.js",
  "reproductor.js",
  "rutas.js",
  "sonido.js",
  "voz.js",
  "manifest.json",
  "vistas/ajustes.js",
  "vistas/campos.js",
  "vistas/dom.js",
  "vistas/entrenar.js",
  "vistas/estilo.js",
  "vistas/galeria.js",
  "vistas/grafico.js",
  "vistas/historial.js",
  "vistas/opciones.js",
  "vistas/pasos.js",
  "vistas/perfil.js",
  "vistas/postsesion.js",
  "vistas/resumen.js",
  "maniqui/escena.js",
  "maniqui/maniqui.js",
  "maniqui/posturas.js",
  "motor/acciones.js",
  "motor/azar.js",
  "motor/datos.js",
  "motor/generador.js",
  "motor/reglas.js",
  "motor/sorteo.js",
  "motor/ritmo.js",
  "motor/temporizador.js",
  "data/acciones.json",
  "data/combinaciones.json",
  "data/estilos.json",
  "data/perfil.json",
  "data/posturas.json",
  "data/presets.json",
  "data/revisar.json",
  "data/tecnica.json",
  "fuentes/anton-latin-400-normal.woff2",
  "fuentes/inter-latin-400-normal.woff2",
  "fuentes/inter-latin-600-normal.woff2",
  "fuentes/inter-latin-800-normal.woff2",
  "fuentes/OFL-Anton.txt",
  "fuentes/OFL-Inter.txt",
  "imagenes/aprende-hero.webp",
  "imagenes/cat-defensas.webp",
  "imagenes/cat-estrategia.webp",
  "imagenes/cat-golpes.webp",
  "imagenes/cat-pies.webp",
  "imagenes/entrenar-cabecera.webp",
  "imagenes/historial-cabecera.webp",
  "imagenes/perfil-cabecera.webp",
  "iconos/guante.svg",
  "iconos/icono-192.png",
  "iconos/icono-512.png",
  "iconos/icono-maskable-512.png",
  "iconos/apple-touch-icon.png",
  // Three.js se precachea para ir sin conexión, pero solo se ejecuta al abrir una ficha.
  "vendor/three/three.module.min.js",
  "vendor/three/LICENSE",
  // FOTOS_MANIQUI: construir_sitio.py añade aquí las fotos del maniquí que genera.
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
