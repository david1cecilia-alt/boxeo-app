"""La tarjeta de la combinación en la sesión, en un navegador de verdad (Chromium headless con Playwright).

A 390 px se pinta cada nombre corto de data/acciones.json (diestro y zurdo) como un paso de la sesión y
ninguno se sale de la tarjeta. Sin Playwright se salta en local; en CI falla.
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

# Cada nombre corto (de las acciones y de su espejo) como un paso con su círculo, como lo pinta
# entrenar.js, y cuánto se sale (px) de la caja de contenido de la tarjeta. Devuelve [texto, px, líneas].
MEDIR = """async () => {
  const { catalogo, espejo, nombreCorto } = await import("./motor/acciones.js");
  const acciones = [...catalogo().values()];
  const nombres = [...new Map([...acciones, ...acciones.map(espejo)].map((a) => [nombreCorto(a), a.tipo]))];
  const combo = document.querySelector("#combo");
  const tarjeta = combo.closest(".tarjeta-combo");
  const estilo = getComputedStyle(tarjeta);
  const caja = tarjeta.getBoundingClientRect();
  const izquierda = caja.left + parseFloat(estilo.borderLeftWidth) + parseFloat(estilo.paddingLeft);
  const derecha = caja.right - parseFloat(estilo.borderRightWidth) - parseFloat(estilo.paddingRight);
  return nombres.map(([texto, tipo]) => {
    combo.innerHTML = `<ol class="pasos"><li class="paso-${tipo}"><i>4</i></li></ol>`;
    const li = combo.querySelector("li");
    li.append(texto);
    const rango = document.createRange();
    rango.selectNodeContents(li);
    const r = rango.getBoundingClientRect();
    const alto = parseFloat(getComputedStyle(li).lineHeight) || r.height;
    return [texto, Math.max(izquierda - r.left, r.right - derecha, li.scrollWidth - li.clientWidth),
            Math.round(rango.getClientRects().length && li.getBoundingClientRect().height / alto)];
  });
}"""


@pytest.fixture(scope="module")
def medidas(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de la sesión necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, VACIA, 390, 844) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        pagina.goto(f"{ORIGEN}/index.html#entrenar")
        pagina.click("#empezar")
        pagina.wait_for_selector(".tarjeta-combo", state="visible")
        pagina.click("#pausa")  # que el dictado no pise lo que se pinta
        resultado = pagina.evaluate(MEDIR)
        assert not errores, errores
        return resultado


def test_estan_todos_los_nombres_cortos_diestro_y_zurdo(medidas):
    textos = {t for t, _, _ in medidas}
    assert {"croch. dcha. abajo", "croch. izq. abajo", "esq. abajo dcha.", "esq. abajo izq."} <= textos


def test_ningun_nombre_corto_se_sale_de_la_tarjeta_a_390(medidas):
    fuera = {t: round(px, 1) for t, px, _ in medidas if px > 0.5}
    assert not fuera, f"Se salen de la tarjeta (px): {fuera}"
