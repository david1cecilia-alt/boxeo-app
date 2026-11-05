"""Capturas de los golpes al cuerpo 7-12 (fase N), a 390 y 1440.

Monta la web en una carpeta temporal (sin fotos del maniquí) y la abre en Chromium headless; los datos de
prueba van solo en su localStorage. Guarda en .playwright-mcp/capturas/ (no se versiona):
- numeros-sesion-<ancho>.png: una sesión de Medio en modo Números con una combinación que lleva un golpe al
  cuerpo (su círculo dice 7-12).
- numeros-historial-<ancho>.png: una sesión antigua (almacén v5, sin voz guardada) con golpes al cuerpo: se
  ve con el número nuevo sin migrar.
- numeros-aprende-<ancho>.png: la lista de Aprende con los títulos «1/7 Jab»…
- boceto-creador-<ancho>.png: docs/revision/boceto-creador.html con «Al cuerpo» encendido (7-12) y unos
  golpes en la tira. Se copian también a docs/revision/ (esas sí se versionan).
Uso: python herramientas/capturas_numeros.py
"""
import json
import shutil
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.capturas_practicar import entera  # noqa: E402
from herramientas.construir_sitio import construir  # noqa: E402
from herramientas.fotos_maniqui import ORIGEN, abrir  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / ".playwright-mcp" / "capturas"
REVISION = RAIZ / "docs" / "revision"
ANCHOS = (390, 1440)
ALTO = {390: 844, 1440: 900}
VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
# Semilla fija para que la sesión salga siempre igual.
SEMILLA = """const _g = crypto.getRandomValues.bind(crypto);
crypto.getRandomValues = (a) => (a instanceof Uint32Array && a.length === 1 ? (a[0] = 7, a) : _g(a));"""

# Una sesión de antes de los números 7-12, como la guardaba el almacén v5: sin voz (se deduce de los
# textos, dictados en Ambos) y con los nombres de entonces («gancho» era el crochet).
V5 = {
    "version": 5,
    "sesiones": [
        {"id": "vieja-cuerpo", "fecha": "2026-11-01T18:00:00", "asaltos": 3, "nivel": 2, "zurdo": False,
         "duracion_asalto": 180, "descanso": 60, "pausa": None, "ritmo": 3, "modo_reaccion": False,
         "combinaciones": [
             {"asalto": 1, "texto": "uno jab, recto al cuerpo, tres gancho de izquierda",
              "ids": ["jab", "directo_cuerpo", "gancho_izq"]},
             {"asalto": 2, "texto": "esquiva derecha, gancho de derecha al cuerpo, dos recto",
              "ids": ["esquiva_der", "gancho_der_cuerpo", "directo"]},
             {"asalto": 3, "texto": "jab al cuerpo, bloqueo, uppercut de izquierda al cuerpo",
              "ids": ["jab_cuerpo", "bloqueo", "uppercut_izq_cuerpo"]},
         ]},
    ],
    "valoraciones": {},
    "perfil": {},
    "notas_entrenador": [],
    "revisiones": {},
}
SEMBRAR_V5 = f"""<!doctype html><meta charset="utf-8">
<script>localStorage.setItem("boxeo", {json.dumps(json.dumps(V5))}); window.listo = true;</script>"""
CON_CUERPO = """() => [...document.querySelectorAll("#combo .paso-golpe i")].some((i) => Number(i.textContent) >= 7)"""


def preparar(pagina, html=VACIA):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")


def capturar(sitio: Path) -> list[Path]:
    SALIDA.mkdir(parents=True, exist_ok=True)
    rutas = []
    for ancho in ANCHOS:
        # Sesión en modo Números con un golpe al cuerpo en pantalla.
        with abrir(sitio, VACIA, ancho, ALTO[ancho]) as (pagina, errores):
            pagina.add_init_script(SEMILLA)
            preparar(pagina)
            pagina.goto(f"{ORIGEN}/index.html#entrenar")
            pagina.click('label:has(input[name="nivel"][value="2"])')
            pagina.click('label:has(input[name="voz"][value="numeros"])')
            pagina.click("#empezar")
            pagina.wait_for_function(CON_CUERPO, timeout=180_000, polling=100)
            pagina.click("#pausa")
            pagina.wait_for_timeout(300)
            rutas.append(SALIDA / f"numeros-sesion-{ancho}.png")
            pagina.screenshot(path=rutas[-1])
            assert not errores, errores
        # Historial con una sesión antigua.
        with abrir(sitio, SEMBRAR_V5, ancho, ALTO[ancho], barras=True) as (pagina, errores):
            preparar(pagina)
            pagina.goto(f"{ORIGEN}/index.html#historial/local%3Avieja-cuerpo")
            pagina.wait_for_selector("#historial-detalle ol li")
            pagina.evaluate("document.fonts.ready")
            rutas.append(SALIDA / f"numeros-historial-{ancho}.png")
            entera(pagina, rutas[-1])
            assert not errores, errores
        # Aprende.
        with abrir(sitio, VACIA, ancho, ALTO[ancho]) as (pagina, errores):
            preparar(pagina)
            pagina.goto(f"{ORIGEN}/index.html#aprende")
            pagina.wait_for_selector(".aprende-lista .ficha-enlace", state="visible")
            pagina.evaluate("document.fonts.ready")
            pagina.wait_for_timeout(1500)  # que termine la entrada de la pestaña
            rutas.append(SALIDA / f"numeros-aprende-{ancho}.png")
            pagina.screenshot(path=rutas[-1])
            assert not errores, errores
        # Boceto del creador (se sirve desde la raíz del repo: usa ../../static/estilos.css).
        with abrir(RAIZ, VACIA, ancho, ALTO[ancho]) as (pagina, errores):
            pagina.goto(f"{ORIGEN}/docs/revision/boceto-creador.html")
            pagina.wait_for_selector("#golpes button")
            pagina.locator("#al-cuerpo").check()
            for id_ in ("directo_cuerpo", "gancho_der_cuerpo", "uppercut_izq_cuerpo"):
                pagina.click(f'[data-anadir="{id_}"]')
            pagina.evaluate("document.fonts.ready")
            rutas.append(SALIDA / f"boceto-creador-{ancho}.png")
            entera(pagina, rutas[-1])
            shutil.copyfile(rutas[-1], REVISION / rutas[-1].name)
            assert not errores, errores
    return rutas


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for ruta in capturar(construir(Path(tmp) / "_site", "capturas", fotos=False)):
            print(ruta.relative_to(RAIZ))
