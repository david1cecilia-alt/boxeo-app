"""La preparación de 10 s antes del asalto 1 (V2), en Chromium headless con el reloj de Playwright: la cuenta atrás,
«Empezar ya», Pausa y Parar (sin guardar nada) y el fondo del ring (imagen; el vídeo, fuera con movimiento reducido o
si falla). Los datos de prueba solo viven en el localStorage de este Chromium. Sin Playwright se salta en local.
"""
import importlib.util
import json
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir
from tests.sin_intro import preparar as sin_intro

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
# Una voz que no suena y acaba a los 400 ms (el dictado espera a que termine cada frase).
VOZ_FALSA = """(() => {
  const falsa = {
    speaking: false, pending: false, onvoiceschanged: null,
    getVoices: () => [], addEventListener() {}, removeEventListener() {}, cancel() {},
    speak(frase) { setTimeout(() => frase.onend?.(), 400); },
  };
  Object.defineProperty(window, "speechSynthesis", { value: falsa, configurable: true });
})();"""
# Un <video> como el del comentario de index.html (sin ficheros: no carga).
CON_VIDEO = """() => document.querySelector('.fondo-ring').insertAdjacentHTML('afterbegin',
  '<video id="video-ring" muted playsinline preload="none"><source src="video/no-esta.mp4" type="video/mp4"></video>')"""


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Estas pruebas necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


def abrir_app(sitio, movimiento=True):
    """Contexto con la app abierta en Entrenar (una Personalizada de 2 × 30 s), con el reloj parado."""
    contexto = abrir(sitio, VACIA, 390, 844)
    pagina, errores = contexto.__enter__()
    sin_intro(pagina)
    pagina.add_init_script(VOZ_FALSA)
    pagina.emulate_media(reduced_motion="no-preference" if movimiento else "reduce")
    pagina.clock.install()
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    datos = {"version": 9, "perfil": {"sesion": {"tipo": "personalizada",
                                                "personalizada": {"asaltos": 2, "duracion_asalto": 30, "descanso": 10}},
                                      "pistas": {"asa": True}}}
    pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(datos))
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
    return contexto, pagina, errores


@pytest.fixture
def app(sitio):
    contexto, pagina, errores = abrir_app(sitio)
    yield pagina
    assert not errores
    contexto.__exit__(None, None, None)


def fase(pagina):
    return pagina.evaluate("document.getElementById('pantalla').dataset.fase")


def cuenta(pagina):
    return pagina.inner_text("#cuenta-atras")


def sesiones(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')")).get("sesiones", [])


def test_al_empezar_sale_la_preparacion_de_10_s_y_luego_el_asalto_1(app):
    app.click("#empezar")
    assert fase(app) == "preparacion" and cuenta(app) == "10"
    assert app.is_visible("#preparacion") and app.is_visible("#empezar-ya") and app.is_visible(".fondo-ring img")
    assert app.is_hidden("#tiempo") and app.is_hidden(".tarjeta-combo")
    assert app.text_content("#fase") == "Prepárate"
    app.clock.run_for(4100)
    assert cuenta(app) == "6"
    app.clock.run_for(5000)
    assert fase(app) == "preparacion" and cuenta(app) == "1"
    app.clock.run_for(1000)
    assert fase(app) == "asalto"
    assert app.is_hidden("#preparacion") and app.is_hidden(".fondo-ring")  # en el asalto no hay ring
    assert app.inner_text("#tiempo") in ("0:30", "0:29")


def test_empezar_ya_salta_al_asalto_1_al_momento(app):
    app.click("#empezar")
    app.clock.run_for(2000)
    app.click("#empezar-ya")
    assert fase(app) == "asalto" and app.is_hidden("#preparacion")
    assert app.inner_text("#tiempo") == "0:30"
    app.clock.run_for(10_100)
    assert app.inner_text("#tiempo") == "0:20"  # el asalto no espera a los 10 s de la preparación


def test_la_pausa_para_la_cuenta_atras(app):
    app.click("#empezar")
    app.clock.run_for(3000)
    app.click("#pausa")
    assert fase(app) == "pausa" and app.is_visible("#preparacion")
    app.clock.run_for(20_000)
    assert cuenta(app) == "7"
    app.click("#pausa")
    assert cuenta(app) == "7"  # sigue donde se quedó
    app.clock.run_for(6500)
    assert fase(app) == "preparacion"
    app.clock.run_for(1500)  # el tic es cada 100 ms: margen de sobra
    assert fase(app) == "asalto"


def test_parar_en_la_preparacion_no_guarda_nada_en_el_historial(app):
    app.click("#empezar")
    app.clock.run_for(5000)
    app.click("#parar")
    assert app.is_hidden("#pantalla")
    assert not app.evaluate("document.body.classList.contains('entrenando')")
    app.clock.run_for(15_000)  # la preparación no sigue por detrás
    assert sesiones(app) == []
    assert app.is_hidden("#postsesion")


def test_la_preparacion_no_tiene_ajuste_en_el_menu(app):
    app.evaluate("location.hash = '#entrenar/menu/personalizar'")
    app.wait_for_selector("#t-menu", state="visible")
    assert "prepara" not in app.inner_text("#menu").lower()


@pytest.mark.parametrize("movimiento", [False, True])
def test_sin_video_que_cargue_o_con_movimiento_reducido_se_ve_la_imagen_y_la_preparacion_sigue(sitio, movimiento):
    contexto, pagina, errores = abrir_app(sitio, movimiento=movimiento)
    try:
        pagina.evaluate(CON_VIDEO)
        pagina.click("#empezar")
        pagina.wait_for_function("!document.getElementById('video-ring')")  # quitado (reducido o sin fichero)
        assert pagina.is_visible(".fondo-ring img")
        assert fase(pagina) == "preparacion"
        pagina.clock.run_for(10_100)
        assert fase(pagina) == "asalto"
        assert not errores
    finally:
        contexto.__exit__(None, None, None)
