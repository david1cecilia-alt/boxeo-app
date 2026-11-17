"""La preparación de 10 s antes del asalto 1 (V2), en Chromium headless con el reloj de Playwright: la cuenta atrás,
«Empezar ya», Pausa y Parar (sin guardar nada) y el fondo del ring (el vídeo de su orientación; la imagen con movimiento
reducido o si falla). Los datos de prueba solo viven en el localStorage de este Chromium. Sin Playwright se salta en local.
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
@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Estas pruebas necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


def abrir_app(sitio, movimiento=True, ancho=390, alto=844, reaccion=False):
    """Contexto con la app abierta en Entrenar (una Personalizada de 2 × 30 s), con el reloj parado."""
    contexto = abrir(sitio, VACIA, ancho, alto, barras=ancho > 800)
    pagina, errores = contexto.__enter__()
    sin_intro(pagina)
    pagina.add_init_script(VOZ_FALSA)
    pagina.emulate_media(reduced_motion="no-preference" if movimiento else "reduce")
    pagina.clock.install()
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    datos = {"version": 9, "perfil": {"sesion": {"tipo": "personalizada",
                                                "reaccion": reaccion,
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
    assert app.is_hidden("#preparacion") and app.is_hidden(".fondo-ring")  # el ring nítido se va (queda el borroso, de fondo)
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


ESTADO_VIDEO = """() => { const v = document.getElementById('video-ring');
  return { bucle: v.loop, parado: v.paused, falta: v.duration - v.currentTime, fuente: v.currentSrc, ancho: v.videoWidth }; }"""


def test_en_horizontal_el_video_sale_una_vez_y_se_queda_en_el_ultimo_fotograma(sitio):
    contexto, pagina, errores = abrir_app(sitio, ancho=1440, alto=900)
    try:
        pagina.click("#empezar")
        assert pagina.is_visible("#video-ring")
        pagina.wait_for_function("document.getElementById('video-ring').ended", timeout=20_000)
        estado = pagina.evaluate(ESTADO_VIDEO)
        assert not estado["bucle"] and estado["parado"] and estado["falta"] < 0.05
        # El Chromium de Playwright no trae H.264: coge el WebM, que va primero.
        assert estado["fuente"].endswith("video/ring-horizontal.webm") and estado["ancho"] == 1280
        assert pagina.is_visible("#video-ring") and fase(pagina) == "preparacion"  # sigue ahí, quieto
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_con_movimiento_reducido_solo_se_ve_la_imagen_y_no_se_pide_el_video(sitio, ancho, alto):
    contexto, pagina, errores = abrir_app(sitio, movimiento=False, ancho=ancho, alto=alto)
    try:
        pedidos = []
        pagina.on("request", lambda r: "/video/" in r.url and pedidos.append(r.url))
        pagina.click("#empezar")
        assert pagina.locator("#video-ring").count() == 0
        assert pagina.is_visible(".fondo-ring img") and fase(pagina) == "preparacion"
        pagina.clock.run_for(10_100)
        assert fase(pagina) == "asalto"
        assert pedidos == [] and not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("fallo", ["sin_red", "404"])
def test_si_el_video_no_llega_se_ve_la_imagen_y_la_preparacion_sigue(sitio, fallo):
    contexto, pagina, errores = abrir_app(sitio, ancho=1440, alto=900)
    try:
        # sw.js no guarda el vídeo: sin red, la petición falla tal cual (aquí, cortada o 404).
        pagina.route("**/video/**", lambda r: r.abort("internetdisconnected") if fallo == "sin_red"
                     else r.fulfill(status=404))
        pagina.click("#empezar")
        pagina.wait_for_function("!document.getElementById('video-ring')")  # quitado: se ve lo de debajo
        assert pagina.is_visible(".fondo-ring img") and fase(pagina) == "preparacion"
        pagina.clock.run_for(10_100)
        assert fase(pagina) == "asalto" and not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("ancho,alto,pedido,otro,medidas", [
    (390, 844, "ring-vertical", "ring-horizontal", (720, 1254)),
    (1440, 900, "ring-horizontal", "ring-vertical", (1280, 720)),
])
def test_cada_orientacion_pide_solo_su_video(sitio, ancho, alto, pedido, otro, medidas):
    contexto, pagina, errores = abrir_app(sitio, ancho=ancho, alto=alto)
    try:
        pedidos = []
        pagina.on("request", lambda r: "/video/" in r.url and pedidos.append(r.url))
        pagina.click("#empezar")
        assert pagina.is_visible("#video-ring")
        pagina.wait_for_function("document.getElementById('video-ring').ended", timeout=20_000)
        estado = pagina.evaluate(ESTADO_VIDEO)
        assert not estado["bucle"] and estado["parado"] and estado["falta"] < 0.05  # quieto en el último fotograma
        assert estado["fuente"].endswith(f"video/{pedido}.webm")
        assert (estado["ancho"], pagina.evaluate("document.getElementById('video-ring').videoHeight")) == medidas
        assert pedidos and all(pedido in u for u in pedidos) and not any(otro in u for u in pedidos)
        assert pagina.get_attribute("#video-ring", "poster") == "imagenes/ring-cenital.jpg"
        assert pagina.is_visible("#video-ring") and fase(pagina) == "preparacion"
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_el_ring_cubre_toda_la_pantalla(sitio, ancho, alto):
    contexto, pagina, errores = abrir_app(sitio, ancho=ancho, alto=alto)
    try:
        pagina.click("#empezar")
        ring, pantalla = pagina.locator(".fondo-ring").bounding_box(), pagina.locator("#pantalla").bounding_box()
        assert (ring["x"], ring["y"], ring["width"], ring["height"]) == (
            pantalla["x"], pantalla["y"], pantalla["width"], pantalla["height"])
        img = pagina.locator(".fondo-ring img").bounding_box()
        assert img["width"] == ring["width"] and img["height"] == ring["height"]
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


ESTILO_PARAR = """() => { const e = getComputedStyle(document.getElementById('parar'));
  return { sombra: e.boxShadow, borde: e.borderColor, fondo: e.backgroundColor, contorno: e.outlineStyle }; }"""


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_en_la_preparacion_el_foco_va_a_empezar_ya_y_parar_se_ve_como_en_el_asalto(sitio, ancho, alto):
    contexto, pagina, errores = abrir_app(sitio, ancho=ancho, alto=alto)
    try:
        pagina.focus("#empezar")
        pagina.keyboard.press("Enter")  # con el teclado: el foco se ve (focus-visible)
        assert pagina.evaluate("document.activeElement.id") == "empezar-ya"
        en_preparacion = pagina.evaluate(ESTILO_PARAR)
        assert en_preparacion["sombra"] == "none" and en_preparacion["contorno"] == "none"
        pagina.click("#pausa")
        assert fase(pagina) == "pausa" and pagina.evaluate(ESTILO_PARAR)["sombra"] == "none"  # en pausa, igual
        pagina.click("#pausa")
        pagina.click("#empezar-ya")
        assert fase(pagina) == "asalto"
        en_asalto = pagina.evaluate(ESTILO_PARAR)
        assert {**en_preparacion, "contorno": None} == {**en_asalto, "contorno": None}
        pagina.clock.run_for(21_000)  # a falta de 10 s: el fondo rojo, y Parar se distingue con su borde
        assert fase(pagina) == "final" and "inset" in pagina.evaluate(ESTILO_PARAR)["sombra"]
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_parar_lleva_borde_blanco_solo_en_los_ultimos_10_s_del_asalto(sitio, ancho, alto):
    contexto, pagina, errores = abrir_app(sitio, ancho=ancho, alto=alto, reaccion=True)
    try:
        def con_borde():
            return "inset" in pagina.evaluate(ESTILO_PARAR)["sombra"]
        vistas = {}
        pagina.click("#empezar")
        vistas[fase(pagina)] = con_borde()  # preparación
        pagina.click("#pausa")
        vistas["pausa en la preparación"] = con_borde()
        pagina.click("#pausa")
        pagina.click("#empezar-ya")
        for paso in range(360):  # la sesión entera (30 + 10 + 30 s), de 200 en 200 ms
            if pagina.is_hidden("#pantalla"):
                break
            if paso in (25, 225):  # una pausa en cada asalto
                pagina.click("#pausa")
                vistas.setdefault(fase(pagina), set()).add(con_borde())
                pagina.click("#pausa")
            vistas.setdefault(fase(pagina), set()).add(con_borde())
            pagina.clock.run_for(200)
        assert vistas.pop("preparacion") is False and vistas.pop("pausa en la preparación") is False
        assert set(vistas) == {"asalto", "reaccion", "final", "descanso", "pausa"}, vistas
        assert vistas.pop("final") == {True}
        assert all(v == {False} for v in vistas.values()), vistas
        assert not errores
    finally:
        contexto.__exit__(None, None, None)
