"""Las secciones del menú de Entrenar en un navegador de verdad (Chromium headless con Playwright):
«Practicar más» (en Personalizar sesión) y Ajustes (voz, velocidad, Nombrar combinaciones y guardia).

«Practicar más»: tres huecos del mismo tamaño; uno vacío abre un panel (<dialog>, encima del menú) con
pestañas Golpes, Defensas y Salidas para elegir; uno lleno dice el movimiento y se puede quitar. Se guarda en
el almacén. Ajustes ya no es una página: #ajustes lleva al menú abierto en Ajustes. Sin Playwright se salta en
local; en CI falla.
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
# Fichas por fila de cada lista visible del panel.
FILAS = """() => [...document.querySelectorAll('#elegir-practicar ul.fichas')]
  .filter((ul) => !ul.closest('[hidden]')).map((ul) => {
  const filas = new Map();
  for (const li of ul.children) {
    const y = Math.round(li.getBoundingClientRect().top);
    filas.set(y, (filas.get(y) ?? 0) + 1);
  }
  return { clase: ul.className, filas: [...filas.values()] };
})"""

# Esperas a un estado, no a un tiempo fijo. Las animaciones de la página, acabadas (la entrada de la vista
# dura 0,28 s más su retraso); una cancelada también cuenta como acabada.
ANIMACIONES_ACABADAS = "() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))"
# Dos fotogramas pintados: Chromium recalcula el hover (y lo que dependa del diseño) en el siguiente.
DOS_FOTOGRAMAS = "() => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo)))"
# El scroll, quieto: el mismo scrollY en tres fotogramas seguidos.
SCROLL_QUIETO = """() => new Promise((listo) => {
  let antes = null, iguales = 0;
  (function mirar() {
    iguales = scrollY === antes ? iguales + 1 : 0;
    antes = scrollY;
    if (iguales >= 2) listo(scrollY); else requestAnimationFrame(mirar);
  })();
})"""

@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de Ajustes necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, SEMBRAR, 390, 844, barras=True) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        yield pagina
        assert not errores


@pytest.fixture
def ajustes(pagina):
    """El menú abierto en Personalizar sesión y, al acabar, sin nada elegido ni el panel abierto, para la
    prueba siguiente. Pasa antes por la página vacía (otro documento): la app arranca de cero, sin nada
    guardado."""
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/personalizar")
    pagina.wait_for_selector("#t-practicar", state="visible")
    yield pagina
    if pagina.locator("#elegir-practicar[open]").count():
        _cerrar(pagina, lambda: pagina.keyboard.press("Escape"))
    while pagina.locator("[data-quitar]").count():
        pagina.locator("[data-quitar]").first.click()
    assert _guardado(pagina) == []


def _guardado(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo') ?? '{\"perfil\":{\"practicar\":[]}}'"))[
        "perfil"]["practicar"]


def _foco(pagina):
    return pagina.evaluate("""() => { const e = document.activeElement;
      return { hueco: e.dataset.hueco ?? null, clase: e.className, id: e.id }; }""")


def _abrir_panel(pagina):
    pagina.locator(".hueco.vacio").first.click()
    pagina.wait_for_selector("#elegir-practicar[open]")


def _cerrar(pagina, accion):
    """Cierra el panel con accion() y espera al repintado: el evento close llega después de cerrar (y
    antes el navegador ya ha devuelto el foco al hueco que lo abrió)."""
    pagina.evaluate("document.querySelector('.hoja-contenido').dataset.viejo = '1'")
    accion()
    pagina.wait_for_function("() => !document.querySelector('.hoja-contenido[data-viejo]')")


def _elegir(pagina, movimiento, pestana="golpe"):
    _abrir_panel(pagina)
    pagina.click(f"#pestana-{pestana}")
    _cerrar(pagina, lambda: pagina.click(f'[data-elegir="{movimiento}"]'))


def _hoja(pagina):
    """Caja de la hoja y hueco que queda bajo la última ficha de la pestaña visible."""
    return pagina.evaluate("""() => { const d = document.querySelector('#elegir-practicar');
      const fichas = d.querySelectorAll('[role=tabpanel]:not([hidden]) [data-elegir]');
      const ultima = fichas[fichas.length - 1];
      return { top: d.getBoundingClientRect().top, alto: d.clientHeight, contenido: d.scrollHeight,
        bajo: d.scrollHeight - d.scrollTop - (ultima.getBoundingClientRect().bottom - d.getBoundingClientRect().top) }; }""")


def _filas(pagina):
    """FILAS de las tres pestañas, una tras otra; deja abierta la de Golpes."""
    filas = []
    for pestana in ("golpe", "defensa", "movimiento"):
        pagina.click(f"#pestana-{pestana}")
        filas += [f["filas"] for f in pagina.evaluate(FILAS)]
    pagina.click("#pestana-golpe")
    return filas


def _altos(pagina):
    return pagina.evaluate("""() => [...document.querySelectorAll('.huecos-practicar > li')]
      .map((li) => Math.round(li.getBoundingClientRect().height))""")


def test_tres_huecos_vacios_iguales_y_el_panel_tiene_6_mas_1_7_y_3(ajustes):
    pagina = ajustes
    assert pagina.locator(".huecos-practicar > li").count() == 3
    assert [" ".join(t.split()) for t in pagina.locator(".hueco.vacio").all_inner_texts()] == ["+ Añadir movimiento"] * 3
    assert len(set(_altos(pagina))) == 1
    assert pagina.locator("#practicar-quitar").count() == 0  # sin «Quitar todo»: cada hueco tiene su ×
    _abrir_panel(pagina)
    assert _foco(pagina)["id"] == "pestana-golpe"
    assert pagina.locator("#panel-golpe .fichas.numeros [data-elegir]").count() == 6
    assert pagina.locator("#panel-golpe .fichas.aparte [data-elegir]").all_inner_texts() == ["golpes al cuerpo"]
    assert pagina.locator("#panel-defensa .fichas.lista [data-elegir]").count() == 7
    assert pagina.locator("#panel-movimiento .fichas.lista [data-elegir]").count() == 3
    assert pagina.locator("[data-elegir][aria-disabled]").count() == 0
    # Ninguna ficha sola en su fila: todas las filas de cada lista, igual de llenas.
    assert _filas(pagina) == [[2, 2, 2], [1], [1] * 7, [1] * 3]
    # Las fichas de una lista, del mismo tamaño; «golpes al cuerpo», a todo el ancho y aparte.
    anchos = pagina.evaluate("""() => [...document.querySelectorAll('#panel-golpe [data-elegir]')]
      .map((b) => [Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height)])""")
    assert len(set(map(tuple, anchos[:6]))) == 1
    assert anchos[6][0] > 2 * anchos[0][0]
    separacion = pagina.evaluate("""() => document.querySelector('#panel-golpe .aparte').getBoundingClientRect().top
      - document.querySelector('#panel-golpe .numeros').getBoundingClientRect().bottom""")
    assert separacion >= 12
    for pestana in ("defensa", "movimiento"):
        pagina.click(f"#pestana-{pestana}")
        altos_lista = pagina.evaluate(f"""() => [...document.querySelectorAll('#panel-{pestana} [data-elegir]')]
          .map((b) => b.getBoundingClientRect().height)""")
        assert min(altos_lista) >= 48
    pagina.click("#pestana-golpe")
    # A 390, hoja inferior: pegada abajo y a todo el ancho (el del velo del menú, que también ocupa la pantalla).
    hoja = pagina.evaluate("() => document.querySelector('#elegir-practicar').getBoundingClientRect().toJSON()")
    velo = pagina.evaluate("document.querySelector('#menu').getBoundingClientRect().width")
    assert round(hoja["bottom"]) == 844 and round(hoja["left"]) == 0 and round(hoja["width"]) == round(velo)
    # Esc cierra sin elegir y el foco vuelve al hueco desde el que se abrió.
    _cerrar(pagina, lambda: pagina.keyboard.press("Escape"))
    assert _foco(pagina)["hueco"] == "0"
    assert _guardado(pagina) == []


def test_elegir_cambiar_y_quitar_desde_los_huecos(ajustes):
    pagina = ajustes
    _elegir(pagina, "6")
    foco = _foco(pagina)
    assert foco["hueco"] == "0" and "lleno" in foco["clase"]  # el foco, en la tarjeta recién llenada
    assert _guardado(pagina) == [{"movimiento": "6"}]
    # Lo ya elegido sale marcado y no se puede volver a elegir.
    _abrir_panel(pagina)
    ficha = pagina.locator('[data-elegir="6"]')
    assert ficha.get_attribute("aria-disabled") == "true"
    assert "(ya elegido)" in ficha.text_content() and "✓" in ficha.inner_text()
    ficha.click(force=True)  # Playwright no pulsa lo aria-disabled; una persona sí puede
    assert pagina.locator("#elegir-practicar[open]").count() == 1
    assert _guardado(pagina) == [{"movimiento": "6"}]
    _cerrar(pagina, lambda: pagina.click('[data-elegir="cuerpo"]'))
    _elegir(pagina, "rodar", "defensa")
    assert pagina.locator(".hueco.vacio").count() == 0
    assert pagina.locator(".hueco.lleno h3").all_inner_texts() == ["6 gancho de derecha", "golpes al cuerpo",
                                                                  "rueda"]
    assert len(set(_altos(pagina))) == 1
    assert pagina.locator("#practicar-estado").inner_text() == "3 de 3 elegidos."
    # Un solo nivel: sin «Un poco más | Bastante más».
    assert pagina.locator("#f-practicar .segmentado, [data-cuanto]").count() == 0
    assert _guardado(pagina) == [{"movimiento": "6"}, {"movimiento": "cuerpo"}, {"movimiento": "rodar"}]
    # Quitar: el botón mide 48 px como mínimo; los demás suben y el foco va al hueco que queda vacío.
    quitar = pagina.locator('[data-quitar="cuerpo"]')
    assert quitar.get_attribute("aria-label") == "Quitar golpes al cuerpo"
    caja = quitar.bounding_box()
    assert caja["width"] >= 48 and caja["height"] >= 48
    quitar.click()
    assert _guardado(pagina) == [{"movimiento": "6"}, {"movimiento": "rodar"}]
    assert pagina.locator(".hueco.lleno h3").all_inner_texts() == ["6 gancho de derecha", "rueda"]
    foco = _foco(pagina)
    assert foco["hueco"] == "2" and "vacio" in foco["clase"]


def test_pestanas_con_teclado_y_el_foco_no_sale_del_panel(ajustes):
    pagina = ajustes
    _abrir_panel(pagina)
    seleccionada = "() => document.querySelector('[role=tab][aria-selected=true]').id"
    visibles = """() => [...document.querySelectorAll('[role=tabpanel]')].filter((p) => !p.hidden).map((p) => p.id)"""
    for tecla, pestana in (("ArrowRight", "defensa"), ("ArrowRight", "movimiento"), ("ArrowRight", "golpe"),
                           ("ArrowLeft", "movimiento"), ("Home", "golpe"), ("End", "movimiento")):
        pagina.keyboard.press(tecla)
        assert pagina.evaluate(seleccionada) == f"pestana-{pestana}"
        assert _foco(pagina)["id"] == f"pestana-{pestana}"
        assert pagina.evaluate(visibles) == [f"panel-{pestana}"]
    # Solo la pestaña activa está en el orden de Tab; con Tab no se sale del diálogo.
    assert pagina.locator('[role="tab"][tabindex="0"]').count() == 1
    for _ in range(12):
        pagina.keyboard.press("Tab")
        assert pagina.evaluate("document.querySelector('#elegir-practicar').contains(document.activeElement)")
    # Al pulsar Enter en una ficha se elige.
    pagina.focus('[data-elegir="pivote"]')
    _cerrar(pagina, lambda: pagina.keyboard.press("Enter"))
    assert _guardado(pagina) == [{"movimiento": "pivote"}]
    # «Cerrar» también devuelve el foco al hueco.
    _abrir_panel(pagina)
    _cerrar(pagina, lambda: pagina.click("#elegir-practicar [data-cerrar]"))
    assert _foco(pagina)["hueco"] == "1"


def test_al_pasar_a_zurdo_el_hueco_cambia_de_mano_pero_lo_guardado_no(ajustes):
    pagina = ajustes
    _abrir_panel(pagina)
    assert pagina.locator('[data-elegir="4"]').inner_text().strip() == "4 crochet de derecha"
    _cerrar(pagina, lambda: pagina.click('[data-elegir="4"]'))
    antes = _guardado(pagina)
    assert antes == [{"movimiento": "4"}]  # la clave del movimiento: ni el texto ni la mano
    assert pagina.locator(".hueco.lleno h3").all_inner_texts() == ["4 crochet de derecha"]
    # La guardia, en la sección Ajustes del mismo menú: Practicar más se repinta sin salir.
    _guardia(pagina, "zurdo")
    assert pagina.locator(".hueco.lleno h3").all_inner_texts() == ["4 crochet de izquierda"]
    _abrir_panel(pagina)
    ficha = pagina.locator('[data-elegir="4"]')
    assert ficha.inner_text().startswith("4 crochet de izquierda")
    assert ficha.get_attribute("aria-disabled") == "true"
    _cerrar(pagina, lambda: pagina.keyboard.press("Escape"))
    assert _guardado(pagina) == antes
    _guardia(pagina, "diestro")  # vuelta a diestro, para las demás pruebas


def _guardia(pagina, guardia):
    pagina.evaluate("document.querySelector('[data-seccion=ajustes]').open = true")
    pagina.click(f'#menu-ajustes label:has(input[name="guardia"][value="{guardia}"])')


CABE_EN_EL_PANEL = "(() => { const c = document.querySelector('.menu-contenido'); return c.scrollWidth <= c.clientWidth; })()"


def test_nada_se_sale_del_panel_a_390(ajustes):
    pagina = ajustes
    for movimiento, pestana in (("3", "golpe"), ("paso_atras", "defensa"), ("salir", "movimiento")):
        _elegir(pagina, movimiento, pestana)
    ancho = pagina.evaluate("document.documentElement.clientWidth")
    assert pagina.evaluate("document.documentElement.scrollWidth") <= ancho
    assert pagina.evaluate(CABE_EN_EL_PANEL)
    derecha = pagina.evaluate("""() => Math.max(...[...document.querySelectorAll('#f-practicar .hueco *')]
      .map((e) => e.getBoundingClientRect().right))""")
    assert derecha <= pagina.evaluate("document.querySelector('.menu-panel').getBoundingClientRect().right")


def _pestanas_quietas(pagina):
    """Al cambiar de pestaña la hoja no cambia de alto ni de sitio, y ninguna ficha se queda con hover
    porque se haya movido bajo el ratón (pasaba con «rueda» al pulsar Defensas). Devuelve la
    hoja en cada pestaña."""
    hojas, sitios = {}, set()
    for pestana in ("golpe", "defensa", "movimiento", "golpe"):
        pagina.click(f"#pestana-{pestana}")
        pagina.evaluate(DOS_FOTOGRAMAS)  # Chromium recalcula el hover en el fotograma siguiente
        assert pagina.locator("#elegir-practicar [data-elegir]:hover").count() == 0
        sitios.add(round(pagina.locator(f"#pestana-{pestana}").bounding_box()["y"]))
        hojas[pestana] = _hoja(pagina)
    assert len(sitios) == 1
    assert len({(h["top"], h["alto"]) for h in hojas.values()}) == 1, hojas
    return hojas


def test_a_390_la_hoja_mide_lo_que_su_pestana_mas_alta_y_si_no_cabe_hace_scroll(ajustes):
    pagina = ajustes
    _abrir_panel(pagina)
    hojas = _pestanas_quietas(pagina)
    defensa = hojas["defensa"]
    assert defensa["contenido"] == defensa["alto"] and defensa["alto"] <= 0.85 * 844, defensa
    assert defensa["bajo"] <= 24, defensa  # bajo la última defensa, solo el relleno de la hoja
    # En una pantalla baja, Defensas (7) no pasa de 85dvh y se llega a la última con scroll dentro.
    pagina.set_viewport_size({"width": 390, "height": 560})
    try:
        pagina.click("#pestana-defensa")
        hoja = _hoja(pagina)
        assert hoja["alto"] <= 0.85 * 560 + 1 and hoja["contenido"] > hoja["alto"], hoja
        fondo = pagina.evaluate("document.documentElement.scrollTop")
        pagina.locator('#panel-defensa [data-elegir]').last.scroll_into_view_if_needed()
        assert pagina.evaluate("document.querySelector('#elegir-practicar').scrollTop") > 0
        assert pagina.evaluate("document.documentElement.scrollTop") == fondo  # la página de detrás, quieta
    finally:
        _cerrar(pagina, lambda: pagina.keyboard.press("Escape"))
        pagina.set_viewport_size({"width": 390, "height": 844})


def test_a_1024_huecos_uno_debajo_de_otro_en_el_panel_y_la_hoja_centrada(ajustes):
    pagina = ajustes
    pagina.set_viewport_size({"width": 1024, "height": 768})
    try:
        _elegir(pagina, "4")
        _elegir(pagina, "bloqueo", "defensa")
        # El panel mide 420 px a cualquier ancho: un hueco por fila, del mismo ancho y alto.
        cajas = pagina.evaluate("""() => [...document.querySelectorAll('.huecos-practicar > li')]
          .map((li) => li.getBoundingClientRect().toJSON())""")
        assert len({round(c["top"]) for c in cajas}) == 3
        assert len({(round(c["width"]), round(c["height"])) for c in cajas}) == 1
        _abrir_panel(pagina)
        assert _filas(pagina) == [[3, 3], [1], [1] * 7, [1] * 3]
        assert _pestanas_quietas(pagina)["defensa"]["bajo"] <= 24
        hoja = pagina.evaluate("() => document.querySelector('#elegir-practicar').getBoundingClientRect().toJSON()")
        assert hoja["width"] <= 560 and hoja["bottom"] < 768
        velo = pagina.evaluate("document.querySelector('#menu').getBoundingClientRect().width")
        assert abs((hoja["left"] + hoja["right"]) / 2 - velo / 2) <= 1
        _cerrar(pagina, lambda: pagina.keyboard.press("Escape"))
    finally:
        pagina.set_viewport_size({"width": 390, "height": 844})


def test_elegir_con_la_general_pasa_a_personalizada_y_al_cerrar_el_menu_se_ve(ajustes):
    pagina = ajustes
    assert pagina.is_checked('#presets input[value="general"]')
    _elegir(pagina, "3")
    datos = json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))
    assert datos["perfil"]["sesion"]["tipo"] == "personalizada"
    assert pagina.is_checked('#presets input[value="personalizada"]')


def test_atras_con_la_hoja_abierta_cierra_la_hoja_y_el_menu(ajustes):
    pagina = ajustes
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#asa")
    pagina.click("#asa")
    pagina.wait_for_selector("#t-practicar", state="visible")
    _abrir_panel(pagina)
    pagina.go_back()
    pagina.wait_for_function("location.hash === '#entrenar'")
    pagina.wait_for_function("!document.querySelector('dialog[open]')")
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/personalizar")
    pagina.wait_for_selector("#t-practicar", state="visible")


# ---------- Ajustes (sección del menú) ----------

def _abrir_ajustes(pagina):
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/ajustes")
    pagina.wait_for_selector("#voz-id", state="visible")


def test_ajustes_trae_voz_velocidad_nombrar_y_guardia_y_nada_de_practicar(ajustes):
    pagina = ajustes
    _abrir_ajustes(pagina)
    seccion = pagina.locator("#menu-ajustes")
    assert seccion.locator("#voz-id, #probar-voz").count() == 2
    assert seccion.locator('input[name="voz-velocidad"]').count() == 3
    assert [i.get_attribute("value") for i in seccion.locator('input[name="voz"]').all()] == ["numeros", "nombres", "ambos"]
    assert [i.get_attribute("value") for i in seccion.locator('input[name="guardia"]').all()] == ["diestro", "zurdo"]
    assert pagina.locator("#identidad").count() == 1  # el hueco de nombre y avatar (R5)
    texto = seccion.inner_text().lower()
    for frase in ("practicar", "tus datos", "nivel", "asaltos"):
        assert frase not in texto, frase
    # En Entrenar ya no están Nombrar ni la guardia; la página de Ajustes y su engranaje, tampoco.
    assert pagina.locator('#config input[name="voz"], #zurdo').count() == 0
    assert pagina.locator("#vista-ajustes, #ir-ajustes, #pestanas a[href='#ajustes']").count() == 0


def test_nombrar_y_la_guardia_se_guardan_sin_cambiar_de_tipo(ajustes):
    pagina = ajustes
    _abrir_ajustes(pagina)
    pagina.click('#menu-ajustes label:has(input[name="voz"][value="numeros"])')
    pagina.click('#menu-ajustes label:has(input[name="guardia"][value="zurdo"])')
    sesion = json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))["perfil"]["sesion"]
    assert (sesion["voz"], sesion["zurdo"], sesion["tipo"]) == ("numeros", True, "general")
    # La General también es zurda: «Tu sesión» lo dice detrás del menú.
    assert "Zurdo" in pagina.text_content("#resumen-elecciones")
    pagina.reload()
    pagina.wait_for_selector("#voz-id", state="visible")
    assert pagina.is_checked('input[name="voz"][value="numeros"]') and pagina.is_checked('input[name="guardia"][value="zurdo"]')
    pagina.click('#menu-ajustes label:has(input[name="voz"][value="nombres"])')
    pagina.click('#menu-ajustes label:has(input[name="guardia"][value="diestro"])')


@pytest.mark.parametrize("de", ["#ajustes", "#ajustes/otra-cosa"])
def test_ajustes_al_arrancar_abre_el_menu_en_ajustes_sin_crecer_el_historial(ajustes, de):
    pagina = ajustes
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    largo = pagina.evaluate("history.length")
    pagina.goto(f"{ORIGEN}/index.html{de}")
    pagina.wait_for_selector("#voz-id", state="visible")
    assert pagina.evaluate("location.hash") == "#entrenar/menu/ajustes"
    assert pagina.evaluate("history.length") == largo + 1  # solo la entrada de la app
    assert pagina.evaluate("document.querySelector('[data-seccion=ajustes]').open")
    # Cerrar sustituye la entrada (no hay marca de menú): no sale de la app.
    pagina.click(".menu-cerrar")
    pagina.wait_for_function("location.hash === '#entrenar' && !document.querySelector('#menu[open]')")
    assert pagina.evaluate("history.length") == largo + 1


def test_ajustes_desde_la_app_lleva_al_menu_y_atras_no_pasa_por_la_ruta_vieja(ajustes):
    pagina = ajustes
    pagina.goto(f"{ORIGEN}/index.html#historial")
    pagina.wait_for_selector("#t-historial")
    largo = pagina.evaluate("history.length")
    pagina.evaluate("location.hash = '#ajustes'")
    pagina.wait_for_function("location.hash === '#entrenar/menu/ajustes'")
    pagina.wait_for_selector("#voz-id", state="visible")
    assert pagina.evaluate("history.length") == largo + 1
    pagina.go_back()
    pagina.wait_for_function("location.hash === '#historial'")
    assert pagina.locator("#menu[open]").count() == 0


@pytest.mark.parametrize("ancho", (390, 1440))
def test_la_seccion_ajustes_cabe_en_el_panel(ajustes, ancho):
    pagina = ajustes
    pagina.set_viewport_size({"width": ancho, "height": 900})
    try:
        _abrir_ajustes(pagina)
        assert pagina.evaluate(CABE_EN_EL_PANEL)
        chips = [c.bounding_box() for c in pagina.locator(".velocidades .chip-opcion").all()]
        assert len({round(c["y"]) for c in chips}) == 1
        for control in pagina.locator("#menu-ajustes :is(label:has(input[type=radio]), select, button)").all():
            assert control.bounding_box()["height"] >= 44
    finally:
        pagina.set_viewport_size({"width": 390, "height": 844})
