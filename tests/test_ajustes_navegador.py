"""«Practicar más» de Ajustes en un navegador de verdad (Chromium headless con Playwright).

Tres huecos del mismo tamaño: uno vacío abre un panel (<dialog>) con pestañas Golpes, Defensas y Salidas
para elegir; uno lleno dice el movimiento y cuánto más, y se puede quitar. Se guarda en el almacén. Sin
Playwright se salta en local; en CI falla.
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
    """Ajustes abierto y, al acabar, sin nada elegido ni el panel abierto, para la prueba siguiente."""
    pagina.goto(f"{ORIGEN}/index.html#ajustes")
    pagina.wait_for_selector("#t-practicar")
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


def _en_una_linea(pagina):
    """Cada botón del selector «Un poco más | Bastante más», en una sola línea y sin salirse."""
    return pagina.evaluate("""() => [...document.querySelectorAll('.segmentado span')].every((s) => {
      const r = document.createRange();
      r.selectNodeContents(s);
      return r.getClientRects().length === 1 && s.scrollWidth <= s.clientWidth;
    })""")


def _selector_holgado(pagina):
    """Cada texto del selector, entero y sin tocar el borde de su botón; botones dentro de la tarjeta."""
    return pagina.evaluate("""() => [...document.querySelectorAll('.segmentado span')].map((s) => {
      const r = document.createRange();
      r.selectNodeContents(s);
      const texto = r.getBoundingClientRect(), caja = s.getBoundingClientRect();
      const tarjeta = s.closest('.hueco').getBoundingClientRect();
      return { texto: s.textContent, lineas: r.getClientRects().length, cabe: s.scrollWidth <= s.clientWidth,
        holgura: Math.min(texto.left - caja.left, caja.right - texto.right),
        dentro: caja.left >= tarjeta.left && caja.right <= tarjeta.right };
    })""")


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
    # A 390, hoja inferior: pegada abajo y a todo el ancho.
    hoja = pagina.evaluate("() => document.querySelector('#elegir-practicar').getBoundingClientRect().toJSON()")
    assert round(hoja["bottom"]) == 844 and round(hoja["width"]) == pagina.evaluate("document.documentElement.clientWidth")
    # Esc cierra sin elegir y el foco vuelve al hueco desde el que se abrió.
    _cerrar(pagina, lambda: pagina.keyboard.press("Escape"))
    assert _foco(pagina)["hueco"] == "0"
    assert _guardado(pagina) == []


def test_elegir_cambiar_y_quitar_desde_los_huecos(ajustes):
    pagina = ajustes
    _elegir(pagina, "6")
    foco = _foco(pagina)
    assert foco["hueco"] == "0" and "lleno" in foco["clase"]  # el foco, en la tarjeta recién llenada
    assert _guardado(pagina) == [{"movimiento": "6", "cuanto": "poco"}]
    # Lo ya elegido sale marcado y no se puede volver a elegir.
    _abrir_panel(pagina)
    ficha = pagina.locator('[data-elegir="6"]')
    assert ficha.get_attribute("aria-disabled") == "true"
    assert "(ya elegido)" in ficha.text_content() and "✓" in ficha.inner_text()
    ficha.click(force=True)  # Playwright no pulsa lo aria-disabled; una persona sí puede
    assert pagina.locator("#elegir-practicar[open]").count() == 1
    assert _guardado(pagina) == [{"movimiento": "6", "cuanto": "poco"}]
    _cerrar(pagina, lambda: pagina.click('[data-elegir="cuerpo"]'))
    _elegir(pagina, "rodar", "defensa")
    assert pagina.locator(".hueco.vacio").count() == 0
    assert pagina.locator(".hueco.lleno h3").all_inner_texts() == ["6 gancho de derecha", "golpes al cuerpo",
                                                                  "esquiva abajo"]
    assert len(set(_altos(pagina))) == 1
    assert pagina.locator("#practicar-estado").inner_text() == "3 de 3 elegidos."
    # Cuánto más: «Un poco más | Bastante más», sin el factor del sorteo.
    assert pagina.locator('[data-hueco="2"] .segmentado span').all_inner_texts() == ["Un poco más", "Bastante más"]
    pagina.locator('[data-movimiento="rodar"][data-cuanto="bastante"]').check()
    assert _guardado(pagina) == [{"movimiento": "6", "cuanto": "poco"}, {"movimiento": "cuerpo", "cuanto": "poco"},
                                 {"movimiento": "rodar", "cuanto": "bastante"}]
    # Quitar: el botón mide 48 px como mínimo; los demás suben y el foco va al hueco que queda vacío.
    quitar = pagina.locator('[data-quitar="cuerpo"]')
    assert quitar.get_attribute("aria-label") == "Quitar golpes al cuerpo"
    caja = quitar.bounding_box()
    assert caja["width"] >= 48 and caja["height"] >= 48
    quitar.click()
    assert _guardado(pagina) == [{"movimiento": "6", "cuanto": "poco"}, {"movimiento": "rodar", "cuanto": "bastante"}]
    assert pagina.locator(".hueco.lleno h3").all_inner_texts() == ["6 gancho de derecha", "esquiva abajo"]
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
    assert _guardado(pagina) == [{"movimiento": "pivote", "cuanto": "poco"}]
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
    assert antes == [{"movimiento": "4", "cuanto": "poco"}]  # la clave del movimiento: ni el texto ni la mano
    assert pagina.locator(".hueco.lleno h3").all_inner_texts() == ["4 crochet de derecha"]
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.locator("#zurdo").check()
    pagina.goto(f"{ORIGEN}/index.html#ajustes")
    pagina.wait_for_selector("#t-practicar")
    assert pagina.locator(".hueco.lleno h3").all_inner_texts() == ["4 crochet de izquierda"]
    _abrir_panel(pagina)
    ficha = pagina.locator('[data-elegir="4"]')
    assert ficha.inner_text().startswith("4 crochet de izquierda")
    assert ficha.get_attribute("aria-disabled") == "true"
    _cerrar(pagina, lambda: pagina.keyboard.press("Escape"))
    assert _guardado(pagina) == antes
    # Vuelta a diestro, para las demás pruebas.
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.locator("#zurdo").uncheck()
    pagina.goto(f"{ORIGEN}/index.html#ajustes")
    pagina.wait_for_selector("#t-practicar")


def test_nada_se_sale_de_la_pantalla_a_390(ajustes):
    pagina = ajustes
    for movimiento, pestana in (("3", "golpe"), ("paso_atras", "defensa"), ("salir", "movimiento")):
        _elegir(pagina, movimiento, pestana)
    ancho = pagina.evaluate("document.documentElement.clientWidth")
    assert pagina.evaluate("document.documentElement.scrollWidth") <= ancho
    derecha = pagina.evaluate("""() => Math.max(...[...document.querySelectorAll('#f-practicar .hueco *')]
      .map((e) => e.getBoundingClientRect().right))""")
    assert derecha <= ancho
    # El selector de cada hueco, en una línea por botón.
    assert _en_una_linea(pagina)
    assert all(b["holgura"] >= 6 and b["dentro"] for b in _selector_holgado(pagina))


def test_a_390_la_hoja_mide_lo_que_su_pestana_y_si_no_cabe_hace_scroll(ajustes):
    pagina = ajustes
    _abrir_panel(pagina)
    altos = {}
    for pestana in ("golpe", "defensa", "movimiento"):
        pagina.click(f"#pestana-{pestana}")
        hoja = _hoja(pagina)
        altos[pestana] = hoja["alto"]
        assert hoja["contenido"] == hoja["alto"] and hoja["alto"] <= 0.85 * 844, hoja
        assert hoja["bajo"] <= 24, hoja  # bajo la última ficha, solo el relleno de la hoja
    assert altos["movimiento"] < altos["golpe"] < altos["defensa"]
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


def test_a_1024_tres_huecos_en_fila_y_el_panel_centrado(ajustes):
    pagina = ajustes
    pagina.set_viewport_size({"width": 1024, "height": 768})
    try:
        _elegir(pagina, "4")
        _elegir(pagina, "bloqueo", "defensa")
        cajas = pagina.evaluate("""() => [...document.querySelectorAll('.huecos-practicar > li')]
          .map((li) => li.getBoundingClientRect().toJSON())""")
        assert len({round(c["top"]) for c in cajas}) == 1
        assert len({(round(c["width"]), round(c["height"])) for c in cajas}) == 1
        assert _en_una_linea(pagina)
        # Selector con la letra y el relleno de Velocidad; ningún texto cortado ni pegado al borde.
        estilo = """(s) => { const c = getComputedStyle(document.querySelector(s));
          return [c.fontSize, c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft]; }"""
        assert pagina.evaluate(f"({estilo})('.segmentado span')") == pagina.evaluate(
            f"({estilo})('.velocidades .chip-opcion span')")
        for boton in _selector_holgado(pagina):
            assert boton["lineas"] == 1 and boton["cabe"] and boton["dentro"], boton
            assert boton["holgura"] >= 6, boton
        _abrir_panel(pagina)
        assert _filas(pagina) == [[3, 3], [1], [1] * 7, [1] * 3]
        hoja = pagina.evaluate("() => document.querySelector('#elegir-practicar').getBoundingClientRect().toJSON()")
        assert hoja["width"] <= 560 and hoja["bottom"] < 768
        assert abs((hoja["left"] + hoja["right"]) / 2 - pagina.evaluate("document.documentElement.clientWidth") / 2) <= 1
        _cerrar(pagina, lambda: pagina.keyboard.press("Escape"))
    finally:
        pagina.set_viewport_size({"width": 390, "height": 844})
