"""Capturas de «Practicar más» (Personalizar sesión, en el menú de Entrenar) a 390, 1024 y 1440 y de una sesión
a 390 con un golpe al cuerpo.

Monta la web en una carpeta temporal (sin fotos del maniquí) y la abre en Chromium headless con el almacén
vacío. Elige como una persona: hueco vacío, pestaña y ficha. Guarda en .playwright-mcp/capturas/ (no se
versiona):
- ajustes-practicar-vacio-<ancho>.png: sin nada elegido.
- ajustes-practicar-panel-<pestaña>-<ancho>.png: el panel abierto con uno ya elegido (marcado). A 390, en
  cada pestaña; a 1024 y 1440, en Golpes.
- ajustes-practicar-3-<ancho>.png: con 3 elegidos.
- ajustes-practicar-zurdo-<ancho>.png: los mismos 3 en zurdo (los golpes cambian de mano).
- sesion-practicar-cuerpo-390.png: una sesión de Medio (Personalizada) con esos 3 y una semilla fija.
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
ANCHOS = (390, 1024, 1440)
ALTO = {390: 844, 1024: 768, 1440: 900}
PESTANAS = ("golpe", "defensa", "movimiento")
VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
# Semilla fija (24): la sesión sale siempre igual (con estos tres elegidos, enseguida un golpe al cuerpo).
SEMILLA = """const _g = crypto.getRandomValues.bind(crypto);
crypto.getRandomValues = (a) => (a instanceof Uint32Array && a.length === 1 ? (a[0] = 24, a) : _g(a));"""
# (movimiento, pestaña del panel, cuánto más)
ELEGIDOS = [("4", "golpe", "bastante"), ("cuerpo", "golpe", "bastante"), ("rodar", "defensa", "poco")]


def entera(pagina, ruta):
    """Captura con la ventana del alto de la página: la barra fija queda abajo, como al usarla."""
    ancho, alto = pagina.viewport_size["width"], pagina.viewport_size["height"]
    pagina.set_viewport_size({"width": ancho, "height": pagina.evaluate("document.documentElement.scrollHeight")})
    pagina.wait_for_timeout(300)
    pagina.screenshot(path=ruta)
    pagina.set_viewport_size({"width": ancho, "height": alto})


def elegir(pagina, elegidos):
    # Un solo nivel desde la R0: el tercer dato («cuánto») ya no se usa.
    for movimiento, pestana, _ in elegidos:
        pagina.locator(".hueco.vacio").first.click()
        pagina.click(f"#pestana-{pestana}")
        pagina.click(f'[data-elegir="{movimiento}"]')


def abrir_ajustes(pagina):
    """«Practicar más», en Personalizar sesión del menú de Entrenar."""
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/personalizar")
    pagina.wait_for_selector("#t-practicar", state="visible")
    pagina.locator("#f-practicar").scroll_into_view_if_needed()


def pasar_a_zurdo(pagina):
    # La guardia, en la sección Ajustes del mismo menú; «Practicar más» se repinta solo.
    pagina.evaluate("document.querySelector('[data-seccion=ajustes]').open = true")
    pagina.click('#menu-ajustes label:has(input[name="guardia"][value="zurdo"])')
    pagina.locator("#f-practicar").scroll_into_view_if_needed()


def capturar(sitio: Path) -> list[Path]:
    SALIDA.mkdir(parents=True, exist_ok=True)
    rutas = []

    def guardar(nombre, ancho):
        rutas.append(SALIDA / f"ajustes-practicar-{nombre}-{ancho}.png")
        return rutas[-1]

    for ancho in ANCHOS:
        with abrir(sitio, VACIA, ancho, ALTO[ancho]) as (pagina, errores):
            abrir_ajustes(pagina)
            pagina.screenshot(path=guardar("vacio", ancho))
            elegir(pagina, ELEGIDOS[:1])
            pagina.locator(".hueco.vacio").first.click()
            for pestana in PESTANAS if ancho == 390 else PESTANAS[:1]:
                pagina.click(f"#pestana-{pestana}")
                pagina.wait_for_timeout(300)
                pagina.screenshot(path=guardar(f"panel-{pestana}", ancho))
            pagina.keyboard.press("Escape")
            elegir(pagina, ELEGIDOS[1:])
            pagina.screenshot(path=guardar("3", ancho))
            pasar_a_zurdo(pagina)
            pagina.screenshot(path=guardar("zurdo", ancho))
            assert not errores, errores
    with abrir(sitio, VACIA, 390, 844) as (pagina, errores):
        pagina.add_init_script(SEMILLA)
        abrir_ajustes(pagina)
        elegir(pagina, ELEGIDOS)  # con la General elegida, pasa a la Personalizada (D3)
        pagina.click('#menu-personalizar label:has(input[name="nivel"][value="2"])')
        pagina.goto(f"{ORIGEN}/index.html#entrenar")
        pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
        pagina.click("#empezar")
        # Un golpe al cuerpo (uno de los elegidos). Con el factor de la R0 la semilla ya no da justo el crochet.
        pagina.wait_for_selector("#combo li:has-text('abajo')", timeout=90_000)
        pagina.wait_for_timeout(300)
        rutas.append(SALIDA / "sesion-practicar-cuerpo-390.png")
        pagina.screenshot(path=rutas[-1])
        assert not errores, errores
    return rutas


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for ruta in capturar(construir(Path(tmp) / "_site", "capturas", fotos=False)):
            print(ruta.relative_to(RAIZ))
