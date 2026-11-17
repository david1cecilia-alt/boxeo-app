"""El ring borroso de fondo en los asaltos (el descanso, verde y sin ring), en Chromium headless (Playwright), a 390×844 y 1440×900.

El contraste se mide con los píxeles reales: se hace una captura con los textos en transparente (se queda lo que
haya detrás: el ring, la tarjeta, un degradado...) y, píxel a píxel dentro de la caja de cada línea de texto, se
calcula el contraste WCAG con el color del texto. Cuenta el peor píxel. El reloj es texto grande (3:1); «Asalto N/M»,
la pastilla, el «Después…» / «Último asalto», la leyenda, la combinación anterior y el texto del teclado, 4,5:1.

En los últimos 10 s del asalto manda el rojo liso de siempre y en el resumen final el ring ya no está.
Una Prueba (2 × 30 s, descanso de 15 s) con el reloj de Playwright y una semilla fija. Sin Playwright se salta en
local; en CI falla.
"""
import importlib.util
import io
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir
from tests.sin_intro import preparar

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
SEMILLA = """const _g = crypto.getRandomValues.bind(crypto);
crypto.getRandomValues = (a) => (a instanceof Uint32Array && a.length === 1 ? (a[0] = 7, a) : _g(a));"""
INICIO = 1_800_000_000_000
# (segundos desde «Empezar ya», fase): asalto 1, descanso y asalto 2 (el último: «Último asalto»).
MOMENTOS = [(12, "asalto"), (32, "descanso"), (57, "asalto")]
TAMANOS = [(390, 844), (1440, 900)]

# Texto a medir: (nombre, selector, contraste mínimo).
TEXTOS = [
    ("reloj", "#tiempo", 3.0),
    ("asalto", "#asalto", 4.5),
    ("pastilla", "#fase", 4.5),
    ("despues", "#despues", 4.5),
    ("leyenda", "#leyenda", 4.5),
    ("anterior", "#anterior", 4.5),
    ("teclado", ".atajos", 4.5),
]

# Las cajas de cada línea de texto (Range sobre cada nodo de texto) con el color de su elemento.
CAJAS = """(textos) => textos.flatMap(([nombre, selector]) => {
  const raiz = document.querySelector(selector);
  if (!raiz || !raiz.checkVisibility()) return [];
  const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const cajas = [];
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    if (!n.textContent.trim() || !n.parentElement.checkVisibility()) continue;
    const rango = document.createRange();
    rango.selectNodeContents(n);
    const color = getComputedStyle(n.parentElement).color;
    for (const r of rango.getClientRects())
      if (r.width > 1 && r.height > 1) cajas.push({ nombre, color, x: r.x, y: r.y, ancho: r.width, alto: r.height });
  }
  return cajas;
})"""
OCULTAR = """(selectores) => {
  const estilo = document.createElement('style');
  estilo.id = 'medir';
  estilo.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }' +
    selectores.map((s) => `${s}, ${s} * { color: transparent !important; text-shadow: none !important; }`).join('');
  document.head.append(estilo);
}"""


def luminancia(r, g, b):
    def canal(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)


def leer_color(css):
    """rgb()/rgba() (0-255) o color(srgb …) (0-1, lo que da color-mix) → ([r, g, b] de 0 a 255, alfa)."""
    srgb = css.startswith("color(srgb")
    partes = css[css.index("(") + 1:-1].replace("srgb", "").replace("/", ",").replace(" ", ",").split(",")
    valores = [float(p) for p in partes if p]
    rgb = [v * 255 for v in valores[:3]] if srgb else valores[:3]
    return rgb, (valores[3] if len(valores) > 3 else 1.0)


def contraste_minimo(captura, caja):
    """El peor contraste entre el color del texto (mezclado si es translúcido) y los píxeles de su caja."""
    (r, g, b), alfa = leer_color(caja["color"])
    x0, y0 = max(0, int(caja["x"])), max(0, int(caja["y"]))
    x1 = min(captura.width, int(caja["x"] + caja["ancho"] + 0.999))
    y1 = min(captura.height, int(caja["y"] + caja["alto"] + 0.999))
    peor = 21.0
    for fr, fg, fb in set(captura.crop((x0, y0, x1, y1)).get_flattened_data()):
        texto = (r * alfa + fr * (1 - alfa), g * alfa + fg * (1 - alfa), b * alfa + fb * (1 - alfa))
        a, f = luminancia(*texto), luminancia(fr, fg, fb)
        peor = min(peor, (max(a, f) + 0.05) / (min(a, f) + 0.05))
    return peor


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de la sesión necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


