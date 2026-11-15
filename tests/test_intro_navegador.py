"""La intro «QUE EMPIECE EL ASALTO» (static/intro.js, plan del rediseño 3.6) en un navegador de verdad (Chromium
headless con Playwright), a 390 y 1440 px.

Sale en un arranque en frío y no al recargar en la misma sesión; no sale con prefers-reduced-motion; sí si
sessionStorage falla; sale del DOM en ≤ 2,2 s; el toque (ratón o dedo) o la tecla que la salta no llega a
lo de debajo; es decorativa (aria-hidden, no roba el foco); a 320 px no hay desplazamiento horizontal.

El tiempo lo lleva el reloj de Playwright (page.clock), parado al cargar: nada de esperas fijas. La pista
del asa se da por vista (tests/sin_intro.py con intro=True). Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import mimetypes
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN
from tests.sin_intro import preparar

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

ANCHOS = [390, 1440]
ALTO = {320: 640, 390: 844, 1440: 900}
INICIO = 1_800_000_000_000  # ms: la hora del reloj de prueba (da igual cuál)
HAY_INTRO = "document.getElementById('intro') !== null"
EN_SESION = "document.body.classList.contains('entrenando')"
LETRAS = "QUEEMPIECEELASALTO"
# sessionStorage que lanza error al tocarlo (navegador con el almacenamiento bloqueado).
SIN_SESSION_STORAGE = """Object.defineProperty(window, 'sessionStorage', {
  configurable: true, get() { throw new DOMException('bloqueado', 'SecurityError'); } });"""


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de la intro necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.fixture(scope="module")
def navegador(sitio):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        navegador = p.chromium.launch()
        yield navegador
        navegador.close()


@pytest.fixture
def abrir_app(sitio, navegador):
    """Abre la app en un contexto nuevo (arranque en frío) con el reloj parado. `toque`: pantalla táctil;
    `sin_movimiento`: prefers-reduced-motion; `antes`: un init script más."""
    contextos = []

    def servir(ruta):
        fichero = sitio / ruta.request.url.removeprefix(ORIGEN + "/").split("?")[0].split("#")[0]
        if not fichero.is_file():
            return ruta.fulfill(status=404)
        tipo = "text/javascript" if fichero.suffix == ".js" else mimetypes.guess_type(fichero.name)[0]
        ruta.fulfill(body=fichero.read_bytes(), content_type=tipo or "application/octet-stream")

    def nueva(ancho=390, ruta="#entrenar", toque=False, sin_movimiento=False, antes=None):
        contexto = navegador.new_context(
            viewport={"width": ancho, "height": ALTO[ancho]}, device_scale_factor=1, has_touch=toque,
            reduced_motion="reduce" if sin_movimiento else "no-preference")
        pagina = contexto.new_page()
        pagina.errores = []
        pagina.on("pageerror", lambda e: pagina.errores.append(str(e)))
        contextos.append((contexto, pagina))
        preparar(pagina, intro=True)
        if antes:
            pagina.add_init_script(antes)
        pagina.clock.install(time=INICIO)
        pagina.clock.pause_at(INICIO)
        pagina.route(f"{ORIGEN}/**", servir)
        ir(pagina, ruta)
        return pagina

    yield nueva
    for contexto, pagina in contextos:
        contexto.close()
        assert not pagina.errores


def ir(pagina, ruta="#entrenar"):
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    vista = ruta[1:].split("/")[0]
    pagina.wait_for_function(f"document.body.dataset.vista === '{vista}'")
    if vista == "entrenar":
        pagina.wait_for_selector('#tipo-sesion input[name="tipo"]:checked', state="attached")


def centro(pagina, selector):
    caja = pagina.locator(selector).bounding_box()
    return caja["x"] + caja["width"] / 2, caja["y"] + caja["height"] / 2


@pytest.mark.parametrize("ancho", ANCHOS)
def test_sale_en_un_arranque_en_frio_con_cada_letra_en_su_span(abrir_app, ancho):
    pagina = abrir_app(ancho)
    assert pagina.evaluate(HAY_INTRO)
    letras = pagina.locator("#intro .intro-letra")
    assert "".join(letras.all_inner_texts()) == LETRAS  # los espacios no son letras
    assert pagina.locator("#intro").inner_text().split() == ["QUE", "EMPIECE", "EL", "ASALTO"]
    assert letras.evaluate_all("ls => ls.map((l) => l.style.getPropertyValue('--i'))") == [str(i) for i in range(18)]
    assert pagina.locator("#intro").is_visible()


@pytest.mark.parametrize("ancho", ANCHOS)
def test_es_decorativa_y_no_roba_el_foco(abrir_app, ancho):
    pagina = abrir_app(ancho)
    assert pagina.get_attribute("#intro", "aria-hidden") == "true"
    assert pagina.evaluate("document.activeElement === document.body")
    assert pagina.locator("#intro [tabindex], #intro button, #intro a").count() == 0


@pytest.mark.parametrize("ancho", ANCHOS)
def test_sale_del_dom_en_como_mucho_2_2_s_y_avisa_al_acabar(abrir_app, ancho):
    pagina = abrir_app(ancho)
    pagina.evaluate("document.addEventListener('intro-fin', () => (window.introAcabada = true))")
    pagina.clock.run_for(1400)
    assert pagina.evaluate(HAY_INTRO)  # aún apagando letras
    pagina.clock.run_for(800)  # 2,2 s
    assert not pagina.evaluate(HAY_INTRO)
    assert pagina.evaluate("window.introAcabada === true")
    assert not pagina.evaluate("document.documentElement.matches('.con-intro, .intro-acercando')")


@pytest.mark.parametrize("ancho", ANCHOS)
def test_no_sale_al_recargar_en_la_misma_sesion(abrir_app, ancho):
    pagina = abrir_app(ancho)
    pagina.clock.run_for(2200)
    pagina.reload()
    pagina.wait_for_selector('#tipo-sesion input[name="tipo"]:checked', state="attached")
    assert not pagina.evaluate(HAY_INTRO)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_no_sale_con_prefers_reduced_motion(abrir_app, ancho):
    pagina = abrir_app(ancho, sin_movimiento=True)
    assert not pagina.evaluate(HAY_INTRO)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_sale_aunque_sessionstorage_lance_error(abrir_app, ancho):
    pagina = abrir_app(ancho, antes=SIN_SESSION_STORAGE)
    assert pagina.evaluate("(() => { try { sessionStorage; return false; } catch { return true; } })()")
    assert pagina.evaluate(HAY_INTRO)
    pagina.clock.run_for(2200)
    assert not pagina.evaluate(HAY_INTRO)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_un_clic_durante_la_intro_sobre_empezar_no_empieza_y_la_quita(abrir_app, ancho):
    pagina = abrir_app(ancho)
    pagina.clock.run_for(500)
    pagina.mouse.click(*centro(pagina, "#empezar"))
    pagina.clock.run_for(200)  # el fundido de 150 ms
    assert not pagina.evaluate(HAY_INTRO)
    assert not pagina.evaluate(EN_SESION)
    assert pagina.evaluate("location.hash") == "#entrenar"
    assert pagina.evaluate("document.activeElement === document.body")  # ni siquiera le dio el foco
    # Después, Empezar funciona con normalidad.
    pagina.mouse.click(*centro(pagina, "#empezar"))
    assert pagina.evaluate(EN_SESION)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_pulsar_durante_la_intro_y_soltar_ya_sin_ella_tampoco_empieza(abrir_app, ancho):
    # El clic que sigue al pointerdown que la saltó llega cuando la capa ya no está: también se traga.
    pagina = abrir_app(ancho)
    pagina.clock.run_for(500)
    pagina.mouse.move(*centro(pagina, "#empezar"))
    pagina.mouse.down()
    pagina.clock.run_for(200)
    assert not pagina.evaluate(HAY_INTRO)
    pagina.mouse.up()
    assert not pagina.evaluate(EN_SESION)
    pagina.mouse.click(*centro(pagina, "#empezar"))  # el siguiente clic ya es normal
    assert pagina.evaluate(EN_SESION)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_un_toque_con_el_dedo_durante_la_intro_sobre_empezar_no_empieza(abrir_app, ancho):
    pagina = abrir_app(ancho, toque=True)
    pagina.clock.run_for(500)
    pagina.locator("#empezar").tap(force=True)  # force: la intro está encima, que es lo que se prueba
    pagina.clock.run_for(200)
    assert not pagina.evaluate(HAY_INTRO)
    assert not pagina.evaluate(EN_SESION)
    pagina.locator("#empezar").tap()
    assert pagina.evaluate(EN_SESION)


@pytest.mark.parametrize("tecla", ["Enter", " "])
@pytest.mark.parametrize("ancho", ANCHOS)
def test_intro_o_espacio_durante_la_intro_no_pulsan_lo_que_tiene_el_foco(abrir_app, ancho, tecla):
    pagina = abrir_app(ancho)
    pagina.focus("#empezar")
    pagina.keyboard.press(tecla)
    pagina.clock.run_for(200)
    assert not pagina.evaluate(HAY_INTRO)
    assert not pagina.evaluate(EN_SESION)
    pagina.keyboard.press(tecla)  # ya sin intro, la misma tecla sí lo pulsa
    assert pagina.evaluate(EN_SESION)


def test_al_saltarla_mientras_se_desvanece_no_vuelve_a_encenderse(abrir_app):
    pagina = abrir_app()
    pagina.clock.run_for(1700)
    pagina.evaluate("document.getAnimations().forEach((a) => { a.pause(); a.currentTime = 1700; })")
    antes = float(pagina.evaluate("getComputedStyle(document.getElementById('intro')).opacity"))
    pagina.mouse.click(10, 10)
    pagina.evaluate("document.getAnimations().forEach((a) => a.pause())")
    despues = float(pagina.evaluate("getComputedStyle(document.getElementById('intro')).opacity"))
    assert antes < 1 and despues <= antes + 0.01


@pytest.mark.parametrize("ruta", ["#entrenar", "#historial"])
def test_la_vista_de_debajo_se_acerca_pero_nunca_el_asa_ni_la_barra(abrir_app, ruta):
    pagina = abrir_app(390, ruta=ruta)
    pagina.clock.run_for(1500)
    nombres = """(sel) => [...document.querySelectorAll(sel)].flatMap((el) => el.getAnimations())
      .map((a) => a.animationName)"""
    vista = ruta[1:]
    assert "intro-acercar" in pagina.evaluate(nombres, f"#vista-{vista} > *")
    assert "intro-acercar" not in pagina.evaluate(nombres, "#asa, #pestanas, #pestanas *, #menu")


@pytest.mark.parametrize("momento", [0, 900, 1700])
def test_a_320_px_no_hay_desplazamiento_horizontal(abrir_app, momento):
    pagina = abrir_app(320)
    pagina.clock.run_for(momento)
    pagina.evaluate("(t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; })", momento)
    assert pagina.evaluate(HAY_INTRO)
    assert pagina.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    caja = pagina.locator("#intro .intro-lema").bounding_box()
    assert caja["x"] >= 0 and caja["x"] + caja["width"] <= 320 or momento == 1700  # al final, la cámara entra
