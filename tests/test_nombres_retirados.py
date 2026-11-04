"""Los nombres que se dejaron de usar no vuelven a aparecer en lo que ve u oye el usuario."""
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
# Lo que se publica con la web: los datos y la interfaz.
FICHEROS = sorted(p for carpeta in ("data", "static") for p in (RAIZ / carpeta).rglob("*")
                  if p.suffix in (".json", ".js", ".html", ".css") and "vendor" not in p.parts)
RETIRADOS = ("esquiva abajo", "esquivas abajo", "esq. abajo")


@pytest.mark.parametrize("ruta", FICHEROS, ids=lambda p: p.relative_to(RAIZ).as_posix())
def test_la_rueda_ya_no_se_llama_esquiva_abajo(ruta):
    texto = ruta.read_text(encoding="utf-8").lower()
    for nombre in RETIRADOS:
        assert nombre not in texto, nombre
