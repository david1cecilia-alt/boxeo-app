"""Monta la web estática (PWA, sin servidor): static/ + data/*.json en una carpeta.

Además pinta las fotos del maniquí para los dispositivos sin WebGL
(herramientas/fotos_maniqui.py, necesita Playwright) y las añade al precache del service worker.

Uso: python herramientas/construir_sitio.py _site [version]
La versión (p. ej. el commit) da nombre a la caché del service worker.
"""
import re
import shutil
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas import fotos_maniqui  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
MARCA_FOTOS = re.compile(r"^ *// FOTOS_MANIQUI:.*\n", re.M)


def construir(destino: Path, version: str = "dev", fotos: bool = True) -> Path:
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(RAIZ / "static", destino)
    (destino / "data").mkdir()
    for fichero in (RAIZ / "data").glob("*.json"):
        shutil.copy2(fichero, destino / "data" / fichero.name)
    sw = destino / "sw.js"
    texto = sw.read_text(encoding="utf-8").replace('"boxeo-dev"', f'"boxeo-{version}"')
    if fotos:
        rutas = fotos_maniqui.generar(destino)
        texto = MARCA_FOTOS.sub("".join(f'  "{r}",\n' for r in rutas), texto)
    sw.write_text(texto, encoding="utf-8")
    return destino


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        raise SystemExit(__doc__)
    construir(Path(sys.argv[1]), *sys.argv[2:])
