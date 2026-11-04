"""Capturas de C3 («Tus combinaciones» en Entrenar y «Escuchar» en el editor) a 390, 1024 y 1440.

Monta la web en una carpeta temporal (sin fotos del maniquí) y la abre en Chromium headless. Las
combinaciones de ejemplo solo viven en el localStorage de ese Chromium. Guarda en .playwright-mcp/capturas/
(no se versiona), con el ancho al final del nombre:
- mezcla-sin-propias: el selector desactivado con el enlace al creador.
- mezcla-2: con 2 propias, «Solo las mías» desactivada con su motivo.
- mezcla-5-solo: con 5 propias y «Solo las mías»: el nivel desactivado con su nota.
- mezcla-5-mucho-medio: «Mucho» en nivel medio sin propias de ese nivel: el aviso.
- mezcla-editor-escuchar: el editor con 4 acciones y «Escuchar».
- mezcla-editor-vacio: el editor sin acciones («Escuchar» desactivado con su motivo).
Uso: python herramientas/capturas_mezcla.py
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
VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
# Cuatro de básico (una de 2-3 acciones) y una de avanzado: ninguna de medio.
CINCO = [["jab", "directo"], ["jab", "rodar_der", "directo", "gancho_izq"], ["bloqueo", "directo", "gancho_izq"],
         ["jab", "jab", "directo", "esquiva_izq"],
         ["jab", "directo", "esquiva_izq", "gancho_izq", "directo", "rodar_der", "gancho_der", "paso_atras"]]


def entera(pagina, ruta):
    """Captura con la ventana del alto de la página."""
    ancho, alto = pagina.viewport_size["width"], pagina.viewport_size["height"]
    pagina.set_viewport_size({"width": ancho, "height": pagina.evaluate("document.documentElement.scrollHeight")})
    pagina.wait_for_timeout(300)
    pagina.screenshot(path=ruta)
    pagina.set_viewport_size({"width": ancho, "height": alto})


def ir(pagina, ruta, propias=(), sesion=None):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    datos = {"version": 8, "combinacionesPropias": [
        {"id": f"p-{i}", "ids": ids, "creada": "2026-11-04T10:00:00"} for i, ids in enumerate(propias)]}
    if sesion:
        datos["perfil"] = {"sesion": sesion}
    pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(datos))
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    pagina.wait_for_selector("#t-creador" if ruta.startswith("#ajustes") else "#mezclas label")
    pagina.wait_for_timeout(450)  # la entrada de la vista
    pagina.evaluate("document.activeElement.blur()")


def capturar(sitio: Path) -> list[Path]:
    SALIDA.mkdir(parents=True, exist_ok=True)
    rutas = []

    def guardar(nombre, ancho):
        rutas.append(SALIDA / f"mezcla-{nombre}-{ancho}.png")
        return rutas[-1]

    for ancho in ANCHOS:
        with abrir(sitio, VACIA, ancho, ALTO[ancho], barras=True) as (pagina, errores):
            ir(pagina, "#entrenar")
            entera(pagina, guardar("sin-propias", ancho))
            ir(pagina, "#entrenar", CINCO[:2], {"mezcla": "bastante", "nivel": 1})
            entera(pagina, guardar("2", ancho))
            ir(pagina, "#entrenar", CINCO, {"mezcla": "solo", "nivel": 2})
            entera(pagina, guardar("5-solo", ancho))
            ir(pagina, "#entrenar", CINCO, {"mezcla": "mucho", "nivel": 2})
            entera(pagina, guardar("5-mucho-medio", ancho))
            ir(pagina, "#ajustes/mis-combinaciones/nueva")
            entera(pagina, guardar("editor-vacio", ancho))
            for id_ in ("jab", "directo", "gancho_izq"):
                pagina.click(f'[data-anadir="{id_}"]')
            pagina.click('[data-grupo="defensa"]')
            pagina.click('[data-anadir="rodar_der"]')
            pagina.evaluate("document.activeElement.blur()")
            entera(pagina, guardar("editor-escuchar", ancho))
            assert not errores, errores
    return rutas


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for ruta in capturar(construir(Path(tmp) / "_site", "capturas", fotos=False)):
            print(ruta.relative_to(RAIZ))
