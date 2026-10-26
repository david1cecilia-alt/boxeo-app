"""Monta la web estática (PWA, sin servidor): static/ + data/*.json en una carpeta.

Uso: python herramientas/construir_sitio.py _site [version]
La versión (p. ej. el commit) da nombre a la caché del service worker.
"""
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def construir(destino: Path, version: str = "dev") -> Path:
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(RAIZ / "static", destino)
    (destino / "data").mkdir()
    for fichero in (RAIZ / "data").glob("*.json"):
        shutil.copy2(fichero, destino / "data" / fichero.name)
    sw = destino / "sw.js"
    sw.write_text(sw.read_text(encoding="utf-8").replace('"boxeo-dev"', f'"boxeo-{version}"'),
                  encoding="utf-8")
    return destino


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        raise SystemExit(__doc__)
    construir(Path(sys.argv[1]), *sys.argv[2:])
