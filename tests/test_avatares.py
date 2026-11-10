"""Los avatares predefinidos de data/avatares.json existen, son WebP de 256 px y tienen texto alternativo."""
import json
import struct

from herramientas.construir_sitio import RAIZ

AVATARES = json.loads((RAIZ / "data" / "avatares.json").read_text(encoding="utf-8"))["avatares"]
CARPETA = RAIZ / "static" / "imagenes" / "avatares"


def _tamano_webp(ruta) -> tuple[int, int]:
    b = ruta.read_bytes()[:30]
    assert b[:4] == b"RIFF" and b[8:12] == b"WEBP", ruta.name
    if b[12:16] == b"VP8 ":
        return tuple(x & 0x3FFF for x in struct.unpack("<HH", b[26:30]))
    if b[12:16] == b"VP8L":
        v = int.from_bytes(b[21:25], "little")
        return (v & 0x3FFF) + 1, ((v >> 14) & 0x3FFF) + 1
    return 1 + int.from_bytes(b[24:27], "little"), 1 + int.from_bytes(b[27:30], "little")


def test_ids_unicos_y_texto_alternativo():
    ids = [a["id"] for a in AVATARES]
    assert len(ids) == len(set(ids)) == 7
    for a in AVATARES:
        assert a["alt"].startswith("Avatar: ") and len(a["alt"]) > len("Avatar: ")


def test_cada_avatar_es_un_webp_cuadrado_de_256_px():
    for a in AVATARES:
        ruta = RAIZ / "static" / a["archivo"]
        assert ruta.name == f"{a['id']}.webp"
        assert _tamano_webp(ruta) == (256, 256), a["id"]


def test_no_sobra_ningun_fichero_en_la_carpeta():
    assert {p.name for p in CARPETA.iterdir()} == {f"{a['id']}.webp" for a in AVATARES}
