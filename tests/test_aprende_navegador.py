"""Aprende en un navegador de verdad (Chromium headless con Playwright).

La lista agrupada (Golpes, Defensas, Salidas), una ficha abierta, el foco al entrar y al volver, las fuentes en
pestaña nueva, «Al cuerpo» y «Mostrar más» plegados y manejables con el teclado, sin desbordes a 390, 768, 1024
y 1440 (con todo desplegado), y la barra de pestañas con Aprende a 390 sin apretar.
Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
ALTO = {390: 844, 768: 1024, 1024: 768, 1440: 900}
# Lo que sale de la ventana o del contenedor: la página no hace scroll de lado y nada se corta.
DESBORDES = """() => {
  const ancho = document.documentElement.clientWidth;
  const fuera = [...document.querySelectorAll('#aprende-contenido *')].filter((e) => {
    const c = e.getBoundingClientRect();
    return c.width && (c.left < -1 || c.right > ancho + 1);
  }).map((e) => e.className || e.tagName);
  const cortados = [...document.querySelectorAll('#aprende-contenido :is(h2, p, li, a, summary)')]
    .filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'hidden')
    .map((e) => e.textContent.trim().slice(0, 30));
  return { pagina: document.documentElement.scrollWidth - ancho, fuera, cortados };
}"""


@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de Aprende necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, VACIA, 390, 844, barras=True) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        yield pagina
        assert not errores


def _ir(pagina, hash_, ancho=390):
    pagina.set_viewport_size({"width": ancho, "height": ALTO[ancho]})
    pagina.goto(f"{ORIGEN}/index.html#{hash_}")
    pagina.wait_for_selector(".aprende-ficha" if "/" in hash_ else ".lista-fichas")
    # Una animación cancelada al navegar (su `finished` se rechaza) también ha terminado.
    pagina.evaluate("Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))")


def _activo(pagina):
    return pagina.evaluate("document.activeElement.id || document.activeElement.dataset.ficha || ''")


def test_la_lista_va_agrupada_en_golpes_defensas_y_salidas(pagina):
    _ir(pagina, "aprende")
    grupos = pagina.eval_on_selector_all(".grupo-fichas", """gs => gs.map((g) => [g.querySelector('h2').textContent,
        [...g.querySelectorAll('.ficha-enlace .titular')].map((t) => t.textContent)])""")
    assert grupos == [
        ["Golpes", ["Jab", "Recto", "Crochet de izquierda", "Crochet de derecha", "Gancho de izquierda",
                    "Gancho de derecha"]],
        ["Defensas", ["Esquiva", "Rueda", "Ballesteo", "Flexión", "Bloqueo", "Parada", "Paso atrás"]],
        ["Salidas", ["Pivote", "Paso lateral", "Cambio de ángulo"]],
    ]
    assert pagina.locator("#pestanas a[href='#aprende']").get_attribute("aria-current") == "page"


def test_el_aviso_de_revision_es_discreto_y_nunca_en_mayusculas(pagina):
    for hash_ in ("aprende", "aprende/rodar"):
        _ir(pagina, hash_)
        texto = pagina.locator("#vista-aprende").text_content()
        assert "Pendiente de revisar con el entrenador" in texto
        assert "REVISAR" not in texto and "REVISAR" not in pagina.locator("#vista-aprende").inner_text()
        assert pagina.locator(".aviso-pendiente").evaluate("e => getComputedStyle(e).textTransform") == "none"


def test_la_nota_del_zurdo_dice_que_lo_del_rival_no_cambia(pagina):
    for hash_ in ("aprende", "aprende/gancho_izq"):
        _ir(pagina, hash_)
        nota = pagina.locator(".pie-aprende").text_content()
        assert "cambia izquierda por derecha en tus manos y tus pies" in nota
        assert "Lo que se refiere al rival no cambia: su hígado sigue en su lado derecho" in nota


def test_abrir_una_ficha_y_volver_lleva_el_foco_a_su_sitio(pagina):
    _ir(pagina, "aprende")
    pagina.click('[data-ficha="rodar"]')
    pagina.wait_for_selector(".aprende-ficha")
    assert pagina.evaluate("location.hash") == "#aprende/rodar"
    assert pagina.locator("#t-aprende").text_content() == "Rueda"
    assert pagina.locator("#antetitulo-aprende").text_content() == "Defensas"
    assert _activo(pagina) == "t-aprende"
    assert pagina.evaluate("window.scrollY") == 0
    apartados = pagina.locator(".apartado h2").all_text_contents()
    assert apartados[:6] == ["Qué es", "Cuándo suele servir", "Cómo se hace", "Errores típicos", "Ventajas",
                             "Inconvenientes"]
    assert "rueda derecha bajas y sales hacia tu derecha" in pagina.locator(".aprende-ficha").text_content()
    pagina.click(".volver-ficha a")
    pagina.wait_for_selector(".lista-fichas")
    assert _activo(pagina) == "rodar"
    pagina.go_back()  # el gesto atrás vuelve a la ficha
    pagina.wait_for_selector(".aprende-ficha")
    assert pagina.locator("#t-aprende").text_content() == "Rueda"


def test_desde_otra_pestana_el_foco_va_al_titulo(pagina):
    pagina.set_viewport_size({"width": 390, "height": 844})
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#config")
    pagina.click("#pestanas a[href='#aprende']")
    pagina.wait_for_selector(".lista-fichas")
    assert _activo(pagina) == "t-aprende"
    assert pagina.locator("#t-aprende").inner_text().replace("\n", " ") == "APRENDE LA TÉCNICA"


def test_la_salida_se_titula_como_la_dice_la_app_y_sin_paso_atras(pagina):
    _ir(pagina, "aprende/salir")
    assert pagina.locator("#t-aprende").text_content() == "Cambio de ángulo"
    assert pagina.locator("#antetitulo-aprende").text_content() == "Salidas"
    assert "También se dice salir" in pagina.locator(".apartado h2").all_text_contents()
    assert "paso atrás" not in pagina.locator("#a-como + ol").text_content()


def test_una_ficha_que_no_existe_lleva_a_la_lista(pagina):
    _ir(pagina, "aprende")
    pagina.goto(f"{ORIGEN}/index.html#aprende/no-existe")
    pagina.wait_for_selector(".lista-fichas")
    assert pagina.locator("#t-aprende").inner_text().startswith("APRENDE")


def test_las_fuentes_se_abren_en_pestana_nueva_y_por_https(pagina):
    _ir(pagina, "aprende/bloqueo")
    fuentes = pagina.locator(".fuentes-ficha")
    assert fuentes.evaluate("d => d.open") is False
    pagina.click(".fuentes-ficha summary")
    enlaces = fuentes.locator("a").evaluate_all(
        "as => as.map((a) => [a.getAttribute('href'), a.target, a.rel, a.textContent])")
    assert len(enlaces) == 4
    for href, destino, rel, texto in enlaces:
        assert href.startswith("https://") and destino == "_blank" and "noopener" in rel.split()
        assert texto.endswith("(se abre en otra pestaña)")


def _plegado(pagina, selector):
    return pagina.locator(selector).evaluate("""d => ({ abierto: d.open,
        visible: [...d.children].slice(1).some((h) => h.checkVisibility()) })""")


def test_mostrar_mas_del_jab_se_abre_con_el_teclado_y_trae_variantes_y_detalles(pagina):
    _ir(pagina, "aprende/jab")
    apartados = pagina.locator(".apartado h2").all_text_contents()
    # «Al cuerpo» sigue a «Cómo se hace» (en el PC, en la misma columna: así no se descompensan).
    assert apartados == ["Qué es", "Cuándo suele servir", "Cómo se hace", "Al cuerpo", "Errores típicos",
                         "Ventajas", "Inconvenientes"]
    assert _plegado(pagina, ".mas-ficha") == {"abierto": False, "visible": False}
    resumen = pagina.locator(".mas-ficha > summary")
    assert resumen.locator(".titulo-plegable").text_content() == "Mostrar más"
    assert "Variantes · Guardia según la distancia · Altura" in resumen.text_content()
    resumen.focus()
    pagina.keyboard.press("Enter")
    assert _plegado(pagina, ".mas-ficha") == {"abierto": True, "visible": True}
    assert pagina.evaluate("document.activeElement.parentElement.classList.contains('mas-ficha')")
    assert pagina.locator(".mas-ficha h3").all_text_contents() == ["Variantes", "Guardia según la distancia", "Altura"]
    assert pagina.locator(".mas-ficha .nombre-variante").count() == 6
    pagina.keyboard.press("Space")
    assert _plegado(pagina, ".mas-ficha")["abierto"] is False
    # «Mostrar más» va antes que las fuentes, que siguen plegadas aparte.
    plegables = pagina.locator(".col-ficha > details").evaluate_all("ds => ds.map((d) => d.className)")
    assert plegables == ["tarjeta plegable mas-ficha", "tarjeta plegable fuentes-ficha"]


def test_al_cuerpo_comun_se_abre_con_el_teclado_dentro_de_cada_golpe(pagina):
    _ir(pagina, "aprende/gancho_izq")
    cuerpo = pagina.locator("#a-cuerpo + p").text_content()
    assert cuerpo.startswith("El golpe clásico al hígado") and "En zurdo" in cuerpo
    assert _plegado(pagina, ".comun-cuerpo") == {"abierto": False, "visible": False}
    pagina.locator(".comun-cuerpo > summary").focus()
    pagina.keyboard.press("Space")
    assert _plegado(pagina, ".comun-cuerpo") == {"abierto": True, "visible": True}
    puntos = pagina.locator(".comun-cuerpo li strong").all_text_contents()
    assert puntos[0] == "Baja con las piernas, no con la cintura ni con el puño." and "Objetivos:" in puntos
    enlace = pagina.locator(".fuentes-comun a").first
    assert enlace.text_content().startswith("World Boxing") and enlace.get_attribute("target") == "_blank"
    # Una defensa no tiene ni «Al cuerpo» ni «Mostrar más».
    _ir(pagina, "aprende/rodar")
    assert pagina.locator("#a-cuerpo, .mas-ficha").count() == 0


# Contraste WCAG entre el color del texto y el primer fondo opaco de sus antepasados.
CONTRASTE = """(e) => {
  const rgb = (c) => c.match(/[\\d.]+/g).map(Number);
  const lum = ([r, g, b]) => 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  const f = (x) => ((x /= 255) <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  let fondo = e;
  while (fondo && (rgb(getComputedStyle(fondo).backgroundColor)[3] ?? 1) === 0) fondo = fondo.parentElement;
  const [a, b] = [lum(rgb(getComputedStyle(e).color)), lum(rgb(getComputedStyle(fondo).backgroundColor))];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}"""


def test_a_390_lo_comun_al_cuerpo_se_toca_bien_y_se_lee_con_contraste_aa(pagina):
    _ir(pagina, "aprende/gancho_izq")
    resumen = pagina.locator(".comun-cuerpo > summary")
    assert resumen.bounding_box()["height"] >= 48
    assert resumen.evaluate(CONTRASTE) >= 4.5


def test_a_390_el_resumen_de_mostrar_mas_va_debajo_en_una_linea_sin_desbordar(pagina):
    _ir(pagina, "aprende/jab")
    caja = pagina.locator(".mas-ficha .resumen-plegable").evaluate("""(r) => {
        const t = r.parentElement.querySelector('.titulo-plegable').getBoundingClientRect();
        const c = r.getBoundingClientRect(), s = r.parentElement.getBoundingClientRect();
        return { debajo: c.top >= t.bottom - 1, alineado: Math.abs(c.left - t.left) < 1,
                 una_linea: c.height < 1.6 * parseFloat(getComputedStyle(r).fontSize),
                 dentro: c.right <= s.right + 1, cortado: r.scrollWidth > r.clientWidth,
                 puntos: getComputedStyle(r).textOverflow };
    }""")
    assert caja == {"debajo": True, "alineado": True, "una_linea": True, "dentro": True, "cortado": caja["cortado"],
                    "puntos": "ellipsis"}, caja
    assert pagina.locator(".mas-ficha > summary").bounding_box()["height"] >= 48
    # En el PC sigue a la derecha del título.
    _ir(pagina, "aprende/jab", 1024)
    assert pagina.locator(".mas-ficha .resumen-plegable").evaluate(
        "(r) => r.getBoundingClientRect().top < r.parentElement.querySelector('.titulo-plegable').getBoundingClientRect().bottom")


def test_el_gancho_de_izquierda_solo_trae_variantes(pagina):
    _ir(pagina, "aprende/uppercut_izq")
    assert pagina.locator(".mas-ficha .resumen-plegable").text_content() == "Variantes"


@pytest.mark.parametrize("ancho", (390, 768, 1024, 1440))
@pytest.mark.parametrize("hash_", ("aprende", "aprende/rodar", "aprende/salir", "aprende/jab", "aprende/gancho_izq"))
def test_nada_se_sale_ni_se_corta(pagina, ancho, hash_):
    _ir(pagina, hash_, ancho)
    pagina.evaluate("document.querySelectorAll('#aprende-contenido details').forEach((d) => (d.open = true))")
    desbordes = pagina.evaluate(DESBORDES)
    assert desbordes == {"pagina": 0, "fuera": [], "cortados": []}, desbordes


@pytest.mark.parametrize("ancho", (1024, 1440))
def test_en_escritorio_tres_columnas_de_fichas_y_la_ficha_en_dos(pagina, ancho):
    _ir(pagina, "aprende", ancho)
    cajas = pagina.locator("#g-defensas ~ .lista-fichas > li").evaluate_all(
        "ls => ls.slice(0, 3).map((l) => l.getBoundingClientRect().top)")
    assert len({round(y) for y in cajas}) == 1
    _ir(pagina, "aprende/rodar", ancho)
    columnas = pagina.locator(".col-ficha").evaluate_all(
        "cs => cs.map((c) => c.getBoundingClientRect().toJSON())")
    assert len(columnas) == 2 and round(columnas[0]["top"]) == round(columnas[1]["top"])
    assert columnas[0]["right"] < columnas[1]["left"]


def test_a_390_la_barra_con_aprende_cabe_sin_apretar_y_con_48_px_para_el_dedo(pagina):
    _ir(pagina, "aprende")
    pestanas = pagina.eval_on_selector_all("#pestanas a", """as => as.filter((a) => a.offsetParent).map((a) => {
        const c = a.getBoundingClientRect(), s = a.querySelector('span'), t = s.getBoundingClientRect();
        return { texto: s.textContent, ancho: c.width, alto: c.height, letra: getComputedStyle(s).fontSize,
                 una_linea: t.height < 1.5 * parseFloat(getComputedStyle(s).fontSize) * 1.45,
                 holgura: Math.min(t.left - c.left, c.right - t.right) };
    })""")
    assert [p["texto"] for p in pestanas] == ["Entrenar", "Aprende", "Historial", "Perfil"]
    for p in pestanas:
        assert p["ancho"] >= 48 and p["alto"] >= 48, p
        assert p["letra"] == "12px" and p["una_linea"] and p["holgura"] >= 8, p
