"""El asa y el menú lateral de Entrenar (#entrenar/menu[/<seccion>]) en un navegador de verdad (Chromium
headless con Playwright), a 390 y 1440 px, con ratón y con toque emulado.

Toque, arrastre (más de la mitad a la vista al soltar despacio, el sentido de un gesto rápido, menos de 8 px = toque), pointercancel, teclado, foco, Esc,
velo, «✕», «Atrás» y el historial (entrada propia con la marca `menu: true` → history.back(); llegada directa
→ location.replace). Solo en Entrenar, a ≥ 24 px de los bordes y sin animación con prefers-reduced-motion.
El menú todavía está vacío (la R4 lo llena). Los datos de prueba solo viven en el localStorage de este
Chromium. Sin Playwright se salta en local; en CI falla.
"""
import base64
import importlib.util
import mimetypes
import os
import time

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN
from tests.menu_quieto import esperar_menu_quieto
from tests.sin_intro import preparar

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

SEMBRAR = """<!doctype html><meta charset="utf-8">
<script>localStorage.clear(); window.listo = true;</script>"""
ANCHOS = [390, 1440]
ALTO = {390: 844, 1440: 900}
DURACION = 0.3  # s de la transición del panel (vistas/menu.js)
INICIO = 1_800_000_000_000  # ms: la hora del reloj de prueba de la pista (da igual cuál)
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

    def nueva(ancho=390, ruta="#entrenar", toque=False, sin_movimiento=False, pista=False, intro=False, reloj=False):
        """`pista` / `intro`: las deja salir (tests/sin_intro.py); `reloj`: el de Playwright, parado al cargar."""
        contexto = navegador.new_context(
            viewport={"width": ancho, "height": ALTO[ancho]}, device_scale_factor=1, has_touch=toque,
            reduced_motion="reduce" if sin_movimiento else "no-preference")
        pagina = contexto.new_page()
        preparar(pagina, intro=intro, pista=pista)
        if reloj:
            pagina.clock.install(time=INICIO)
            pagina.clock.pause_at(INICIO)
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
    if ruta.startswith("#entrenar/menu"):
        esperar_menu_quieto(pagina)


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
    esperar_menu_quieto(pagina)


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


