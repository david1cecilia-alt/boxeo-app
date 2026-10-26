"""Genera los PNG de la PWA a partir de static/iconos/guante.svg con Edge/Chrome headless.

Se ejecuta a mano solo cuando cambia el SVG; los PNG se guardan en el repositorio.
Uso: .venv\\Scripts\\python herramientas\\generar_iconos.py
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ICONOS = RAIZ / "static" / "iconos"
NAVEGADORES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
]

# (fichero, tamaño, maskable). Maskable: fondo a sangre y guante dentro de la zona segura (80 %).
SALIDAS = [
    ("icono-192.png", 192, False),
    ("icono-512.png", 512, False),
    ("icono-maskable-512.png", 512, True),
    ("apple-touch-icon.png", 180, True),  # iOS recorta sus propias esquinas
]


def _html(svg: str, tamano: int, maskable: bool) -> str:
    if maskable:
        svg = svg.replace('rx="112" ', "")
        svg = svg.replace('<g id="guante">', '<g id="guante" transform="translate(256 262) scale(0.74) translate(-256 -262)">')
    return (f"<!doctype html><html><body style='margin:0;background:transparent'>"
            f"<div style='width:{tamano}px;height:{tamano}px'>{svg.replace('<svg ', f'<svg width={tamano} height={tamano} ')}</div>"
            f"</body></html>")


def main() -> None:
    navegador = next((n for n in NAVEGADORES if Path(n).exists()), None) or shutil.which("msedge")
    if not navegador:
        raise SystemExit("No encuentro Edge ni Chrome")
    svg = (ICONOS / "guante.svg").read_text(encoding="utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        for nombre, tamano, maskable in SALIDAS:
            pagina = Path(tmp) / f"{nombre}.html"
            pagina.write_text(_html(svg, tamano, maskable), encoding="utf-8")
            subprocess.run([navegador, "--headless", "--disable-gpu", "--hide-scrollbars",
                            "--default-background-color=00000000", f"--window-size={tamano},{tamano}",
                            f"--screenshot={ICONOS / nombre}", pagina.as_uri()],
                           check=True, capture_output=True)
            print("generado", nombre)


if __name__ == "__main__":
    main()
