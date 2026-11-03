"""«Practicar más» de Ajustes en un navegador de verdad (Chromium headless con Playwright).

Se elige con chips (como mucho 3; con 3, los demás se desactivan), se dice cuánto más y se guarda en
el almacén. Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import json
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

# Sin nada guardado: la app empieza con el almacén vacío.
SEMBRAR = """<!doctype html><meta charset="utf-8">
<script>localStorage.clear(); window.listo = true;</script>"""


@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de Ajustes necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, SEMBRAR, 390, 844, barras=True) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        yield pagina
        assert not errores


def _guardado(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))["perfil"]["practicar"]


def _chip(pagina, movimiento):
    return pagina.locator(f'[data-practicar="{movimiento}"]')


def test_con_tres_elegidos_los_demas_se_desactivan_y_se_guarda(pagina):
    pagina.goto(f"{ORIGEN}/index.html#ajustes")
    pagina.wait_for_selector("#t-practicar")
    assert pagina.locator("[data-practicar]").count() == 17
    assert pagina.locator("[data-practicar]:disabled").count() == 0
    for m in ("6", "cuerpo", "rodar"):
        _chip(pagina, m).check()
    assert pagina.locator("[data-practicar]:disabled").count() == 14
    assert pagina.locator("[data-practicar]:checked").count() == 3
    pagina.locator('[data-movimiento="rodar"][data-cuanto="bastante"]').check()
    assert _guardado(pagina) == [{"movimiento": "6", "cuanto": "poco"}, {"movimiento": "cuerpo", "cuanto": "poco"},
                                 {"movimiento": "rodar", "cuanto": "bastante"}]
    assert pagina.locator(".cuanto-practicar legend").all_inner_texts() == [
        "6 gancho de derecha", "Golpes al cuerpo", "esquiva abajo"]
    # Al quitar uno se puede elegir otro; «Quitar todo» lo deja como al principio.
    _chip(pagina, "cuerpo").uncheck()
    assert pagina.locator("[data-practicar]:disabled").count() == 0
    pagina.click("#practicar-quitar")
    assert _guardado(pagina) == []
    assert pagina.locator(".lista-practicar").count() == 0
    assert pagina.evaluate("document.activeElement.id") == "t-practicar"


def test_nada_se_sale_de_la_pantalla_a_390(pagina):
    pagina.goto(f"{ORIGEN}/index.html#ajustes")
    pagina.wait_for_selector("#t-practicar")
    for m in ("3", "paso_atras", "salir"):
        _chip(pagina, m).check()
    ancho = pagina.evaluate("document.documentElement.clientWidth")
    assert pagina.evaluate("document.documentElement.scrollWidth") <= ancho
    derecha = pagina.evaluate("""() => Math.max(...[...document.querySelectorAll('#f-practicar .chip-opcion span')]
      .map((e) => e.getBoundingClientRect().right))""")
    assert derecha <= ancho
    pagina.click("#practicar-quitar")
