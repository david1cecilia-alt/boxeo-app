"""Capturas de «Practicar más» (Ajustes) a 390, 768 y 1440 y de una sesión a 390 con «croch. dcha. abajo».

Monta la web en una carpeta temporal (sin fotos del maniquí) y la abre en Chromium headless con el almacén
vacío. Guarda en .playwright-mcp/capturas/ (no se versiona):
- ajustes-practicar-vacio-<ancho>.png: sin nada elegido.
- ajustes-practicar-3-<ancho>.png: con 3 elegidos (los demás, desactivados).
- sesion-practicar-croch-390.png: una sesión de Medio con esos 3 y una semilla fija.
Uso: python herramientas/capturas_practicar.py
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
ANCHOS = (390, 768, 1440)
VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
# Semilla fija (24): con estos tres elegidos, la primera combinación de Medio lleva «croch. dcha. abajo».
SEMILLA = """const _g = crypto.getRandomValues.bind(crypto);
crypto.getRandomValues = (a) => (a instanceof Uint32Array && a.length === 1 ? (a[0] = 24, a) : _g(a));"""
ELEGIDOS = [("4", "bastante"), ("cuerpo", "bastante"), ("rodar", "poco")]


def entera(pagina, ruta):
    """Captura con la ventana del alto de la página: la barra fija queda abajo, como al usarla."""
    ancho = pagina.viewport_size["width"]
    pagina.set_viewport_size({"width": ancho, "height": pagina.evaluate("document.documentElement.scrollHeight")})
    pagina.wait_for_timeout(300)
    pagina.screenshot(path=ruta)
    pagina.set_viewport_size({"width": ancho, "height": 900})


def elegir(pagina):
    for movimiento, cuanto in ELEGIDOS:
        pagina.locator(f'[data-practicar="{movimiento}"]').check()
        pagina.locator(f'[data-movimiento="{movimiento}"][data-cuanto="{cuanto}"]').check()


def abrir_ajustes(pagina):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    pagina.goto(f"{ORIGEN}/index.html#ajustes")
    pagina.wait_for_selector("#t-practicar")


def capturar(sitio: Path) -> list[Path]:
    SALIDA.mkdir(parents=True, exist_ok=True)
    rutas = []
    for ancho in ANCHOS:
        with abrir(sitio, VACIA, ancho, 900) as (pagina, errores):
            abrir_ajustes(pagina)
            for nombre, preparar in (("vacio", None), ("3", elegir)):
                if preparar:
                    preparar(pagina)
                rutas.append(SALIDA / f"ajustes-practicar-{nombre}-{ancho}.png")
                entera(pagina, rutas[-1])
            assert not errores, errores
    with abrir(sitio, VACIA, 390, 844) as (pagina, errores):
        pagina.add_init_script(SEMILLA)
        abrir_ajustes(pagina)
        elegir(pagina)
        pagina.goto(f"{ORIGEN}/index.html#entrenar")
        pagina.click('label:has(input[name="nivel"][value="2"])')
        pagina.click("#empezar")
        pagina.wait_for_selector("#combo li:has-text('croch. dcha. abajo')", timeout=90_000)
        pagina.wait_for_timeout(300)
        rutas.append(SALIDA / "sesion-practicar-croch-390.png")
        pagina.screenshot(path=rutas[-1])
        assert not errores, errores
    return rutas


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for ruta in capturar(construir(Path(tmp) / "_site", "capturas", fotos=False)):
            print(ruta.relative_to(RAIZ))
