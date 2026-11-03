"""El Perfil en un navegador de verdad (Chromium headless con Playwright).

Ya no enseña el aviso de «orientativo / consultar con el entrenador» ni las secciones «Notas del
entrenador» y «Revisar con el entrenador», pero lo guardado de ellas sigue en el almacén. Sin
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

# Una nota del entrenador y una revisión guardadas de antes. En http://boxeo.local (no seguro) no
# hay crypto.randomUUID: el id lo pone la prueba.
SEMBRAR = """<!doctype html><meta charset="utf-8">
<script type="module">
import { crearAlmacen } from "./almacen.js";
localStorage.clear();
const almacen = crearAlmacen({ crearId: () => "nota-1" });
almacen.anadirNotaEntrenador("Baja la barbilla", "2026-10-20");
almacen.guardarRevision("punto-1", { respuesta: "Vale así", confirmado: true });
window.listo = true;
</script>"""


@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas del Perfil necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, SEMBRAR, 390, 844, barras=True) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        yield pagina
        assert not errores


def _guardado(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))


@pytest.mark.parametrize("ancho", (390, 1440))
def test_el_perfil_no_muestra_el_aviso_ni_las_secciones_del_entrenador(pagina, ancho):
    pagina.set_viewport_size({"width": ancho, "height": 900})
    pedidos = []
    pagina.on("request", lambda r: pedidos.append(r.url))
    pagina.goto(f"{ORIGEN}/index.html#perfil")
    pagina.wait_for_selector("#f-basicos")
    pagina.wait_for_function("!document.querySelector('#estilo-resumen').textContent.includes('Cargando')")
    texto = pagina.locator("#perfil-contenido").inner_text().lower()
    for frase in ("orientativo", "consúltalo", "entrenador", "notas del", "revisar"):
        assert frase not in texto, frase
    for selector in ("#t-notas", "#f-nota", "#t-revisar", "#lista-revisar", ".nota-estilo"):
        assert pagina.locator(selector).count() == 0, selector
    assert not [u for u in pedidos if u.endswith("data/revisar.json")]


def test_lo_guardado_del_entrenador_sigue_en_el_almacen(pagina):
    pagina.goto(f"{ORIGEN}/index.html#perfil")
    pagina.wait_for_selector("#f-basicos")
    pagina.fill('[data-campo="altura_cm"]', "180")
    pagina.locator('[data-campo="altura_cm"]').dispatch_event("change")
    datos = _guardado(pagina)
    assert datos["perfil"]["basicos"]["altura_cm"] == 180
    assert datos["notas_entrenador"] == [{"id": "nota-1", "fecha": "2026-10-20", "texto": "Baja la barbilla"}]
    assert datos["revisiones"]["punto-1"]["respuesta"] == "Vale así"