def empezar(pagina):
    preparar(pagina)
    pagina.add_init_script(SEMILLA)
    pagina.emulate_media(reduced_motion="reduce")
    pagina.clock.install(time=INICIO)
    pagina.clock.pause_at(INICIO)
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    pagina.goto(f"{ORIGEN}/index.html?prueba#entrenar")
    pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
    pagina.click('#tipo-sesion label:has(input[value="prueba"])')
    pagina.click("#empezar")
    pagina.click("#empezar-ya")


def fondo(pagina):
    return pagina.evaluate("getComputedStyle(document.getElementById('pantalla')).backgroundImage")


def medir(pagina):
    from PIL import Image
    pagina.evaluate("document.fonts.ready")
    cajas = pagina.evaluate(CAJAS, [[n, s] for n, s, _ in TEXTOS])
    pagina.evaluate(OCULTAR, [s for _, s, _ in TEXTOS])
    captura = Image.open(io.BytesIO(pagina.screenshot())).convert("RGB")
    pagina.evaluate("document.getElementById('medir').remove()")
    medidas = {}
    for caja in cajas:
        medidas[caja["nombre"]] = min(medidas.get(caja["nombre"], 21.0), contraste_minimo(captura, caja))
    return medidas


@pytest.mark.parametrize("segundos,fase", MOMENTOS)
@pytest.mark.parametrize("ancho,alto", TAMANOS)
def test_en_el_asalto_sobre_el_ring_y_en_el_descanso_todo_el_texto_se_lee(sitio, ancho, alto, segundos, fase):
    with abrir(sitio, VACIA, ancho, alto, barras=ancho > 800) as (pagina, errores):
        empezar(pagina)
        pagina.clock.run_for(segundos * 1000)
        assert pagina.evaluate("document.getElementById('pantalla').dataset.fase") == fase
        if fase == "asalto":
            assert "ring-cenital-borroso.webp" in fondo(pagina)
        else:  # el descanso, con su verde de siempre y sin ring
            assert fondo(pagina) == "none"
            assert pagina.evaluate("getComputedStyle(document.getElementById('pantalla')).backgroundColor") ==                 "rgb(11, 59, 52)"  # --fase-descanso
        medidas = medir(pagina)
        print(ancho, alto, segundos, fase, {k: round(v, 2) for k, v in medidas.items()})
        assert {"reloj", "asalto", "pastilla", "despues", "teclado"} <= medidas.keys(), medidas
        for nombre, _, minimo in TEXTOS:
            if nombre in medidas:
                assert medidas[nombre] >= minimo, (nombre, medidas[nombre])
        # La tarjeta no se desborda (saldría una barra de desplazamiento).
        assert pagina.evaluate("""() => { const t = document.querySelector('.tarjeta-combo');
          return t.scrollWidth <= t.clientWidth && t.scrollHeight <= t.clientHeight + 1; }""")
        if segundos == 57:
            assert pagina.inner_text("#despues").lower() == "último asalto"
        assert not errores


@pytest.mark.parametrize("ancho,alto", TAMANOS)
def test_en_los_ultimos_10_s_manda_el_rojo_y_no_se_ve_el_ring(sitio, ancho, alto):
    from PIL import Image
    with abrir(sitio, VACIA, ancho, alto, barras=ancho > 800) as (pagina, errores):
        empezar(pagina)
        pagina.clock.run_for(25_000)
        assert pagina.evaluate("document.getElementById('pantalla').dataset.fase") == "final"
        assert fondo(pagina) == "none"
        pagina.add_style_tag(content="*, *::before, *::after { transition: none !important; }")
        captura = Image.open(io.BytesIO(pagina.screenshot())).convert("RGB")
        rojo = (0x9E, 0x2A, 0x2B)  # --fase-final (lejos de la marca de agua «R1»)
        for x, y in [(2, 2), (ancho - 20, 2), (ancho // 2, 2), (ancho - 20, alto // 2), (ancho - 20, alto - 2)]:
            assert captura.getpixel((x, y)) == rojo, (x, y)
        assert not errores


def test_en_el_resumen_final_el_ring_desaparece(sitio):
    with abrir(sitio, VACIA, 390, 844) as (pagina, errores):
        empezar(pagina)
        pagina.clock.run_for(80_000)  # 30 + 15 + 30 s: la sesión entera
        assert pagina.is_hidden("#pantalla")
        con_ring = pagina.evaluate("""() => [...document.querySelectorAll('*')].filter((e) => e.checkVisibility() &&
          getComputedStyle(e).backgroundImage.includes('ring-cenital')).map((e) => e.id || e.className)""")
        assert con_ring == []
        assert not errores