def test_el_menu_trae_sus_tres_secciones_con_personalizar_abierta(abrir_pagina):
    pagina = abrir_pagina()
    abrir_con_el_asa(pagina)
    secciones = pagina.locator("#menu details").evaluate_all(
        "(ds) => ds.map((d) => [d.dataset.seccion, d.querySelector('summary').textContent.trim(), d.open])")
    assert secciones == [["personalizar", "Personalizar sesión", True], ["combinaciones", "Mis combinaciones", False],
                         ["ajustes", "Ajustes", False]]
    # Cada una con lo suyo dentro.
    for seccion, control in (("personalizar", "#f-practicar"), ("combinaciones", "#ir-creador"), ("ajustes", "#voz-id")):
        assert pagina.locator(f"#menu details[data-seccion='{seccion}'] {control}").count() == 1, seccion
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
    # 260 px a la izquierda (más de la mitad del panel también a 1440, de 420 px): se abre.
    dedo.arrastrar("#asa", -260, pasos=10, pausa=16, espera=150)
    pagina.wait_for_function(ESTA_ABIERTO)
    assert pagina.evaluate(FOCO) == "t-menu"
    esperar_menu_quieto(pagina)
    # El panel 260 px a la derecha (desde su franja): se cierra.
    dedo.arrastrar(".asa-panel", 260, pasos=10, pausa=16, espera=150)
    esperar_cerrado(pagina)
    assert pagina.evaluate(FOCO) == "asa"
    # Y desde la cabecera, igual.
    abrir_con_el_asa(pagina)
    dedo.arrastrar("#t-menu", 260, pasos=10, pausa=16, espera=150)
    esperar_cerrado(pagina)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_mientras_se_arrastra_el_panel_sigue_al_dedo(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    dedo = Dedo(pagina, "mouse")
    dedo.bajar(*centro(pagina, "#asa"))
    dedo.mover(-240, pasos=8)
    # Cuánto asoma desde el borde derecho del <dialog> (su contenedor; con scrollbar-gutter, clientWidth no lo es).
    asoma = pagina.evaluate("""() => { const p = document.querySelector('.menu-panel').getBoundingClientRect();
      return Math.round(document.getElementById('menu').getBoundingClientRect().right - p.left); }""")
    assert 235 <= asoma <= 245  # 1:1 con el dedo; más de la mitad también a 1440 (210 px de 420)
    assert pagina.evaluate("document.getElementById('menu').classList.contains('arrastrando')")
    pagina.wait_for_timeout(150)
    dedo.subir()
    pagina.wait_for_function(ESTA_ABIERTO)


def test_un_gesto_rapido_aunque_corto_abre_y_cierra(abrir_pagina):
    # Con el dedo y su reloj: 20 px cada 16 ms (1,25 px/ms), lejos de la mitad del ancho (171 px a 390).
    pagina = abrir_pagina(toque=True)
    dedo = Dedo(pagina, "touch")
    dedo.arrastrar("#asa", -60, pasos=3)
    esperar_menu_quieto(pagina)
    dedo.arrastrar(".asa-panel", 60, pasos=3)
    esperar_cerrado(pagina)
    # El mismo recorrido, despacio (20 px cada 100 ms), no abre.
    dedo.arrastrar("#asa", -60, pasos=3, pausa=100)
    pagina.wait_for_function(ESTA_CERRADO)
    pagina.wait_for_timeout(DURACION * 1000 + 50)  # espera fija a propósito: que no se abra después
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
    esperar_menu_quieto(pagina)
    # Cancelar a medias el arrastre del panel: vuelve a abierto, en la misma ruta.
    dedo.bajar(*centro(pagina, ".asa-panel"))
    dedo.mover(150, pasos=10, pausa=16)
    dedo.cancelar()
    esperar_menu_quieto(pagina)
    assert pagina.evaluate(ESTA_ABIERTO)
    assert pagina.evaluate("getComputedStyle(document.querySelector('.menu-panel')).transform") == "none"
    assert pagina.evaluate("location.hash") == "#entrenar/menu"


# ---------- Los controles de dentro no se pelean con el arrastre ----------

@pytest.mark.parametrize("puntero", ["mouse", "touch"])
def test_arrastrar_el_deslizador_del_ritmo_no_mueve_ni_cierra_el_panel(abrir_pagina, puntero):
    pagina = abrir_pagina(390)
    abrir_con_el_asa(pagina)
    pagina.locator("#ritmo").scroll_into_view_if_needed()
    antes = pagina.input_value("#ritmo")
    caja = pagina.locator("#ritmo").bounding_box()
    dedo = Dedo(pagina, puntero)
    dedo.bajar(caja["x"] + caja["width"] / 2, caja["y"] + caja["height"] / 2)
    dedo.mover(caja["width"] / 2 - 4, pasos=8, pausa=16)  # hacia la derecha: el gesto que cerraría el panel
    dedo.subir()
    pagina.wait_for_timeout(DURACION * 1000 + 50)  # espera fija a propósito: que no se cierre después
    assert pagina.evaluate(ABIERTO) and pagina.evaluate("location.hash") == "#entrenar/menu"
    assert pagina.evaluate("getComputedStyle(document.querySelector('.menu-panel')).transform") == "none"
    assert pagina.input_value("#ritmo") != antes


def test_desplazar_el_panel_en_vertical_no_lo_cierra(abrir_pagina):
    pagina = abrir_pagina(390)
    abrir_con_el_asa(pagina)
    pagina.mouse.move(*centro(pagina, "#f-practicar"))
    pagina.mouse.wheel(0, 600)
    pagina.wait_for_function("document.querySelector('.menu-contenido').scrollTop > 0")
    assert pagina.evaluate("window.scrollY") == 0  # la página de detrás, quieta
    assert pagina.evaluate(ABIERTO) and pagina.evaluate("location.hash") == "#entrenar/menu"
    # La cabecera sigue a la vista (fija arriba): se puede cerrar o arrastrar desde ella.
    assert pagina.locator(".menu-cerrar").bounding_box()["y"] >= 0


# Los colores [r, g, b] de unos puntos de una captura de la página, leídos en un canvas (sin Pillow).
PIXELES = """async ([png, puntos]) => {
  const img = new Image();
  img.src = `data:image/png;base64,${png}`;
  await img.decode();
  const lienzo = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
  const ctx = lienzo.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return puntos.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3));
}"""


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900), (1440, 1400)])
def test_el_velo_del_menu_cubre_toda_la_ventana_con_el_mismo_tono(abrir_pagina, ancho, alto):
    pagina = abrir_pagina(ancho)
    pagina.set_viewport_size({"width": ancho, "height": alto})
    abrir_con_el_asa(pagina)
    pagina.wait_for_function("getComputedStyle(document.getElementById('menu')).backgroundColor === 'rgba(0, 0, 0, 0.7)'")
    # El <dialog> (el velo) ocupa la ventana entera y lo que oscurece, el body, también llega abajo del todo:
    # si acabara con el contenido, por debajo se vería el lienzo (del color del panel) bajo el velo.
    assert pagina.evaluate("(() => { const r = document.getElementById('menu').getBoundingClientRect();"
                           " return [r.left, r.top, r.right >= innerWidth - 20, r.bottom]; })()") == [0, 0, True, alto]
    assert pagina.evaluate("document.body.getBoundingClientRect().bottom") >= alto
    # Y se ve igual: fuera del panel, arriba y abajo del todo (huecos sin contenido), el mismo gris oscurecido.
    x = 20 if ancho < 800 else 900
    png = base64.b64encode(pagina.screenshot()).decode()
    arriba, abajo = pagina.evaluate(PIXELES, [png, [[x, 5], [x, alto - 5]]])
    assert arriba == abajo, (arriba, abajo)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_con_el_panel_desplazado_el_titulo_se_ve_entero(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)
    abrir_con_el_asa(pagina)
    esperar_menu_quieto(pagina)
    antes = pagina.locator("#t-menu").bounding_box()
    pagina.evaluate("document.querySelector('.menu-contenido').scrollTop = 600")
    pagina.wait_for_function("document.querySelector('.menu-contenido').scrollTop > 0")
    titulo = pagina.locator("#t-menu").bounding_box()
    contenido = pagina.locator(".menu-contenido").bounding_box()
    # Dentro del panel (antes, con top negativo, la parte de arriba de «MENÚ» quedaba fuera y se cortaba)
    # y en el mismo sitio que sin desplazar.
    assert titulo["y"] >= contenido["y"] >= 0
    assert abs(titulo["y"] - antes["y"]) < 1


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
    for _ in range(60):  # Personalizar sesión, abierta, trae unos 20 controles
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
        "arrastre": lambda: Dedo(pagina, "mouse").arrastrar(".asa-panel", 260, pausa=16, espera=150),
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


