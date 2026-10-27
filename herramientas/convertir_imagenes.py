"""Pasa las fotos de fondo de static/imagenes/originales/ (PNG) a WebP en static/imagenes/.

En color y a su tamaño (nunca se amplían). Se codifican con el Chromium de Playwright, el mismo
que pinta las fotos del maniquí, para no añadir dependencias. Los originales ni se versionan
(.gitignore) ni se publican (construir_sitio.py se salta la carpeta): solo van las WebP.

Uso: python herramientas/convertir_imagenes.py
"""
import base64
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.fotos_maniqui import abrir  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
IMAGENES = RAIZ / "static" / "imagenes"
ORIGINALES = IMAGENES / "originales"
CALIDAD = 0.8

PAGINA = f"""<!doctype html><meta charset="utf-8"><canvas></canvas>
<script>
window.convertir = async (ruta) => {{
  const img = new Image();
  img.src = ruta;
  await img.decode();
  const lienzo = document.querySelector("canvas");
  lienzo.width = img.naturalWidth;
  lienzo.height = img.naturalHeight;
  lienzo.getContext("2d").drawImage(img, 0, 0);
  return lienzo.toDataURL("image/webp", {CALIDAD});
}};
</script>"""


def convertir() -> list[Path]:
    hechas = []
    with abrir(IMAGENES, PAGINA) as (pagina, errores):
        pagina.goto("http://boxeo.local/__pagina__.html")
        for png in sorted(ORIGINALES.glob("*.png")):
            datos = pagina.evaluate("ruta => convertir(ruta)", f"originales/{png.name}")
            if not datos.startswith("data:image/webp"):
                raise RuntimeError(f"{png.name}: el navegador no ha devuelto WebP")
            destino = IMAGENES / f"{png.stem}.webp"
            destino.write_bytes(base64.b64decode(datos.split(",", 1)[1]))
            hechas.append(destino)
        if errores:
            raise RuntimeError("; ".join(errores))
    return hechas


if __name__ == "__main__":
    for fichero in convertir():
        print(f"{fichero.relative_to(RAIZ).as_posix()}  {fichero.stat().st_size // 1024} KB")
