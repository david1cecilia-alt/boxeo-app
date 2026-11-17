"""convertir_imagenes.py: las WebP salen a su tamaño, salvo el ring, que se queda en 1080 px como máximo, y relanzar
el script no cambia lo publicado."""
from pathlib import Path

import pytest

from herramientas.convertir_imagenes import IMAGENES, MAX_LADO, ORIGINALES, tamano_destino, tamano_png


def tamano_webp(webp: Path) -> tuple[int, int]:
    """Ancho y alto de una WebP (VP8, VP8L o VP8X), leídos de su cabecera."""
    datos = webp.read_bytes()
    trozo = datos[12:16]
    if trozo == b"VP8X":
        return int.from_bytes(datos[24:27], "little") + 1, int.from_bytes(datos[27:30], "little") + 1
    if trozo == b"VP8 ":
        return int.from_bytes(datos[26:28], "little") & 0x3FFF, int.from_bytes(datos[28:30], "little") & 0x3FFF
    bits = int.from_bytes(datos[21:25], "little")  # VP8L
    return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1


def test_nunca_se_amplia_y_el_lado_mayor_se_queda_en_el_maximo():
    assert tamano_destino(680, 768, None) == (680, 768)
    assert tamano_destino(680, 768, 1080) == (680, 768)
    assert tamano_destino(1254, 1254, 1080) == (1080, 1080)
    assert tamano_destino(1920, 1080, 1080) == (1080, 608)


def test_el_ring_sale_a_1080_px_como_maximo():
    assert MAX_LADO == {"ring-cenital": 1080}
    assert tamano_webp(IMAGENES / "ring-cenital.webp") == (1080, 1080)


@pytest.mark.skipif(not list(ORIGINALES.glob("*.png")), reason="los PNG originales no se versionan")
def test_cada_webp_tiene_el_tamano_que_le_daria_el_script():
    for png in sorted(ORIGINALES.glob("*.png")):
        esperado = tamano_destino(*tamano_png(png), MAX_LADO.get(png.stem))
        assert tamano_webp(IMAGENES / f"{png.stem}.webp") == esperado, png.name


def test_el_ring_borroso_se_deriva_del_ring_y_relanzar_no_lo_cambia():
    from PIL import Image, ImageChops, ImageFilter, ImageStat

    from herramientas.convertir_imagenes import LADO_BORROSO, RING, RING_BORROSO, ring_borroso

    publicado = Image.open(RING_BORROSO).convert("RGB")
    assert max(publicado.size) <= LADO_BORROSO and publicado.size == Image.open(RING).size
    assert RING_BORROSO.stat().st_size < 20_000  # ligero: en el precache de sw.js
    # Lo mismo que daría el script hoy (sin comparar bytes: el codificador WebP puede cambiar entre versiones).
    diferencia = ImageStat.Stat(ImageChops.difference(publicado, ring_borroso())).mean
    assert max(diferencia) < 2, diferencia

    # Borroso de verdad: casi sin bordes, frente a los del ring nítido.
    def bordes(imagen):
        return sum(ImageStat.Stat(imagen.convert("L").filter(ImageFilter.FIND_EDGES)).mean)
    assert bordes(publicado) < bordes(Image.open(RING)) / 5  # hoy, unas 7,7 veces menos