# Riesgo 1 (menú → Mis combinaciones → editor con cambios → atrás), con el enlace real del menú: en
# tests/test_creador_navegador.py (test_menu_mis_combinaciones_editor_con_cambios_y_atras).


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
    # Contra el borde del <dialog> y no innerWidth: con barra clásica, el hueco de scrollbar-gutter queda fuera.
    estado = pagina.evaluate("""() => { const p = document.querySelector('.menu-panel');
      const borde = document.getElementById('menu').getBoundingClientRect().right;
      return [getComputedStyle(p).transitionDuration, getComputedStyle(p).transform,
              Math.round(borde - p.getBoundingClientRect().left) === p.offsetWidth]; }""")
    assert estado == ["0s", "none", True]
    pagina.click(".menu-cerrar")
    assert not pagina.evaluate(ABIERTO)  # sin esperar a ninguna transición


# ---------- La pista de la primera vez (plan del rediseño, 3.5) ----------
# Con el reloj de Playwright parado: la lengüeta dura 1,7 s y el globo, 4 s (con o sin movimiento).

GLOBO = "() => !document.getElementById('pista-asa').hidden"
LENGUETA = "() => !document.querySelector('.pista-panel').hidden"
PISTA_VISTA = "() => JSON.parse(localStorage.getItem('boxeo') ?? 'null')?.perfil.pistas.asa === true"


