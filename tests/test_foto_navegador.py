"""static/foto.js en un navegador de verdad (Chromium headless con Playwright): la foto del avatar.

Las imágenes de prueba se generan en la propia página (un degradado, mitades de color), nunca fotos de
personas. Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

VACIA = """<!doctype html><meta charset="utf-8"><script>window.listo = true;</script>"""

# Prepara la imagen que dé `dibujar` (un lienzo ancho × alto) con prepararFoto y devuelve el data URL,
# su tamaño en bytes, sus medidas y el color de unos puntos (o el texto del error).
PREPARAR = """async ({ ancho, alto, dibujo, exif, tipo }) => {
  const { prepararFoto } = await import('./foto.js');
  const lienzo = new OffscreenCanvas(ancho, alto);
  const c = lienzo.getContext('2d');
  if (dibujo === 'degradado') {
    const g = c.createLinearGradient(0, 0, ancho, alto);
    g.addColorStop(0, '#1d4ed8'); g.addColorStop(0.5, '#f59e0b'); g.addColorStop(1, '#16a34a');
    c.fillStyle = g; c.fillRect(0, 0, ancho, alto);
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(ancho / 2, alto / 2, alto / 4, 0, 2 * Math.PI); c.fill();
  } else {  // mitades: izquierda roja, derecha azul
    c.fillStyle = '#ff0000'; c.fillRect(0, 0, ancho / 2, alto);
    c.fillStyle = '#0000ff'; c.fillRect(ancho / 2, 0, ancho / 2, alto);
  }
  let bytes = new Uint8Array(await (await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.95 })).arrayBuffer());
  if (exif) {
    // APP1 Exif tras el SOI con una sola entrada: Orientation (0x0112) = exif.
    const app1 = [0xFF, 0xE1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01,
      0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, exif, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
    bytes = new Uint8Array([...bytes.slice(0, 2), ...app1, ...bytes.slice(2)]);
  }
  try {
    const datos = await prepararFoto(new File([bytes], 'prueba.jpg', { type: tipo ?? 'image/jpeg' }));
    const img = new Image();
    img.src = datos;
    await img.decode();
    const lectura = new OffscreenCanvas(img.naturalWidth, img.naturalHeight).getContext('2d');
    lectura.drawImage(img, 0, 0);
    const color = (x, y) => [...lectura.getImageData(x, y, 1, 1).data.slice(0, 3)];
    return { datos: datos.slice(0, 23), bytes: atob(datos.split(',')[1]).length, largo: datos.length,
             ancho: img.naturalWidth, alto: img.naturalHeight,
             arriba: color(128, 40), abajo: color(128, 216), izquierda: color(40, 128), derecha: color(216, 128) };
  } catch (e) {
    return { error: e.message };
  }
}"""


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de la foto necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.fixture
def pagina(sitio):
    with abrir(sitio, VACIA, 390, 844) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        yield pagina
        assert not errores


def rojo(c):
    return c[0] > 200 and c[1] < 60 and c[2] < 60


def azul(c):
    return c[0] < 60 and c[1] < 60 and c[2] > 200


def test_un_degradado_de_800_por_600_sale_en_256_por_256_jpeg_de_menos_de_60_kb(pagina):
    r = pagina.evaluate(PREPARAR, {"ancho": 800, "alto": 600, "dibujo": "degradado", "exif": 0})
    assert r["datos"] == "data:image/jpeg;base64,"
    assert (r["ancho"], r["alto"]) == (256, 256)
    assert r["bytes"] < 60_000
    assert r["largo"] < 200_000  # cabe de sobra en MAX_FOTO del almacén


def test_el_recorte_es_centrado(pagina):
    # 300 × 100 con la izquierda roja y la derecha azul: el cuadrado del centro (x 100-200) sigue partido.
    r = pagina.evaluate(PREPARAR, {"ancho": 300, "alto": 100, "dibujo": "mitades", "exif": 0})
    assert rojo(r["izquierda"]) and azul(r["derecha"])


def test_la_orientacion_exif_del_movil_se_respeta(pagina):
    # Guardada en horizontal (izquierda roja, derecha azul) con Orientation = 6 (girar 90° a la derecha):
    # se ve en vertical con el rojo arriba y el azul abajo.
    r = pagina.evaluate(PREPARAR, {"ancho": 200, "alto": 100, "dibujo": "mitades", "exif": 6})
    assert (r["ancho"], r["alto"]) == (256, 256)
    assert rojo(r["arriba"]) and azul(r["abajo"]), r


def test_lo_que_no_se_puede_leer_se_rechaza_con_un_texto_claro(pagina):
    r = pagina.evaluate("""async () => {
      const { prepararFoto } = await import('./foto.js');
      const intentar = (partes, tipo) => prepararFoto(new File(partes, 'x', { type: tipo })).then(() => 'aceptada', (e) => e.message);
      return [await intentar(['hola'], 'text/plain'), await intentar([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99])], 'image/heic'),
              await intentar([new Uint8Array([1, 2, 3])], '')];
    }""")
    assert r == ["Eso no es una imagen: elige una foto JPG, PNG o WebP.",
                 "No se puede leer esta imagen (puede ser HEIC). Prueba con una JPG o PNG.",
                 "No se puede leer esta imagen (puede ser HEIC). Prueba con una JPG o PNG."]
