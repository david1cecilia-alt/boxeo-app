"""Los avisos y el diálogo de confirmación de la app (static/vistas/confirmar.js) en un navegador de verdad
(Chromium headless con Playwright), en vez de alert() y confirm().

Borrar una sesión del Historial pregunta en un <dialog> modal con el foco en «Cancelar»; cancelar (botón,
Esc o velo) no borra y devuelve el foco a «Borrar sesión»; «Borrar» borra. Importar pasa por el mismo
diálogo y, si se cancela, no toca nada. Un fichero que no es JSON se dice junto a los botones de la copia
(role="alert"). En ningún caso sale un diálogo nativo. Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import json
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir
from tests.sin_intro import preparar

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

ANCHOS = (390, 1440)
ALTO = {390: 844, 1440: 900}
# Dos sesiones en el almacén (v9, con la pista vista: la ayuda solo toca lo de versión 9).
DATOS = {"version": 9, "valoraciones": {}, "combinacionesPropias": [], "perfil": {"practicar": []}, "sesiones": [
    {"id": f"s-{i}", "fecha": f"2026-11-0{i}T18:00:00", "asaltos": 3, "nivel": 2, "zurdo": False,
     "duracion_asalto": 180, "descanso": 60, "num_combinaciones": 0, "combinaciones": []} for i in (1, 2)]}
SEMBRAR = f"""<!doctype html><meta charset="utf-8">
<script>localStorage.clear(); localStorage.setItem("boxeo", {json.dumps(json.dumps(DATOS))}); window.listo = true;</script>"""
ABIERTO = "document.getElementById('d-confirmar')?.open === true"
FOCO = "document.activeElement?.id || document.activeElement?.textContent.trim()"


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas del diálogo necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.fixture
def abrir_app(sitio):
    contextos = []

    def nueva(ancho=390, ruta="#historial/local%3As-1"):
        gestor = abrir(sitio, SEMBRAR, ancho, ALTO[ancho])
        pagina, errores = gestor.__enter__()
        contextos.append((gestor, errores))
        pagina.nativos = []
        pagina.on("dialog", lambda d: (pagina.nativos.append(d.type), d.dismiss()))
        preparar(pagina)
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        pagina.goto(f"{ORIGEN}/index.html{ruta}")
        pagina.wait_for_selector("#borrar" if "/" in ruta else "#importar", state="attached")
        return pagina

    yield nueva
    for gestor, errores in contextos:
        gestor.__exit__(None, None, None)
        assert not errores


def sesiones(pagina):
    return [s["id"] for s in json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))["sesiones"]]


@pytest.mark.parametrize("ancho", ANCHOS)
def test_borrar_pregunta_con_el_foco_en_cancelar_y_cancelar_no_borra(abrir_app, ancho):
    pagina = abrir_app(ancho)
    pagina.click("#borrar")
    pagina.wait_for_function(ABIERTO)
    assert pagina.text_content("#t-confirmar") == "¿Borrar esta sesión?"
    assert pagina.inner_text("#detalle-confirmar") == "Se borra también su valoración. No se puede deshacer."
    assert pagina.evaluate(FOCO) == "Cancelar"
    assert pagina.get_attribute('#d-confirmar button[value="si"]', "class").split() == ["boton", "peligro"]
    pagina.click('#d-confirmar button[value=""]')
    assert not pagina.evaluate(ABIERTO)
    assert pagina.evaluate(FOCO) == "borrar"
    assert sesiones(pagina) == ["s-1", "s-2"]
    assert pagina.nativos == []


@pytest.mark.parametrize("como", ["Escape", "velo"])
def test_esc_o_el_velo_cancelan(abrir_app, como):
    pagina = abrir_app()
    pagina.click("#borrar")
    pagina.wait_for_function(ABIERTO)
    if como == "Escape":
        pagina.keyboard.press("Escape")
    else:
        pagina.mouse.click(5, 5)
    assert not pagina.evaluate(ABIERTO)
    assert pagina.evaluate(FOCO) == "borrar"
    assert sesiones(pagina) == ["s-1", "s-2"]


def test_el_foco_no_sale_del_dialogo_con_tab(abrir_app):
    pagina = abrir_app()
    pagina.click("#borrar")
    pagina.wait_for_function(ABIERTO)
    for _ in range(3):
        pagina.keyboard.press("Tab")
        assert pagina.evaluate("document.getElementById('d-confirmar').contains(document.activeElement)")


def test_confirmar_borra_la_sesion(abrir_app):
    pagina = abrir_app()
    pagina.click("#borrar")
    pagina.wait_for_function(ABIERTO)
    pagina.click('#d-confirmar button[value="si"]')
    pagina.wait_for_function("!location.hash.includes('s-1')")
    assert sesiones(pagina) == ["s-2"]
    assert pagina.nativos == []


def test_importar_pasa_por_el_dialogo_y_cancelar_no_toca_nada(abrir_app, tmp_path):
    pagina = abrir_app(ruta="#historial")
    antes = pagina.evaluate("localStorage.getItem('boxeo')")
    fichero = tmp_path / "copia.json"
    fichero.write_text(json.dumps({"app": "boxeo", "version": 9, "exportado": "2026-11-10",
                                   "datos": {**DATOS, "sesiones": []}}), encoding="utf-8")
    pagina.set_input_files("#importar", str(fichero))
    pagina.wait_for_function(ABIERTO)
    assert pagina.text_content("#t-confirmar") == "¿Importar la copia?"
    assert pagina.text_content('#d-confirmar button[value="si"]') == "Importar"
    pagina.keyboard.press("Escape")
    assert pagina.evaluate("localStorage.getItem('boxeo')") == antes
    assert pagina.nativos == []


def test_un_fichero_que_no_es_json_se_dice_junto_a_la_copia(abrir_app, tmp_path):
    pagina = abrir_app(ruta="#historial")
    fichero = tmp_path / "mala.json"
    fichero.write_text("esto no es json", encoding="utf-8")
    pagina.set_input_files("#importar", str(fichero))
    mensaje = pagina.locator("#mensaje-copia")
    mensaje.wait_for(state="visible")
    assert mensaje.inner_text() == "El fichero no es una copia válida (no es un JSON)."
    assert mensaje.get_attribute("role") == "alert"
    assert pagina.evaluate("document.querySelector('.copia').contains(document.getElementById('mensaje-copia'))")
    assert not pagina.evaluate(ABIERTO)
    assert pagina.nativos == []