def hay(pagina, condicion):
    return pagina.evaluate(condicion)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_la_pista_sale_una_vez_tras_la_intro_y_se_guarda(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho, pista=True, intro=True, reloj=True)
    assert hay(pagina, "() => document.getElementById('intro') !== null")
    assert not hay(pagina, GLOBO) and not hay(pagina, PISTA_VISTA)  # durante la intro, todavía no
    pagina.clock.run_for(2000)  # acaba la intro
    pagina.wait_for_function(GLOBO)
    assert hay(pagina, LENGUETA) and hay(pagina, PISTA_VISTA)
    assert pagina.get_attribute("#pista-asa", "role") == "note"
    assert pagina.inner_text("#pista-asa") == "Desliza o toca para personalizar tu sesión"
    assert pagina.get_attribute(".pista-panel", "class").split() == ["pista-panel", "asomando"]
    pagina.clock.run_for(4000)
    assert not hay(pagina, GLOBO) and not hay(pagina, LENGUETA)
    pagina.reload()  # ya vista: ni al recargar
    pagina.wait_for_selector("#vista-entrenar h1", state="attached")
    pagina.clock.run_for(2000)
    assert not hay(pagina, GLOBO)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_la_lengueta_se_recoge_enseguida_y_el_globo_se_queda_4_s(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho, pista=True, reloj=True)
    pagina.wait_for_function(GLOBO)
    pagina.clock.run_for(3000)
    assert hay(pagina, GLOBO) and not hay(pagina, LENGUETA)
    # El fundido del globo (animación CSS, que no lleva el reloj de prueba) dura lo mismo que él.
    assert hay(pagina, "() => document.getElementById('pista-asa').getAnimations()[0].effect.getTiming().duration") == 4000
    pagina.clock.run_for(1300)  # 4,3 s
    assert not hay(pagina, GLOBO) and not hay(pagina, LENGUETA)


@pytest.mark.parametrize("como", ["toque", "tecla"])
def test_tocar_o_pulsar_una_tecla_retira_el_globo_antes(abrir_pagina, como):
    pagina = abrir_pagina(pista=True, reloj=True)
    pagina.wait_for_function(GLOBO)
    pagina.clock.run_for(2000)
    assert hay(pagina, GLOBO)
    if como == "toque":
        pagina.mouse.click(5, 5)
    else:
        pagina.keyboard.press("Shift")
    assert not hay(pagina, GLOBO) and not hay(pagina, LENGUETA)
    assert not hay(pagina, ABIERTO)  # solo retira la pista


@pytest.mark.parametrize("ancho", ANCHOS)
def test_con_la_pista_ya_vista_no_sale(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho)  # tests/sin_intro.py la deja vista
    assert hay(pagina, PISTA_VISTA)
    assert not hay(pagina, GLOBO) and not hay(pagina, LENGUETA)


def test_arrancando_en_historial_no_sale_hasta_ir_a_entrenar(abrir_pagina):
    pagina = abrir_pagina(ruta="#historial", pista=True, reloj=True)
    assert not hay(pagina, GLOBO) and not hay(pagina, PISTA_VISTA)
    pagina.evaluate("location.hash = '#entrenar'")
    pagina.wait_for_function(GLOBO)
    assert hay(pagina, PISTA_VISTA)


def test_si_se_abre_el_menu_antes_no_sale_y_queda_vista(abrir_pagina):
    pagina = abrir_pagina(ruta="#entrenar/menu", pista=True)
    assert hay(pagina, PISTA_VISTA)
    pagina.click(".menu-cerrar")
    esperar_cerrado(pagina)
    assert not hay(pagina, GLOBO) and not hay(pagina, LENGUETA)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_durante_la_pista_el_menu_sigue_cerrado_y_empezar_se_pulsa(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho, pista=True, reloj=True)
    pagina.wait_for_function(GLOBO)
    assert not hay(pagina, ABIERTO)
    assert hay(pagina, "() => document.querySelector('[inert]') === null")
    assert pagina.get_attribute("#asa", "aria-expanded") == "false"
    pagina.click("#empezar")  # sin force: nada de la pista se interpone
    assert hay(pagina, "() => document.body.classList.contains('entrenando')")
    assert not hay(pagina, GLOBO) and not hay(pagina, LENGUETA)  # empezar la retira al momento


def test_durante_la_pista_el_asa_abre_el_menu_y_la_retira(abrir_pagina):
    pagina = abrir_pagina(pista=True)
    pagina.wait_for_function(GLOBO)
    abrir_con_el_asa(pagina)
    assert not hay(pagina, GLOBO) and not hay(pagina, LENGUETA)


