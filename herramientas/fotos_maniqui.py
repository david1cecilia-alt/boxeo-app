"""Fotos del maniquí para los dispositivos sin WebGL: una WebP por postura y guardia.

Se pintan con la propia escena 3D (static/maniqui/escena.js) en Chromium headless (Playwright),
con la misma luz, cámara y fondo, así que salen idénticas al maniquí y siguen a data/posturas.json.
El fondo es la misma regla CSS que el de la escena 3D (.maniqui-fondo): se hace una captura del
conjunto y se guarda opaca, porque con transparencia el humo y la sombra pesan el triple.

Uso: python herramientas/fotos_maniqui.py _site   (lo llama construir_sitio.py)
     python herramientas/fotos_maniqui.py _site --vistas   (además frente/lado/arriba, para revisar)
"""
import base64
import json
import mimetypes
import sys
from contextlib import contextmanager
from pathlib import Path

CARPETA = "maniqui/fotos"
ANCHO, ALTO = 600, 800  # 3:4, como .maniqui-escena; ×2 de un hueco de 300 px
VISTA = "tres_cuartos"  # la de inicio del maniquí 3D (VISTA_INICIAL en escena.js)
GUARDIAS = ("ortodoxa", "zurda")
ORIGEN = "http://boxeo.local"

CALIDAD = 0.82
# Página de trabajo: carga los estilos (fondo y tokens de color) y la escena, y deja una
# función que pinta una postura y otra que pasa una captura PNG a WebP.
PAGINA = f"""<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="estilos.css">
<style>body{{margin:0}} canvas{{width:{ANCHO}px;height:{ALTO}px;display:block}}</style>
<div class="maniqui-fondo"><canvas></canvas></div>
<script type="module">
import {{ crearEscena, VISTAS }} from "./maniqui/escena.js";
import {{ prepararPosturas }} from "./maniqui/posturas.js";
const datos = await (await fetch("data/posturas.json")).json();
const posturas = {{ ortodoxa: prepararPosturas(datos), zurda: prepararPosturas(datos, {{ zurdo: true }}) }};
const escena = crearEscena(document.querySelector("canvas"), datos);
window.foto = (id, guardia, vista) => {{
  Object.assign(escena.orbita, VISTAS[vista]);
  escena.mostrar(posturas[guardia][id]);
}};
window.aWebp = async (png) => {{
  const imagen = new Image();
  imagen.src = "data:image/png;base64," + png;
  await imagen.decode();
  const lienzo = document.createElement("canvas");
  lienzo.width = {ANCHO};
  lienzo.height = {ALTO};
  lienzo.getContext("2d").drawImage(imagen, 0, 0);
  return lienzo.toDataURL("image/webp", {CALIDAD});
}};
window.posturas = Object.keys(datos.posturas);
window.listo = true;
</script>"""


def nombre_foto(postura: str, guardia: str, vista: str = VISTA) -> str:
    sufijo = "" if vista == VISTA else f"-{vista}"
    return f"{CARPETA}/{postura}-{guardia}{sufijo}.webp"


@contextmanager
def abrir(sitio: Path, html: str, ancho: int = ANCHO, alto: int = ALTO):
    """Abre `html` en Chromium headless como una página más de `sitio` (sin servidor: Playwright
    sirve los ficheros). Devuelve la página y la lista de errores de JS que vaya habiendo."""
    from playwright.sync_api import sync_playwright

    def servir(ruta):
        relativa = ruta.request.url.removeprefix(ORIGEN + "/").split("?")[0]
        if relativa == "__pagina__.html":
            return ruta.fulfill(body=html, content_type="text/html; charset=utf-8")
        fichero = sitio / relativa
        if not fichero.is_file():
            return ruta.fulfill(status=404)
        tipo = "text/javascript" if fichero.suffix == ".js" else mimetypes.guess_type(fichero.name)[0]
        ruta.fulfill(body=fichero.read_bytes(), content_type=tipo or "application/octet-stream")

    with sync_playwright() as p:
        navegador = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        try:
            pagina = navegador.new_page(viewport={"width": ancho, "height": alto}, device_scale_factor=1)
            errores = []
            pagina.on("pageerror", lambda e: errores.append(str(e)))
            pagina.route(f"{ORIGEN}/**", servir)
            yield pagina, errores
        finally:
            navegador.close()


def generar(sitio: Path, vistas: tuple[str, ...] = (VISTA,)) -> list[str]:
    """Escribe las fotos en `sitio` (la web ya montada) y devuelve sus rutas relativas."""
    rutas = []
    with abrir(sitio, PAGINA) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        try:
            pagina.wait_for_function("window.listo === true", timeout=30_000)
        except Exception as e:
            raise RuntimeError(f"No se pudo montar la escena: {errores}") from e
        (sitio / CARPETA).mkdir(parents=True, exist_ok=True)
        for postura in pagina.evaluate("window.posturas"):
            for guardia in GUARDIAS:
                for vista in vistas:
                    pagina.evaluate("([p, g, v]) => window.foto(p, g, v)", [postura, guardia, vista])
                    png = pagina.locator(".maniqui-fondo").screenshot(type="png", animations="disabled")
                    url = pagina.evaluate("(png) => window.aWebp(png)", base64.b64encode(png).decode())
                    assert url.startswith("data:image/webp;base64,"), "Chromium no exportó WebP"
                    ruta = nombre_foto(postura, guardia, vista)
                    (sitio / ruta).write_bytes(base64.b64decode(url.split(",", 1)[1]))
                    rutas.append(ruta)
    return rutas


def fotos_necesarias(raiz: Path) -> set[str]:
    """Las fotos que pide data/tecnica.json: una por paso con postura y guardia."""
    tecnica = json.loads((raiz / "data" / "tecnica.json").read_text(encoding="utf-8"))
    return {nombre_foto(paso["postura"], guardia)
            for ficha in tecnica["fichas"] for paso in ficha["pasos"] if paso.get("postura")
            for guardia in GUARDIAS}


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        raise SystemExit(__doc__)
    extra = (VISTA, "frente", "lado", "arriba") if "--vistas" in sys.argv else (VISTA,)
    for r in generar(Path(sys.argv[1]), extra):
        print(r)
