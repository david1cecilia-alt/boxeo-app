"""Pasa las fotos de fondo de static/imagenes/originales/ (PNG) a WebP en static/imagenes/.

En color y a su tamaño (nunca se amplían), salvo las de MAX_LADO, que se reducen a ese lado mayor. Se codifican con el Chromium de Playwright, el mismo
que pinta las fotos del maniquí. Los originales ni se versionan
(.gitignore) ni se publican (construir_sitio.py se salta la carpeta): solo van las WebP.

Después deriva ring-cenital-borroso.webp (el fondo de los asaltos y los descansos) de ring-cenital.webp, que sí se
versiona: con Pillow, un desenfoque gaussiano fuerte hecho en el fichero (nada de filter: blur en CSS). Así sale
igual en un equipo sin los originales.

Uso: python herramientas/convertir_imagenes.py
"""
import base64
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageFilter  # noqa: E402

from herramientas.fotos_maniqui import abrir  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
IMAGENES = RAIZ / "static" / "imagenes"
ORIGINALES = IMAGENES / "originales"
CALIDAD = 0.8
# Lado mayor máximo, en px, de las que se publican más pequeñas que su original (el ring: 1254 → 1080).
MAX_LADO = {"ring-cenital": 1080}
# El ring borroso: radio del desenfoque (en px de la imagen de 1080), lado mayor máximo y calidad WebP (0-100).
RING = IMAGENES / "ring-cenital.webp"
RING_BORROSO = IMAGENES / "ring-cenital-borroso.webp"
RADIO_BORROSO = 40
LADO_BORROSO = 1080
CALIDAD_BORROSO = 75

PAGINA = f"""<!doctype html><meta charset="utf-8"><canvas></canvas>
<script>
window.convertir = async (ruta, ancho, alto) => {{
  const img = new Image();
  img.src = ruta;
  await img.decode();
  const lienzo = document.querySelector("canvas");
  lienzo.width = ancho ?? img.naturalWidth;
  lienzo.height = alto ?? img.naturalHeight;
  const contexto = lienzo.getContext("2d");
  contexto.imageSmoothingQuality = "high";
  contexto.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  return lienzo.toDataURL("image/webp", {CALIDAD});
}};
</script>"""


def tamano_destino(ancho: int, alto: int, maximo: int | None) -> tuple[int, int]:
    """El tamaño de la WebP: el del original o, si su lado mayor pasa de `maximo`, reducido en proporción."""
    if maximo is None or max(ancho, alto) <= maximo:
        return ancho, alto
    escala = maximo / max(ancho, alto)
    return round(ancho * escala), round(alto * escala)


def tamano_png(png: Path) -> tuple[int, int]:
    """Ancho y alto de un PNG, leídos de su cabecera IHDR (sin dependencias)."""
    cabecera = png.read_bytes()[16:24]
    return int.from_bytes(cabecera[:4], "big"), int.from_bytes(cabecera[4:], "big")


def convertir() -> list[Path]:
    hechas = []
    with abrir(IMAGENES, PAGINA) as (pagina, errores):
        pagina.goto("http://boxeo.local/__pagina__.html")
        for png in sorted(ORIGINALES.glob("*.png")):
            ancho, alto = tamano_destino(*tamano_png(png), MAX_LADO.get(png.stem))
            datos = pagina.evaluate("([ruta, ancho, alto]) => convertir(ruta, ancho, alto)",
                                    [f"originales/{png.name}", ancho, alto])
            if not datos.startswith("data:image/webp"):
                raise RuntimeError(f"{png.name}: el navegador no ha devuelto WebP")
            destino = IMAGENES / f"{png.stem}.webp"
            destino.write_bytes(base64.b64decode(datos.split(",", 1)[1]))
            hechas.append(destino)
        if errores:
            raise RuntimeError("; ".join(errores))
    return hechas


def ring_borroso(origen: Path = RING) -> Image.Image:
    """El ring de `origen`, a LADO_BORROSO px como máximo y con un desenfoque gaussiano de RADIO_BORROSO px."""
    with Image.open(origen) as imagen:
        ring = imagen.convert("RGB")
    ring.thumbnail((LADO_BORROSO, LADO_BORROSO), Image.Resampling.LANCZOS)  # nunca amplía
    return ring.filter(ImageFilter.GaussianBlur(RADIO_BORROSO))


def guardar_ring_borroso(origen: Path = RING, destino: Path = RING_BORROSO) -> Path:
    ring_borroso(origen).save(destino, "WEBP", quality=CALIDAD_BORROSO, method=6)
    return destino


if __name__ == "__main__":
    for fichero in [*convertir(), guardar_ring_borroso()]:
        print(f"{fichero.relative_to(RAIZ).as_posix()}  {fichero.stat().st_size // 1024} KB")
