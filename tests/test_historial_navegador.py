"""El Historial en un navegador de verdad (Chromium headless con Playwright): nada se sale de su casilla.

Se abre la web montada (sin fotos del maniquí) con sesiones de prueba en su localStorage y con
barra de desplazamiento, como en un PC (le quita 15 px al ancho). Sin Playwright se salta en local;
en CI falla.
"""
import importlib.util
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

ANCHOS = (390, 1024, 1440)

# Guarda las sesiones con el almacén y el historial de la app. En http://boxeo.local (no seguro)
# no hay crypto.randomUUID: los ids los pone la prueba. Septiembre, con dos cifras de sesiones.
SEMBRAR = """<!doctype html><meta charset="utf-8">
<script type="module">
import { crearAlmacen } from "./almacen.js";
import { crearHistorial } from "./historial.js";
let n = 0;
const historial = await crearHistorial(crearAlmacen({ crearId: () => `prueba-${++n}` }));
const fechas = [...Array(12)].map((_, i) => `2026-09-${String(i + 1).padStart(2, "0")}T18:00:00`)
  .concat("2026-05-12T18:00:00", "2026-10-21T18:00:00");
for (const fecha of fechas) {
  await historial.guardar({ fecha, asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 2, combinaciones: [] });
}
window.listo = true;
</script>"""

# Cuánto se sale (en px) el texto visible de `selector` de la caja de contenido de su `casilla`.
SOBRESALE = """([casilla, selector]) => [...document.querySelectorAll(casilla)].flatMap((c) => {
  const estilo = getComputedStyle(c);
  const caja = c.getBoundingClientRect();
  const izquierda = caja.left + parseFloat(estilo.borderLeftWidth) + parseFloat(estilo.paddingLeft);
  const derecha = caja.right - parseFloat(estilo.borderRightWidth) - parseFloat(estilo.paddingRight);
  return [...c.querySelectorAll(selector)].filter((e) => e.getClientRects().length).map((e) => {
    const rango = document.createRange();
    rango.selectNodeContents(e);
    const texto = rango.getBoundingClientRect();
    return [e.textContent.trim(), Math.max(izquierda - texto.left, texto.right - derecha)];
  });
})"""


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas del Historial necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.fixture(scope="module")
def pagina(sitio):
    with abrir(sitio, SEMBRAR, 390, 844, barras=True) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        yield pagina
        assert not errores


def _abrir_historial(pagina, ancho, ruta, esperar):
    pagina.set_viewport_size({"width": ancho, "height": 900})
    pagina.goto(f"{ORIGEN}/index.html#historial/{ruta}")
    pagina.wait_for_selector(esperar)
    pagina.evaluate("document.fonts.ready")
    pagina.add_style_tag(content="::-webkit-scrollbar { width: 15px; }")


@pytest.mark.parametrize("ancho", ANCHOS)
def test_en_el_ano_el_nombre_del_mes_cabe_en_su_casilla(pagina, ancho):
    _abrir_historial(pagina, ancho, "ano/2026", ".meses .celda")
    nombres = pagina.evaluate(SOBRESALE, [".meses .celda", "b > span"])
    assert len(nombres) == 12
    assert not [n for n in nombres if n[1] > 0], f"a {ancho} px se salen: {nombres}"
    cuentas = pagina.evaluate(SOBRESALE, [".meses .celda", ".cuenta-mes"])
    assert "12 sesiones" in [c[0] for c in cuentas]
    assert not [c for c in cuentas if c[1] > 0], f"a {ancho} px se salen: {cuentas}"


# 1280: desde ahí las cifras van en la columna izquierda, de 2/5 del ancho.
@pytest.mark.parametrize("ancho", ANCHOS + (1280,))
def test_las_etiquetas_de_las_cifras_caben_en_su_casilla(pagina, ancho):
    _abrir_historial(pagina, ancho, "mes/2026-09", ".cifras-mes")
    etiquetas = pagina.evaluate(SOBRESALE, [".cifras div", "dt"])
    assert "sesiones / mes" in [e[0] for e in etiquetas] or "sesión / mes" in [e[0] for e in etiquetas]
    assert len(etiquetas) == 6
    assert not [e for e in etiquetas if e[1] > 0], f"a {ancho} px se salen: {etiquetas}"


# Al abrir el detalle (o un día) el foco va a su título: se ve (subrayado rojo), sin recuadro blanco.
@pytest.mark.parametrize("ruta, titulo", [("local%3Aprueba-1", "#t-detalle"), ("dia/2026-09-01", "#t-periodo")])
def test_el_titulo_enfocado_se_subraya_sin_recuadro(pagina, ruta, titulo):
    _abrir_historial(pagina, 1440, ruta, titulo)
    pagina.keyboard.press("Shift")  # el foco por teclado: el que se ve
    pagina.goto(f"{ORIGEN}/index.html#historial/{ruta}")
    pagina.wait_for_function(f"document.activeElement?.matches('{titulo}')")
    foco = pagina.evaluate(f"""() => {{
      const t = document.querySelector('{titulo}');
      const e = getComputedStyle(t);
      return [t.matches(':focus-visible'), e.outlineStyle, e.textDecorationLine];
    }}""")
    assert foco == [True, "none", "underline"]
