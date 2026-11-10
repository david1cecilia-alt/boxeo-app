"""El asa y el menú lateral de Entrenar (#entrenar/menu[/<seccion>]) en un navegador de verdad (Chromium
headless con Playwright), a 390 y 1440 px, con ratón y con toque emulado.

Toque, arrastre (umbral del 30 %, gesto rápido, menos de 8 px = toque), pointercancel, teclado, foco, Esc,
velo, «✕», «Atrás» y el historial (entrada propia con la marca `menu: true` → history.back(); llegada directa
→ location.replace). Solo en Entrenar, a ≥ 24 px de los bordes y sin animación con prefers-reduced-motion.
El menú todavía está vacío (la R4 lo llena). Los datos de prueba solo viven en el localStorage de este
Chromium. Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import mimetypes
import os
import time

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

SEMBRAR = """<!doctype html><meta charset="utf-8">
<script>localStorage.clear(); window.listo = true;</script>"""
ANCHOS = [390, 1440]
ALTO = {390: 844, 1440: 900}
DURACION = 0.22  # s de la transición del panel (vistas/menu.js)
ABIERTO = "document.getElementById('menu').open"
ESTA_ABIERTO = ("() => { const m = document.getElementById('menu'); return m.open && m.classList.contains('visible')"
                " && location.hash.startsWith('#entrenar/menu'); }")
ESTA_CERRADO = "() => !document.getElementById('menu').open"
FOCO = """() => { const e = document.activeElement;
  return e.id || (e.classList.contains('asa-panel') && 'asa-panel') || (e.classList.contains('menu-cerrar') && 'cerrar')
    || (e.tagName === 'SUMMARY' && 'summary:' + e.parentElement.dataset.seccion) || e.tagName; }"""


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas del menú necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.fixture(scope="module")
def navegador(sitio):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        navegador = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
                                      ignore_default_args=["--hide-scrollbars"])
        yield navegador
        navegador.close()


@pytest.fixture
def abrir_pagina(sitio, navegador):
    """Una página nueva (historial vacío) en su propio contexto: `toque` emula una pantalla táctil y
    `sin_movimiento`, prefers-reduced-motion."""
    contextos = []

    def servir(ruta):
        relativa = ruta.request.url.removeprefix(ORIGEN + "/").split("?")[0]
        if relativa == "__pagina__.html":
            return ruta.fulfill(body=SEMBRAR, content_type="text/html; charset=utf-8")
        fichero = sitio / relativa
        if not fichero.is_file():
            return ruta.fulfill(status=404)
        tipo = "text/javascript" if fichero.suffix == ".js" else mimetypes.guess_type(fichero.name)[0]
        ruta.fulfill(body=fichero.read_bytes(), content_type=tipo or "application/octet-stream")

    def nueva(ancho=390, ruta="#entrenar", toque=False, sin_movimiento=False):
        contexto = navegador.new_context(
            viewport={"width": ancho, "height": ALTO[ancho]}, device_scale_factor=1, has_touch=toque,
            reduced_motion="reduce" if sin_movimiento else "no-preference")
        pagina = contexto.new_page()
        pagina.errores = []
        pagina.on("pageerror", lambda e: pagina.errores.append(str(e)))
        pagina.route(f"{ORIGEN}/**", servir)
        contextos.append((contexto, pagina))
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        ir(pagina, ruta)
        return pagina

    yield nueva
    for contexto, pagina in contextos:
        contexto.close()
        assert not pagina.errores


def ir(pagina, ruta):
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    vista = ruta[1:].split("/")[0]
    pagina.wait_for_function(f"document.body.dataset.vista === '{vista}'")
    pagina.wait_for_selector(f"#vista-{vista} h1", state="visible")


def largo(pagina):
    return pagina.evaluate("history.length")


def centro(pagina, selector):
    caja = pagina.locator(selector).bounding_box()
    return caja["x"] + caja["width"] / 2, caja["y"] + caja["height"] / 2


class Dedo:
    """Arrastra con el ratón o con un dedo (toques de verdad por CDP: Chromium los convierte en eventos
    de puntero de tipo touch, con su touch-action). Los toques llevan su propia marca de tiempo (un paso =
    al menos 16 ms, como un móvil a 60 Hz), así que la velocidad al soltar no depende de lo que tarde
    Playwright en mandar cada evento."""

    def __init__(self, pagina, puntero):
        self.pagina, self.puntero = pagina, puntero
        self.cdp = pagina.context.new_cdp_session(pagina) if puntero == "touch" else None

    def _toque(self, tipo, x=None, y=None, ms=0):
        self.reloj += ms / 1000
        puntos = [] if x is None else [{"x": x, "y": y}]
        self.cdp.send("Input.dispatchTouchEvent", {"type": tipo, "touchPoints": puntos, "timestamp": self.reloj})

    def bajar(self, x, y):
        self.x, self.y = x, y
        self.reloj = time.time()
        if self.cdp:
            self._toque("touchStart", x, y)
        else:
            self.pagina.mouse.move(x, y)
            self.pagina.mouse.down()

    def mover(self, dx, pasos=10, pausa=0):
        x0 = self.x
        for i in range(1, pasos + 1):
            self.x = x0 + dx * i / pasos
            if self.cdp:
                self._toque("touchMove", self.x, self.y, ms=max(pausa, 16))
            else:
                self.pagina.mouse.move(self.x, self.y)
            if pausa:
                self.pagina.wait_for_timeout(pausa)

    def subir(self, espera=0):
        if self.cdp:
            self._toque("touchEnd", ms=max(espera, 1))
        else:
            self.pagina.mouse.up()

    def cancelar(self):
        assert self.cdp, "pointercancel se prueba con un dedo"
        self._toque("touchCancel", ms=16)

    def arrastrar(self, selector, dx, pasos=10, pausa=0, espera=0):
        self.bajar(*centro(self.pagina, selector))
        self.mover(dx, pasos, pausa)
        if espera:
            self.pagina.wait_for_timeout(espera)
        self.subir(espera)


def abrir_con_el_asa(pagina):
    pagina.click("#asa")
    pagina.wait_for_function(ESTA_ABIERTO)
    pagina.wait_for_timeout(DURACION * 1000 + 50)


def esperar_cerrado(pagina, hash_="#entrenar"):
    pagina.wait_for_function(ESTA_CERRADO)
    pagina.wait_for_function(f"location.hash === '{hash_}'")


# ---------- Toque ----------

@pytest.mark.parametrize("ancho", ANCHOS)
def test_tocar_el_asa_abre_y_el_asa_del_panel_o_la_x_cierran(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    assert pagina.get_attribute("#asa", "aria-expanded") == "false"
    assert not pagina.evaluate(ABIERTO)
    abrir_con_el_asa(pagina)
    assert pagina.get_attribute("#asa", "aria-expanded") == "true"
    assert pagina.evaluate("location.hash") == "#entrenar/menu"
    assert not pagina.is_visible("#asa")  # con el menú abierto, el panel trae la suya
    pagina.click(".asa-panel")
    esperar_cerrado(pagina)
    assert pagina.get_attribute("#asa", "aria-expanded") == "false"
    assert pagina.evaluate(FOCO) == "asa"
    abrir_con_el_asa(pagina)
    pagina.click(".menu-cerrar")
    esperar_cerrado(pagina)
    assert pagina.evaluate(FOCO) == "asa"


def test_el_menu_trae_sus_tres_secciones_vacias_con_personalizar_abierta(abrir_pagina):
    pagina = abrir_pagina()
    abrir_con_el_asa(pagina)
    secciones = pagina.locator("#menu details").evaluate_all(
        "(ds) => ds.map((d) => [d.dataset.seccion, d.querySelector('summary').textContent.trim(), d.open])")
    assert secciones == [["personalizar", "Personalizar sesión", True], ["combinaciones", "Mis combinaciones", False],
                         ["ajustes", "Ajustes", False]]
    assert pagina.get_attribute("#asa", "aria-controls") == "menu"
    assert pagina.get_attribute("#menu", "aria-labelledby") == "t-menu"


# ---------- Arrastre ----------

@pytest.mark.parametrize("puntero", ["mouse", "touch"])
@pytest.mark.parametrize("ancho", ANCHOS)
def test_arrastrar_el_asa_abre_un_arrastre_corto_no_y_el_panel_a_la_derecha_cierra(abrir_pagina, ancho, puntero):
    pagina = abrir_pagina(ancho, toque=puntero == "touch")
    dedo = Dedo(pagina, puntero)
    largo_antes = largo(pagina)
    # 40 px despacio (y quieto antes de soltar): vuelve, sin tocar el historial.
    dedo.arrastrar("#asa", -40, pasos=8, pausa=40, espera=150)
    pagina.wait_for_function(ESTA_CERRADO)
    assert pagina.evaluate("location.hash") == "#entrenar"
    assert largo(pagina) == largo_antes
    assert pagina.is_visible("#asa")
    # 200 px a la izquierda: se abre.
    dedo.arrastrar("#asa", -200, pasos=10, pausa=16, espera=150)
    pagina.wait_for_function(ESTA_ABIERTO)
    assert pagina.evaluate(FOCO) == "t-menu"
    pagina.wait_for_timeout(DURACION * 1000 + 50)
    # El panel 200 px a la derecha (desde su franja): se cierra.
    dedo.arrastrar(".asa-panel", 200, pasos=10, pausa=16, espera=150)
    esperar_cerrado(pagina)
    assert pagina.evaluate(FOCO) == "asa"
    # Y desde la cabecera, igual.
    abrir_con_el_asa(pagina)
    dedo.arrastrar("#t-menu", 200, pasos=10, pausa=16, espera=150)
    esperar_cerrado(pagina)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_mientras_se_arrastra_el_panel_sigue_al_dedo(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    dedo = Dedo(pagina, "mouse")
    dedo.bajar(*centro(pagina, "#asa"))
    dedo.mover(-160, pasos=8)
    asoma = pagina.evaluate("""() => { const p = document.querySelector('.menu-panel').getBoundingClientRect();
      return Math.round(document.documentElement.clientWidth - p.left); }""")
    assert 155 <= asoma <= 165  # pasa del 30 % también a 1440 (126 px de 420)
    assert pagina.evaluate("document.getElementById('menu').classList.contains('arrastrando')")
    pagina.wait_for_timeout(150)
    dedo.subir()
    pagina.wait_for_function(ESTA_ABIERTO)


def test_un_gesto_rapido_aunque_corto_abre_y_cierra(abrir_pagina):
    # Con el dedo y su reloj: 20 px cada 16 ms (1,25 px/ms), lejos del 30 % del ancho (103 px a 390).
    pagina = abrir_pagina(toque=True)
    dedo = Dedo(pagina, "touch")
    dedo.arrastrar("#asa", -60, pasos=3)
    pagina.wait_for_function(ESTA_ABIERTO)
    pagina.wait_for_timeout(DURACION * 1000 + 50)
    dedo.arrastrar(".asa-panel", 60, pasos=3)
    esperar_cerrado(pagina)
    # El mismo recorrido, despacio (20 px cada 100 ms), no abre.
    dedo.arrastrar("#asa", -60, pasos=3, pausa=100)
    pagina.wait_for_function(ESTA_CERRADO)
    pagina.wait_for_timeout(DURACION * 1000 + 50)
    assert pagina.evaluate("location.hash") == "#entrenar"


def test_moverse_menos_de_8_px_cuenta_como_toque(abrir_pagina):
    pagina = abrir_pagina()
    Dedo(pagina, "mouse").arrastrar("#asa", -5, pasos=2)
    pagina.wait_for_function(ESTA_ABIERTO)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_un_arrastre_que_acaba_en_pointercancel_vuelve_sin_tocar_el_historial(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho, toque=True)
    dedo = Dedo(pagina, "touch")
    largo_antes = largo(pagina)
    pagina.evaluate("""() => { window.__soltados = [];
      for (const t of ['pointercancel', 'lostpointercapture'])
        document.getElementById('asa').addEventListener(t, () => __soltados.push(t)); }""")
    dedo.bajar(*centro(pagina, "#asa"))
    dedo.mover(-150, pasos=10, pausa=16)
    assert pagina.evaluate(ABIERTO)  # a medio camino
    dedo.cancelar()
    pagina.wait_for_function(ESTA_CERRADO)
    assert "pointercancel" in pagina.evaluate("__soltados")
    assert pagina.evaluate("document.querySelector('.menu-panel').style.transform") == ""
    assert pagina.evaluate("location.hash") == "#entrenar"
    assert largo(pagina) == largo_antes
    assert pagina.get_attribute("#asa", "aria-expanded") == "false"
    # El asa se ve y responde.
    assert pagina.is_visible("#asa")
    pagina.tap("#asa")
    pagina.wait_for_function(ESTA_ABIERTO)
    pagina.wait_for_timeout(DURACION * 1000 + 50)
    # Cancelar a medias el arrastre del panel: vuelve a abierto, en la misma ruta.
    dedo.bajar(*centro(pagina, ".asa-panel"))
    dedo.mover(150, pasos=10, pausa=16)
    dedo.cancelar()
    pagina.wait_for_timeout(DURACION * 1000 + 50)
    assert pagina.evaluate(ESTA_ABIERTO)
    assert pagina.evaluate("getComputedStyle(document.querySelector('.menu-panel')).transform") == "none"
    assert pagina.evaluate("location.hash") == "#entrenar/menu"


# ---------- Teclado y foco ----------

@pytest.mark.parametrize("ancho", ANCHOS)
def test_teclado_tab_hasta_el_asa_intro_abre_tab_no_sale_y_esc_cierra(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    for _ in range(80):
        pagina.keyboard.press("Tab")
        if pagina.evaluate(FOCO) == "asa":
            break
    assert pagina.evaluate(FOCO) == "asa"
    pagina.keyboard.press("Enter")
    pagina.wait_for_function(ESTA_ABIERTO)
    assert pagina.evaluate(FOCO) == "t-menu"
    vistos = set()
    for _ in range(12):
        pagina.keyboard.press("Tab")
        assert pagina.evaluate("document.getElementById('menu').contains(document.activeElement)")
        vistos.add(pagina.evaluate(FOCO))
    assert {"cerrar", "summary:personalizar", "summary:ajustes"} <= vistos
    for _ in range(12):
        pagina.keyboard.press("Shift+Tab")
        assert pagina.evaluate("document.getElementById('menu').contains(document.activeElement)")
    pagina.keyboard.press("Escape")
    esperar_cerrado(pagina)
    assert pagina.evaluate(FOCO) == "asa"


@pytest.mark.parametrize("ancho", ANCHOS)
def test_el_foco_vuelve_al_asa_al_cerrar_por_x_esc_velo_y_arrastre(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    cierres = {
        "x": lambda: pagina.click(".menu-cerrar"),
        "esc": lambda: pagina.keyboard.press("Escape"),
        "velo": lambda: pagina.mouse.click(10, ALTO[ancho] / 2),
        "arrastre": lambda: Dedo(pagina, "mouse").arrastrar(".asa-panel", 200, pausa=16, espera=150),
    }
    for nombre, cerrar in cierres.items():
        abrir_con_el_asa(pagina)
        assert pagina.evaluate(FOCO) == "t-menu", nombre
        cerrar()
        esperar_cerrado(pagina)
        pagina.wait_for_function("document.activeElement.id === 'asa'")


def test_al_llegar_desde_otra_vista_el_foco_va_al_titulo_del_menu(abrir_pagina):
    pagina = abrir_pagina(ruta="#historial")
    pagina.evaluate("location.hash = '#entrenar/menu'")
    pagina.wait_for_function(ESTA_ABIERTO)
    assert pagina.evaluate(FOCO) == "t-menu"


@pytest.mark.parametrize("ancho", ANCHOS)
def test_con_el_menu_abierto_las_teclas_no_tocan_nada_de_debajo(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    foto = """() => JSON.stringify([...document.querySelectorAll('#config input')]
      .map((i) => [i.name, i.value, i.checked]))"""
    antes = pagina.evaluate(foto)
    abrir_con_el_asa(pagina)
    # Abrir y cerrar una sección con Espacio y con Intro.
    pagina.focus("#menu details[data-seccion='ajustes'] summary")
    pagina.keyboard.press("Space")
    assert pagina.evaluate("document.querySelector('[data-seccion=ajustes]').open")
    pagina.keyboard.press("Enter")
    assert not pagina.evaluate("document.querySelector('[data-seccion=ajustes]').open")
    # Las teclas de los atajos de la sesión (espacio = pausa, Esc = parar) y alguna más, desde el título.
    pagina.focus("#t-menu")
    for tecla in ["Space", "Enter", "p", "ArrowRight"]:
        pagina.keyboard.press(tecla)
    assert pagina.evaluate(ABIERTO)
    assert not pagina.evaluate("document.body.classList.contains('entrenando')")
    assert pagina.is_hidden("#pantalla")
    assert pagina.evaluate(foto) == antes
    pagina.keyboard.press("Escape")
    esperar_cerrado(pagina)
    assert not pagina.evaluate("document.body.classList.contains('entrenando')")
    assert pagina.evaluate(foto) == antes


# ---------- Historial (D4) ----------

@pytest.mark.parametrize("ancho", ANCHOS)
def test_atras_con_el_menu_abierto_lo_cierra_y_se_queda_en_entrenar(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    abrir_con_el_asa(pagina)
    pagina.go_back()
    esperar_cerrado(pagina)
    assert pagina.url.endswith("index.html#entrenar")
    pagina.wait_for_function("document.activeElement.id === 'asa'")


def test_llegar_directo_y_cerrar_sustituye_la_entrada_sin_salir_de_la_app(abrir_pagina):
    pagina = abrir_pagina(ruta="#entrenar/menu")
    pagina.wait_for_function(ESTA_ABIERTO)
    assert pagina.evaluate(FOCO) == "t-menu"
    largo_antes = largo(pagina)
    pagina.click(".menu-cerrar")
    esperar_cerrado(pagina)
    assert largo(pagina) == largo_antes
    assert pagina.url.endswith("index.html#entrenar")
    # La entrada del menú ya no existe: atrás sale de la app (a la página de siembra), no vuelve al menú.
    pagina.go_back()
    pagina.wait_for_url(f"{ORIGEN}/__pagina__.html")


def test_dos_esc_seguidos_pasan_por_el_mismo_cierre_y_no_salen_de_la_app(abrir_pagina):
    pagina = abrir_pagina()
    abrir_con_el_asa(pagina)
    largo_abierto = largo(pagina)
    pagina.evaluate("""() => { window.__cierres = 0;
      addEventListener('hashchange', () => window.__cierres++); }""")
    pagina.keyboard.press("Escape")
    pagina.keyboard.press("Escape")  # el segundo ya no se puede cancelar: el <dialog> se cierra solo
    esperar_cerrado(pagina)
    pagina.wait_for_timeout(300)
    assert pagina.url.endswith("index.html#entrenar")
    assert pagina.evaluate("window.__cierres") == 1
    assert largo(pagina) == largo_abierto
    # Adelante vuelve a abrirlo: la entrada propia sigue ahí, una sola vez.
    pagina.go_forward()
    pagina.wait_for_function(ESTA_ABIERTO)


def test_recargar_en_menu_ajustes_abre_esa_seccion(abrir_pagina):
    pagina = abrir_pagina(ruta="#entrenar/menu/ajustes")
    for _ in range(2):
        pagina.wait_for_function(ESTA_ABIERTO)
        abiertas = pagina.locator("#menu details").evaluate_all(
            "(ds) => ds.filter((d) => d.open).map((d) => d.dataset.seccion)")
        assert abiertas == ["ajustes"]
        assert pagina.evaluate(FOCO) == "t-menu"
        pagina.reload()
        pagina.wait_for_function("document.body.dataset.vista === 'entrenar'")


def test_recargar_tras_abrir_con_el_asa_conserva_la_entrada_propia(abrir_pagina):
    pagina = abrir_pagina()
    abrir_con_el_asa(pagina)
    largo_abierto = largo(pagina)
    pagina.reload()
    pagina.wait_for_function(ESTA_ABIERTO)
    pagina.click(".menu-cerrar")  # con la marca: atrás, no sustituir
    esperar_cerrado(pagina)
    assert largo(pagina) == largo_abierto
    pagina.go_forward()
    pagina.wait_for_function(ESTA_ABIERTO)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_menu_atras_adelante_y_cerrar_no_rompe_el_historial(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    abrir_con_el_asa(pagina)
    largo_abierto = largo(pagina)
    pagina.go_back()
    esperar_cerrado(pagina)
    pagina.go_forward()
    pagina.wait_for_function(ESTA_ABIERTO)
    pagina.wait_for_function("document.activeElement.id === 't-menu'")
    pagina.click(".menu-cerrar")
    esperar_cerrado(pagina)
    assert largo(pagina) == largo_abierto
    pagina.go_back()
    pagina.wait_for_url(f"{ORIGEN}/__pagina__.html")


def test_la_marca_menu_hace_que_cerrar_sea_atras_y_no_sustituir(abrir_pagina):
    pagina = abrir_pagina()
    abrir_con_el_asa(pagina)
    assert pagina.evaluate("history.state.menu") is True
    pagina.evaluate("location.hash = '#entrenar/mis-combinaciones'")
    pagina.wait_for_selector("#t-creador")
    assert not pagina.evaluate(ABIERTO)
    pagina.go_back()
    pagina.wait_for_function(ESTA_ABIERTO)
    largo_antes = largo(pagina)
    pagina.click(".menu-cerrar")
    esperar_cerrado(pagina)
    assert largo(pagina) == largo_antes
    # Fue history.back(): la entrada del menú sigue delante (con replace, adelante iría a Mis combinaciones).
    pagina.go_forward()
    pagina.wait_for_function(ESTA_ABIERTO)
    pagina.go_forward()
    pagina.wait_for_selector("#t-creador")


def test_menu_mis_combinaciones_editor_con_cambios_y_atras_tres_veces(abrir_pagina):
    # Riesgo 1 del plan: el «atrás» del menú y el del creador no chocan (en la R4, por el enlace del menú).
    pagina = abrir_pagina()
    abrir_con_el_asa(pagina)
    pagina.evaluate("location.hash = '#entrenar/mis-combinaciones'")
    pagina.wait_for_selector(".vacio-propias")
    pagina.click("#anadir-propia")
    pagina.wait_for_selector("#caja-combo")
    largo_antes = largo(pagina)
    pagina.click('[data-grupo="golpe"]')
    pagina.click('[data-anadir="jab"]')
    pagina.click('[data-anadir="directo"]')
    # 1.º atrás: pregunta; «Descartar» lleva al listado.
    pagina.go_back()
    pagina.wait_for_selector("#d-descartar[open]")
    pagina.click('#d-descartar button[value="descartar"]')
    pagina.wait_for_selector(".vacio-propias")
    pagina.wait_for_function("location.hash === '#entrenar/mis-combinaciones'")
    # 2.º atrás: el menú, abierto.
    pagina.go_back()
    pagina.wait_for_function(ESTA_ABIERTO)
    assert pagina.locator("#entrenar-sub *").count() == 0
    # 3.º atrás: Entrenar, con el menú cerrado.
    pagina.go_back()
    esperar_cerrado(pagina)
    assert pagina.locator("dialog[open]").count() == 0
    assert largo(pagina) == largo_antes


# ---------- Velo y scroll ----------

@pytest.mark.parametrize("ancho", ANCHOS)
def test_tocar_el_velo_cierra_y_con_el_menu_abierto_el_cuerpo_no_se_desplaza(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    abrir_con_el_asa(pagina)
    assert pagina.evaluate("getComputedStyle(document.documentElement).overflow") == "hidden"
    pagina.mouse.move(10, ALTO[ancho] / 2)
    pagina.mouse.wheel(0, 600)
    pagina.wait_for_timeout(100)
    assert pagina.evaluate("scrollY") == 0
    # Un clic dentro del panel (en un hueco sin controles) no cierra.
    caja = pagina.locator(".menu-panel").bounding_box()
    pagina.mouse.click(caja["x"] + caja["width"] - 20, caja["y"] + caja["height"] - 20)
    pagina.wait_for_timeout(100)
    assert pagina.evaluate(ABIERTO)
    pagina.mouse.click(10, ALTO[ancho] / 2)
    esperar_cerrado(pagina)
    assert pagina.evaluate("getComputedStyle(document.documentElement).overflow") != "hidden"


# ---------- Dónde se ve ----------

@pytest.mark.parametrize("ancho", ANCHOS)
def test_el_asa_queda_a_24_px_o_mas_de_los_bordes(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    caja = pagina.locator("#asa").bounding_box()
    util = pagina.evaluate("document.documentElement.clientWidth")
    assert caja["x"] >= 24
    assert util - (caja["x"] + caja["width"]) >= 24
    assert (caja["width"], caja["height"]) == (48, 72)


def test_el_asa_solo_esta_en_entrenar(abrir_pagina):
    pagina = abrir_pagina()
    for ruta in ["#aprende", "#historial", "#perfil"]:
        pagina.evaluate(f"location.hash = '{ruta}'")
        pagina.wait_for_selector(f"#vista-{ruta[1:]} h1", state="visible")
        assert pagina.is_hidden("#asa"), ruta
    pagina.evaluate("location.hash = '#entrenar/mis-combinaciones'")
    pagina.wait_for_selector("#t-creador")
    assert pagina.is_hidden("#asa")
    pagina.evaluate("location.hash = '#entrenar'")
    pagina.wait_for_selector("#asa", state="visible")
    # Durante la sesión no se ve, y la ruta del menú no lo abre.
    pagina.click("#empezar")
    pagina.wait_for_selector("#pantalla", state="visible")
    assert pagina.is_hidden("#asa")
    pagina.evaluate("location.hash = '#entrenar/menu'")
    pagina.wait_for_function("location.hash === '#entrenar'")
    assert not pagina.evaluate(ABIERTO)
    assert pagina.evaluate("document.body.classList.contains('entrenando')")
    pagina.click("#parar")
    pagina.wait_for_selector("#pantalla", state="hidden")


def test_salir_de_entrenar_con_el_menu_abierto_lo_cierra_y_la_pagina_responde(abrir_pagina):
    pagina = abrir_pagina()
    abrir_con_el_asa(pagina)
    pagina.evaluate("location.hash = '#historial'")  # como saltar con la lista del botón Atrás
    pagina.wait_for_selector("#vista-historial h1", state="visible")
    assert not pagina.evaluate(ABIERTO)
    assert pagina.evaluate("getComputedStyle(document.documentElement).overflow") != "hidden"
    pagina.click('#pestanas a[href="#aprende"]')
    pagina.wait_for_selector("#vista-aprende h1", state="visible")


# ---------- prefers-reduced-motion ----------

@pytest.mark.parametrize("ancho", ANCHOS)
def test_sin_movimiento_el_panel_abre_y_cierra_al_momento(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho, sin_movimiento=True)
    pagina.click("#asa")
    estado = pagina.evaluate("""() => { const p = document.querySelector('.menu-panel');
      return [getComputedStyle(p).transitionDuration, getComputedStyle(p).transform,
              Math.round(innerWidth - p.getBoundingClientRect().left) === p.offsetWidth]; }""")
    assert estado == ["0s", "none", True]
    pagina.click(".menu-cerrar")
    assert not pagina.evaluate(ABIERTO)  # sin esperar a ninguna transición
