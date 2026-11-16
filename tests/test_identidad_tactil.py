"""«Hacer una foto» y «Elegir de la galería» con pantalla táctil (pointer: coarse), como en un móvil.

Con un input de solo imágenes, Chrome en Android abre el selector de fotos del sistema, que no ofrece la cámara:
«Hacer una foto» usa otro input con capture="user". Los dos pasan por la misma preparación (foto.js). Con ratón
y sin táctil, lo comprueba test_identidad_navegador.py. Va aparte porque Playwright síncrono no admite dos
navegadores abiertos a la vez en un mismo módulo. Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import abrir
from tests.sin_intro import preparar
from tests.test_identidad_navegador import SEMBRAR, TAMANO_FOTO, _abrir_ajustes, _identidad, _png, _subir

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")


@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de identidad necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, SEMBRAR, 390, 844, tactil=True) as (pagina, errores):
        preparar(pagina)
        yield pagina
        assert not errores


@pytest.fixture
def ajustes_tactil(pagina):
    """El menú abierto en Ajustes, con el almacén vacío."""
    return _abrir_ajustes(pagina)


def test_con_pantalla_tactil_salen_hacer_una_foto_y_elegir_de_la_galeria(ajustes_tactil):
    pagina = ajustes_tactil
    assert pagina.evaluate("matchMedia('(any-pointer: coarse)').matches")
    camara = pagina.get_by_role("button", name="Hacer una foto")
    galeria = pagina.get_by_role("button", name="Elegir de la galería")
    assert camara.is_visible() and galeria.is_visible()
    assert pagina.get_by_role("button", name="Subir una foto…").count() == 0
    # Cada botón abre el selector de su input.
    for boton, entrada in ((camara, "hacer-foto"), (galeria, "subir-foto")):
        with pagina.expect_file_chooser() as elegir:
            boton.click()
        assert elegir.value.element.get_attribute("id") == entrada


@pytest.mark.parametrize("entrada", ["hacer-foto", "subir-foto"])
def test_una_foto_de_la_camara_o_de_la_galeria_acaba_en_la_identidad(ajustes_tactil, entrada):
    pagina = ajustes_tactil
    _subir(pagina, "degradado.png", "image/png", _png(pagina), entrada)
    pagina.wait_for_selector('#identidad input[value="foto"]')
    assert pagina.evaluate(TAMANO_FOTO)[:2] == [256, 256]
    identidad = _identidad(pagina)
    assert identidad["avatar"] == {"tipo": "foto"}
    assert identidad["foto"].startswith("data:image/jpeg;base64,")
    assert pagina.locator("#mensaje-foto").inner_text() == "Foto guardada. Ya es tu avatar."


def test_un_rechazo_por_la_camara_sale_en_el_mismo_mensaje(ajustes_tactil):
    pagina = ajustes_tactil
    _subir(pagina, "notas.txt", "text/plain", b"hola", "hacer-foto")
    mensaje = pagina.locator("#mensaje-foto.aviso")
    mensaje.wait_for()
    assert "Eso no es una imagen" in mensaje.inner_text()
    assert _identidad(pagina) is None or _identidad(pagina)["foto"] is None
