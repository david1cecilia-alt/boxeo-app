"""Capturas de «Mis combinaciones» (el creador, en Ajustes) a 390, 1024 y 1440.

Monta la web en una carpeta temporal (sin fotos del maniquí) y la abre en Chromium headless. Las
combinaciones de ejemplo solo viven en el localStorage de ese Chromium. Guarda en .playwright-mcp/capturas/
(no se versiona), con el ancho al final del nombre:
- creador-ajustes: la tarjeta «Mis combinaciones 3/20» en Ajustes.
- creador-listado-vacio, creador-listado-3, creador-listado-20: el listado.
- creador-editor-vacio, creador-editor-cuerpo («Al cuerpo» activo, con 3 acciones), creador-editor-10.
- creador-avisos: el diálogo «Antes de guardar» con dos avisos.
- creador-borrar: la confirmación de borrar la combinación 1 de 3.
Uso: python herramientas/capturas_creador.py
"""
import json
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
RUTA = "#ajustes/mis-combinaciones"
VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
EJEMPLOS = [["jab", "rodar_der", "uppercut_der"], ["jab", "directo", "esquiva_izq", "gancho_izq", "directo"],
            ["bloqueo", "parada", "paso_atras"]]


def entera(pagina, ruta):
    """Captura con la ventana del alto de la página: la barra fija queda abajo, como al usarla."""
    ancho, alto = pagina.viewport_size["width"], pagina.viewport_size["height"]
    pagina.set_viewport_size({"width": ancho, "height": pagina.evaluate("document.documentElement.scrollHeight")})
    pagina.wait_for_timeout(300)
    pagina.screenshot(path=ruta)
    pagina.set_viewport_size({"width": ancho, "height": alto})


def ir(pagina, ruta, propias=()):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    if propias:
        datos = {"version": 8, "combinacionesPropias": [
            {"id": f"p-{i}", "ids": ids, "creada": "2026-11-04T10:00:00"} for i, ids in enumerate(propias)]}
        pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(datos))
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    pagina.wait_for_selector("#t-creador" if ruta.startswith(RUTA) else "#ir-creador")
    pagina.wait_for_timeout(450)  # la entrada de la vista


def capturar(sitio: Path) -> list[Path]:
    SALIDA.mkdir(parents=True, exist_ok=True)
    rutas = []

    def guardar(nombre, ancho):
        rutas.append(SALIDA / f"creador-{nombre}-{ancho}.png")
        return rutas[-1]

    for ancho in ANCHOS:
        with abrir(sitio, VACIA, ancho, ALTO[ancho], barras=True) as (pagina, errores):
            ir(pagina, "#ajustes", EJEMPLOS)
            entera(pagina, guardar("ajustes", ancho))
            ir(pagina, RUTA)
            entera(pagina, guardar("listado-vacio", ancho))
            ir(pagina, RUTA, EJEMPLOS)
            entera(pagina, guardar("listado-3", ancho))
            pagina.click('[data-borrar="p-0"]')
            pagina.wait_for_timeout(200)
            pagina.screenshot(path=guardar("borrar", ancho))
            pagina.keyboard.press("Escape")
            ir(pagina, RUTA, [EJEMPLOS[i % 3] for i in range(20)])
            entera(pagina, guardar("listado-20", ancho))

            ir(pagina, f"{RUTA}/nueva")
            pagina.evaluate("document.activeElement.blur()")
            entera(pagina, guardar("editor-vacio", ancho))
            for id_ in ("jab", "directo"):
                pagina.click(f'[data-anadir="{id_}"]')
            pagina.click("#al-cuerpo")
            pagina.click('[data-anadir="gancho_der_cuerpo"]')
            pagina.click("#al-cuerpo")
            pagina.evaluate("document.activeElement.blur()")
            entera(pagina, guardar("editor-cuerpo", ancho))
            pagina.click("#al-cuerpo")
            for id_ in ("uppercut_izq", "gancho_izq"):
                pagina.click(f'[data-anadir="{id_}"]')
            pagina.click('[data-grupo="defensa"]')
            for id_ in ("esquiva_der", "bloqueo"):
                pagina.click(f'[data-anadir="{id_}"]')
            pagina.click('[data-grupo="movimiento"]')
            pagina.click('[data-anadir="pivote"]')
            pagina.click('[data-grupo="golpe"]')
            pagina.click('[data-anadir="directo"]')
            pagina.click('[data-anadir="gancho_izq"]')
            pagina.evaluate("document.activeElement.blur()")
            entera(pagina, guardar("editor-10", ancho))

            ir(pagina, f"{RUTA}/nueva", [["bloqueo", "parada"]])
            pagina.click('[data-grupo="defensa"]')
            pagina.click('[data-anadir="bloqueo"]')
            pagina.click('[data-anadir="parada"]')
            pagina.click("#guardar")
            pagina.wait_for_timeout(200)
            pagina.screenshot(path=guardar("avisos", ancho))
            assert not errores, errores
    return rutas


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for ruta in capturar(construir(Path(tmp) / "_site", "capturas", fotos=False)):
            print(ruta.relative_to(RAIZ))
