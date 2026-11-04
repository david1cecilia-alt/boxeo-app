"""Capturas de Aprende a 390, 768, 1024 y 1440 y de «Practicar más» con la rueda a 390.

Monta la web en una carpeta temporal (sin fotos del maniquí) y la abre en Chromium headless con el almacén
vacío. Guarda en .playwright-mcp/capturas/ (no se versiona):
- aprende-lista-<ancho>.png: la lista de fichas, entera.
- aprende-ficha-rodar-<ancho>.png: la ficha de la rueda, entera.
- aprende-ficha-salir-390.png: la de «Cambio de ángulo» (el título más largo).
- aprende-barra-390.png: la barra de pestañas con Aprende.
- ajustes-practicar-rueda-390.png: «Practicar más» con la rueda elegida y el panel de Defensas.
Uso: python herramientas/capturas_aprende.py
"""
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.construir_sitio import construir  # noqa: E402
from herramientas.fotos_maniqui import ORIGEN, abrir  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / ".playwright-mcp" / "capturas"
ANCHOS = (390, 768, 1024, 1440)
ALTO = {390: 844, 768: 1024, 1024: 768, 1440: 900}
VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
# Espera a que acaben las animaciones (la entrada de la vista) y a que se carguen las imágenes.
QUIETA = """() => Promise.all([...document.getAnimations().map((a) => a.finished.catch(() => {})),
  ...[...document.images].filter((i) => i.offsetParent).map((i) => i.decode().catch(() => {}))])"""


def quieta(pagina):
    pagina.evaluate(QUIETA)


def entera(pagina, ruta):
    """Captura con la ventana del alto de la página: la barra fija queda abajo, como al usarla."""
    ancho, alto = pagina.viewport_size["width"], pagina.viewport_size["height"]
    pagina.set_viewport_size({"width": ancho, "height": pagina.evaluate("document.documentElement.scrollHeight")})
    quieta(pagina)
    pagina.screenshot(path=ruta)
    pagina.set_viewport_size({"width": ancho, "height": alto})


def ir(pagina, hash_, selector):
    pagina.goto(f"{ORIGEN}/index.html#{hash_}")
    pagina.wait_for_selector(selector)
    quieta(pagina)


def capturar(sitio: Path) -> list[Path]:
    SALIDA.mkdir(parents=True, exist_ok=True)
    rutas = []

    def guardar(nombre):
        rutas.append(SALIDA / f"{nombre}.png")
        return rutas[-1]

    for ancho in ANCHOS:
        with abrir(sitio, VACIA, ancho, ALTO[ancho]) as (pagina, errores):
            pagina.goto(f"{ORIGEN}/__pagina__.html")
            pagina.wait_for_function("window.listo === true")
            ir(pagina, "aprende", ".lista-fichas")
            entera(pagina, guardar(f"aprende-lista-{ancho}"))
            if ancho == 390:
                pagina.locator("#pestanas").screenshot(path=guardar("aprende-barra-390"))
            pagina.click('[data-ficha="rodar"]')
            pagina.wait_for_selector(".aprende-ficha")
            entera(pagina, guardar(f"aprende-ficha-rodar-{ancho}"))
            if ancho == 390:
                ir(pagina, "aprende/salir", ".aprende-ficha")
                entera(pagina, guardar("aprende-ficha-salir-390"))
                ir(pagina, "ajustes", "#t-practicar")
                pagina.locator(".hueco.vacio").first.click()
                pagina.click("#pestana-defensa")
                pagina.click('[data-elegir="rodar"]')
                pagina.locator(".hueco.vacio").first.click()
                pagina.click("#pestana-defensa")
                quieta(pagina)
                pagina.screenshot(path=guardar("ajustes-practicar-rueda-390"))
            assert not errores, errores
    return rutas


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for ruta in capturar(construir(Path(tmp) / "_site", "capturas", fotos=False)):
            print(ruta.relative_to(RAIZ))
