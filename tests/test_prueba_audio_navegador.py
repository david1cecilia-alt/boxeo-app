"""La página de prueba de audio con cascos (static/prueba-audio.html) en un navegador de verdad: carga sin errores,
tiene las 6 variantes con su botón y lo que se marca va solo a sessionStorage (nunca al almacén de la app).
Sin Playwright se salta en local; en CI falla."""
import importlib.util
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")


@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "La prueba de audio necesita Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, "", 390, 844) as (pagina, errores):
        consola = []
        pagina.on("console", lambda m: consola.append(m.text) if m.type == "error" else None)
        pagina.goto(f"{ORIGEN}/prueba-audio.html")
        pagina.wait_for_selector("body[data-listo='true']")
        yield pagina, errores, consola


def test_carga_sin_errores_y_con_las_6_variantes(pagina):
    pagina, errores, consola = pagina
    assert errores == [] and consola == []
    assert pagina.locator("[data-probar]").count() == 6
    for i in range(6):
        assert pagina.locator(f"#variante-{i} [data-probar]").inner_text() == "Probar"
        assert pagina.locator(f"#variante-{i} [data-veredicto]").all_inner_texts() == ["Se corta", "No se corta"]
    assert pagina.locator("#hueco").input_value() == "4"
    assert pagina.locator("#hueco option").all_inner_texts() == ["2 s", "4 s", "7 s", "10 s"]


def test_una_prueba_dicta_combinaciones_y_se_para(pagina):
    pagina, errores, _ = pagina
    pagina.click("#variante-2 [data-probar]")
    pagina.wait_for_function("document.getElementById('frase').textContent.length > 0")
    assert pagina.is_enabled("#parar") and not pagina.is_enabled("#variante-0 [data-probar]")
    pagina.click("#parar")
    assert not pagina.is_enabled("#parar") and pagina.is_enabled("#variante-0 [data-probar]")
    assert errores == []


def test_lo_marcado_va_solo_a_session_storage_y_al_resumen(pagina):
    pagina, errores, _ = pagina
    pagina.click("#variante-3 [data-veredicto='No se corta']")
    assert pagina.get_attribute("#variante-3 [data-veredicto='No se corta']", "aria-pressed") == "true"
    assert "3. Calentar la voz: No se corta (hueco 4 s)" in pagina.input_value("#resumen")
    assert "0. Como ahora: sin probar" in pagina.input_value("#resumen")
    assert "No se corta" in pagina.evaluate("sessionStorage.getItem('boxeo.prueba-audio')")
    assert pagina.evaluate("localStorage.length") == 0
    assert errores == []
