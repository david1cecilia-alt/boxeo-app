"""La pantalla de la sesión ocupa la ventana desde arriba, en un navegador de verdad (Chromium headless con
Playwright), a 390×844 y 1440×900, en asalto y en descanso.

Antes, el relleno de arriba de Entrenar seguía puesto durante la sesión: quedaba una franja del fondo encima de
la pantalla de fase (se veía en el descanso, que es verde) y la página se desplazaba ese tanto.

Una Prueba (2 × 30 s) con el reloj de Playwright parado y una semilla fija, para que salga siempre la misma
combinación. Con una combinación muy larga, a 900 px de alto el reloj y la tarjeta de la combinación aún no caben
y Pausa / Parar quedan por debajo: eso es de la fase visual (7.2 del plan del rediseño), no de esta franja.
Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir
from tests.sin_intro import preparar

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
SEMILLA = """const _g = crypto.getRandomValues.bind(crypto);
crypto.getRandomValues = (a) => (a instanceof Uint32Array && a.length === 1 ? (a[0] = 7, a) : _g(a));"""
INICIO = 1_800_000_000_000
# (segundos desde Empezar, fase): la Prueba no tiene preparación; el descanso dura 15 s.
MOMENTOS = [(12, "asalto"), (32, "descanso")]


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de la sesión necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.mark.parametrize("segundos,fase", MOMENTOS)
@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_la_pantalla_de_la_sesion_empieza_arriba_y_la_pagina_no_se_desplaza(sitio, ancho, alto, segundos, fase):
    with abrir(sitio, VACIA, ancho, alto, barras=ancho > 800) as (pagina, errores):
        preparar(pagina)
        pagina.add_init_script(SEMILLA)
        pagina.emulate_media(reduced_motion="reduce")
        pagina.clock.install(time=INICIO)
        pagina.clock.pause_at(INICIO)
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        pagina.goto(f"{ORIGEN}/index.html?prueba#entrenar")
        pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
        pagina.click('#tipo-sesion label:has(input[value="prueba"])')
        pagina.click("#empezar")
        pagina.clock.run_for(segundos * 1000)
        assert pagina.evaluate("document.getElementById('pantalla').dataset.fase") == fase
        assert pagina.evaluate("document.getElementById('pantalla').getBoundingClientRect().top") == 0
        assert pagina.evaluate("document.documentElement.scrollHeight") <= alto
        # Pausa y Parar, enteros a la vista.
        assert pagina.evaluate("document.querySelector('#pantalla .controles').getBoundingClientRect().bottom") <= alto
        assert not errores
