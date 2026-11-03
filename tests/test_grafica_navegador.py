"""El gráfico del Historial en un navegador de verdad (Chromium headless con Playwright).

Arriba a la derecha, Asaltos / RPE: cambia título, unidad y
barras, se guarda en perfil.historial.grafica y, si lo guardado no vale, muestra asaltos. Con RPE,
los periodos sin RPE salen sin barra y con «–», nunca como un 0. Sin Playwright se salta en local;
en CI falla.
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

ANCHOS = (390, 1024, 1440)

# Dos sesiones, con fechas de hoy (el gráfico enseña las últimas semanas): una hoy con RPE 7 y otra
# hace dos semanas sin valorar. En http://boxeo.local no hay crypto.randomUUID: los ids los pone la
# prueba.
SEMBRAR = """<!doctype html><meta charset="utf-8">
<script type="module">
import { crearAlmacen } from "./almacen.js";
import { crearHistorial } from "./historial.js";
localStorage.clear();
let n = 0;
const almacen = crearAlmacen({ crearId: () => `prueba-${++n}` });
const historial = await crearHistorial(almacen);
const hace = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(12, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T12:00:00`;
};
for (const [dias, asaltos] of [[0, 3], [14, 2]]) {
  await historial.guardar({ fecha: hace(dias), asaltos, duracion_asalto: 180, descanso: 60, nivel: 2, combinaciones: [] });
}
almacen.guardarValoracion("local:prueba-1", { rpe: 7 });
window.listo = true;
</script>"""


@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas del gráfico necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, SEMBRAR, 390, 844, barras=True) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        yield pagina
        assert not errores


def _guardado(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))


def _poner_grafica(pagina, valor):
    """Deja perfil.historial.grafica como `valor` (None: sin la clave), como si viniera de antes."""
    pagina.evaluate("""(valor) => {
      const datos = JSON.parse(localStorage.getItem('boxeo'));
      if (valor === null) delete datos.perfil.historial.grafica;
      else datos.perfil.historial.grafica = valor;
      localStorage.setItem('boxeo', JSON.stringify(datos));
    }""", valor)


def _abrir(pagina, ancho=390):
    """Abre el Historial recargando la página: así relee lo guardado en localStorage."""
    pagina.set_viewport_size({"width": ancho, "height": 900})
    pagina.goto(f"{ORIGEN}/index.html#historial")
    pagina.reload()
    pagina.wait_for_selector(".grafico-semanas .barras")


def _pulsado(pagina):
    return pagina.locator('[data-modo][aria-pressed="true"]').get_attribute("data-modo")


def _titulo(pagina):
    return pagina.locator("#t-grafico").inner_text()


@pytest.mark.parametrize("valor", [None, "RPE", "barras", 3])
def test_sin_eleccion_valida_muestra_asaltos(pagina, valor):
    _abrir(pagina)
    _poner_grafica(pagina, valor)
    _abrir(pagina)
    assert _pulsado(pagina) == "asaltos"
    assert _titulo(pagina) == "Asaltos por semana"
    assert pagina.locator(".unidad-grafico").inner_text() == "asaltos"


def test_rpe_cambia_la_grafica_y_se_recuerda(pagina):
    _abrir(pagina)
    _poner_grafica(pagina, None)
    _abrir(pagina)
    asaltos = pagina.locator(".barras .valor").all_inner_texts()
    assert asaltos[-1] == "3" and "2" in asaltos
    pagina.click('[data-modo="rpe"]')
    assert _pulsado(pagina) == "rpe"
    assert pagina.locator('[data-modo="asaltos"]').get_attribute("aria-pressed") == "false"
    assert _titulo(pagina) == "RPE medio por semana"
    assert pagina.locator(".unidad-grafico").inner_text() == "RPE (0–10)"
    assert _guardado(pagina)["perfil"]["historial"] == {"agrupar": "semana", "grafica": "rpe"}
    assert _guardado(pagina)["version"] == 6
    # Se recuerda al volver al Historial desde otra pestaña y al recargar.
    pagina.evaluate("location.hash = '#entrenar'")
    pagina.wait_for_selector("#vista-entrenar h1", state="visible")
    pagina.evaluate("location.hash = '#historial'")
    pagina.wait_for_selector(".grafico-semanas .barras")
    assert _pulsado(pagina) == "rpe"
    _abrir(pagina)
    assert _pulsado(pagina) == "rpe"
    assert _titulo(pagina) == "RPE medio por semana"
    # Las otras escalas, con su título.
    pagina.click('[data-escala="mes"]')
    assert _titulo(pagina) == "RPE medio por mes"
    pagina.click('[data-escala="ano"]')
    assert _titulo(pagina) == "RPE medio por año"
    pagina.click('[data-escala="semana"]')
    pagina.click('[data-modo="asaltos"]')
    assert _titulo(pagina) == "Asaltos por semana"
    assert _guardado(pagina)["perfil"]["historial"]["grafica"] == "asaltos"


# Con RPE, las semanas sin sesiones y la que no tiene valoración: sin barra y «–», no un 0.
def test_con_rpe_las_semanas_sin_rpe_no_pintan_cero(pagina):
    _abrir(pagina)
    _poner_grafica(pagina, "rpe")
    _abrir(pagina)
    valores = pagina.locator(".barras .valor").all_inner_texts()
    altos = pagina.locator(".barras .barra").evaluate_all(
        "(bs) => bs.map((b) => parseFloat(getComputedStyle(b).getPropertyValue('--alto')))")
    assert valores[-1] == "7" and altos[-1] == pytest.approx(0.7)
    assert valores[:-1] == ["–"] * (len(valores) - 1)
    assert altos[:-1] == [0] * (len(altos) - 1)
    lectores = pagina.locator(".barras .solo-lectores").all_inner_texts()
    assert all("sin RPE" in t for t in lectores[:-1]) and "RPE medio 7" in lectores[-1]


@pytest.mark.parametrize("ancho", ANCHOS)
def test_asaltos_rpe_arriba_a_la_derecha_con_area_de_toque_de_48(pagina, ancho):
    _abrir(pagina, ancho)
    tarjeta = pagina.locator(".grafico-semanas").bounding_box()
    titulo = pagina.locator("#t-grafico").bounding_box()
    botones = [pagina.locator(f'[data-modo="{m}"]').bounding_box() for m in ("asaltos", "rpe")]
    for b in botones:
        assert b["height"] >= 48 and b["width"] >= 48, b
    # En la fila del título, en la mitad derecha y pegado al borde derecho de la tarjeta.
    assert botones[0]["x"] > tarjeta["x"] + tarjeta["width"] / 2
    assert botones[0]["y"] < titulo["y"] + titulo["height"] and titulo["y"] < botones[0]["y"] + 48
    assert tarjeta["x"] + tarjeta["width"] - (botones[1]["x"] + botones[1]["width"]) <= 17


def test_asaltos_rpe_funciona_con_teclado_y_el_foco_se_ve(pagina):
    _abrir(pagina)
    _poner_grafica(pagina, None)
    _abrir(pagina)
    pagina.focus('[data-modo="asaltos"]')
    pagina.keyboard.press("Tab")
    assert pagina.evaluate("document.activeElement.dataset.modo") == "rpe"
    pagina.keyboard.press("Space")
    assert _pulsado(pagina) == "rpe"
    pagina.keyboard.press("Shift+Tab")
    pagina.keyboard.press("Enter")
    assert _pulsado(pagina) == "asaltos"
    foco = pagina.evaluate("""() => {
      const b = document.activeElement;
      return [b.dataset.modo, b.matches(':focus-visible'), getComputedStyle(b).outlineStyle];
    }""")
    assert foco == ["asaltos", True, "solid"]