def test_salir_de_entrenar_durante_la_pista_la_retira(abrir_pagina):
    pagina = abrir_pagina(pista=True, reloj=True)
    pagina.wait_for_function(GLOBO)
    pagina.evaluate("location.hash = '#historial'")
    pagina.wait_for_function("document.body.dataset.vista === 'historial'")
    assert not hay(pagina, GLOBO) and not hay(pagina, LENGUETA)
    pagina.evaluate("location.hash = '#entrenar'")  # ya vista: no vuelve
    pagina.wait_for_function("document.body.dataset.vista === 'entrenar'")
    assert not hay(pagina, GLOBO)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_sin_movimiento_la_pista_es_solo_el_globo_quieto(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho, pista=True, sin_movimiento=True, reloj=True)
    pagina.wait_for_function(GLOBO)
    assert not hay(pagina, LENGUETA)
    assert hay(pagina, "() => document.getElementById('pista-asa').getAnimations().length === 0")
    assert hay(pagina, "() => getComputedStyle(document.getElementById('pista-asa')).opacity === '1'")
    pagina.clock.run_for(3900)
    assert hay(pagina, GLOBO)
    pagina.clock.run_for(200)
    assert not hay(pagina, GLOBO)


@pytest.mark.parametrize("ancho", ANCHOS)
def test_el_globo_de_la_pista_no_tapa_empezar(abrir_pagina, ancho):
    pagina = abrir_pagina(ancho, pista=True, sin_movimiento=True, reloj=True)
    pagina.wait_for_function(GLOBO)
    g, e = pagina.locator("#pista-asa").bounding_box(), pagina.locator("#empezar").bounding_box()
    assert g["y"] + g["height"] <= e["y"] or e["y"] + e["height"] <= g["y"] \
        or g["x"] + g["width"] <= e["x"] or e["x"] + e["width"] <= g["x"]
    assert g["x"] >= 0 and g["x"] + g["width"] <= ancho


# Cuánto del panel se ve (0-1) mientras se arrastra.
A_LA_VISTA = """() => { const p = document.querySelector('.menu-panel').getBoundingClientRect();
  return (document.getElementById('menu').getBoundingClientRect().right - p.left) / p.width; }"""


def test_al_soltar_despacio_decide_la_mitad_y_rapido_el_sentido_del_gesto(abrir_pagina):
    pagina = abrir_pagina()  # 390: el panel mide 343 px
    dedo = Dedo(pagina, "mouse")
    # Despacio al 60 % a la vista: se abre.
    dedo.bajar(*centro(pagina, "#asa"))
    dedo.mover(-206, pasos=10)
    assert 0.55 < pagina.evaluate(A_LA_VISTA) < 0.65
    pagina.wait_for_timeout(150)
    dedo.subir()
    pagina.wait_for_function(ESTA_ABIERTO)
    esperar_menu_quieto(pagina)
    # Desde abierto, despacio hasta dejar el 40 % a la vista: se cierra.
    dedo.bajar(*centro(pagina, ".asa-panel"))
    dedo.mover(206, pasos=10)
    pagina.wait_for_timeout(150)
    dedo.subir()
    esperar_cerrado(pagina)
    # Más de la mitad abierto pero con un gesto rápido hacia la derecha: se cierra (manda el sentido).
    dedo.bajar(*centro(pagina, "#asa"))
    dedo.mover(-260, pasos=10, pausa=30)
    pagina.wait_for_timeout(150)
    dedo.mover(60, pasos=3)  # 20 px en un instante: muy por encima de 0,5 px/ms
    dedo.subir()
    pagina.wait_for_function(ESTA_CERRADO)
    pagina.wait_for_timeout(DURACION * 1000 + 50)
    assert pagina.evaluate("location.hash") == "#entrenar"


def test_al_soltar_va_a_su_sitio_con_la_curva_de_muelle_de_300_ms(abrir_pagina):
    pagina = abrir_pagina()
    transicion = pagina.eval_on_selector(".menu-panel", "(p) => [getComputedStyle(p).transitionDuration, getComputedStyle(p).transitionTimingFunction]")
    assert transicion == ["0.3s", "cubic-bezier(0.22, 1, 0.36, 1)"]
