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
BARRA = 15  # px de la barra de desplazamiento, como en un PC

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
// La de mayo es vieja: sin voz guardada, dictada en Ambos y con los nombres de antes («gancho» era el
// crochet; la rueda ya se llamaba «rueda»).
const VIEJA = [
  { asalto: 1, texto: "uno jab, tres gancho de izquierda, rueda derecha", ids: ["jab", "gancho_izq", "rodar_der"] },
  { asalto: 1, texto: "rueda izquierda, bloqueo", ids: ["rodar_izq", "bloqueo"] },
];
for (const fecha of fechas) {
  await historial.guardar({ fecha, asaltos: 3, duracion_asalto: 180, descanso: 60, nivel: 2,
    combinaciones: fecha.startsWith("2026-05") ? VIEJA : [] });
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
    # Si hay barra (la página no cabe en alto), tiene que quitar sus 15 px: a 390 quedan 375 útiles.
    # Si no los quitara, las pruebas medirían sin barra y no comprobarían lo que dicen.
    alto, ventana, util = pagina.evaluate(
        "[document.documentElement.scrollHeight, innerHeight, document.documentElement.clientWidth]")
    if alto > ventana:
        assert util == ancho - BARRA, f"a {ancho} px con barra quedan {util} px útiles, no {ancho - BARRA}"


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


FOCO_DEL_TITULO = """(titulo) => {
  const t = document.querySelector(titulo);
  const e = getComputedStyle(t);
  return [t.matches(':focus-visible'), e.outlineStyle, e.textDecorationLine];
}"""


# Al abrir el detalle (o un día) el foco va a su título: se ve (subrayado rojo), sin recuadro blanco.
@pytest.mark.parametrize("ruta, titulo", [("local%3Aprueba-1", "#t-detalle"), ("dia/2026-09-01", "#t-periodo")])
def test_el_titulo_enfocado_se_subraya_sin_recuadro(pagina, ruta, titulo):
    _abrir_historial(pagina, 1440, ruta, titulo)
    pagina.keyboard.press("Shift")  # el foco por teclado: el que se ve
    pagina.goto(f"{ORIGEN}/index.html#historial/{ruta}")
    pagina.wait_for_function(f"document.activeElement?.matches('{titulo}')")
    assert pagina.evaluate(FOCO_DEL_TITULO, titulo) == [True, "none", "underline"]


# Lo mismo en el título de cada vista (al llegar desde otra, el foco va a su h1) y en los que
# reciben el foco dentro de Ajustes. El foco no se quita: solo cambia cómo se ve.
@pytest.mark.parametrize("vista, desde", [("entrenar", "perfil"), ("historial", "entrenar"),
                                          ("perfil", "entrenar"), ("ajustes", "entrenar")])
def test_el_titulo_de_cada_vista_se_subraya_sin_recuadro(pagina, vista, desde):
    pagina.set_viewport_size({"width": 1440, "height": 900})
    pagina.goto(f"{ORIGEN}/index.html#{desde}")
    pagina.wait_for_selector(f"#vista-{desde} h1", state="visible")
    pagina.keyboard.press("Shift")
    pagina.evaluate(f"location.hash = '#{vista}'")
    pagina.wait_for_function(f"document.activeElement?.matches('#t-{vista}')")
    assert pagina.evaluate(FOCO_DEL_TITULO, f"#t-{vista}") == [True, "none", "underline"]


@pytest.mark.parametrize("vista, titulo", [("ajustes", "#t-practicar")])
def test_los_titulos_de_ajustes_se_subrayan_sin_recuadro(pagina, vista, titulo):
    pagina.set_viewport_size({"width": 1440, "height": 900})
    pagina.goto(f"{ORIGEN}/index.html#{vista}")
    pagina.wait_for_selector(titulo, state="attached")
    pagina.keyboard.press("Shift")
    pagina.evaluate(f"document.querySelector('{titulo}').focus()")  # como tras restablecer
    assert pagina.evaluate(FOCO_DEL_TITULO, titulo) == [True, "none", "underline"]


# Sesión vieja (prueba-13, la de mayo): en el detalle y en su valoración, los números en cifra y
# los nombres de hoy, con la voz deducida una vez para toda la sesión.
def test_la_sesion_vieja_se_ve_con_cifras_y_nombres_de_hoy(pagina):
    esperados = ["1 jab, 3 crochet de izquierda, rueda derecha", "rueda izquierda, bloqueo"]
    _abrir_historial(pagina, 390, "local%3Aprueba-13", "#t-detalle")
    detalle = pagina.locator("#historial-detalle ol li").all_inner_texts()
    assert [t.strip() for t in detalle] == esperados
    pagina.click("#valorar")
    pagina.click("#postsesion details.costosas summary")  # «Combinaciones que me han costado»
    valoracion = pagina.locator("#postsesion .grupo-combos label").all_inner_texts()
    assert [t.strip() for t in valoracion] == esperados
    pagina.keyboard.press("Escape")
