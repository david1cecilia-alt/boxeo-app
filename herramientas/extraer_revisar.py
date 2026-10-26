"""Extrae los puntos «REVISAR CON ENTRENADOR» del motor y de data/ a data/revisar.json.

La pestaña Perfil los muestra para apuntar la respuesta del entrenador (solo en el
navegador; no cambia el motor). tests/test_revisar.py falla si el JSON no está al día.
Uso: python herramientas/extraer_revisar.py
"""
import hashlib
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "data" / "revisar.json"
MARCA = "REVISAR CON ENTRENADOR:"


def _punto(origen: str, texto: str) -> dict:
    texto = texto.strip().rstrip(".;").strip()
    # El id depende solo del texto: si cambia el punto, su respuesta anterior ya no aplica.
    resumen = hashlib.sha1(texto.encode("utf-8")).hexdigest()[:8]
    return {"id": f"{Path(origen).stem}-{resumen}", "origen": origen, "texto": texto}


def _cadenas(valor):
    if isinstance(valor, str):
        yield valor
    elif isinstance(valor, dict):
        for v in valor.values():
            yield from _cadenas(v)
    elif isinstance(valor, list):
        for v in valor:
            yield from _cadenas(v)


def extraer() -> list[dict]:
    puntos = []
    for fichero in sorted((RAIZ / "motor").glob("*.py")):
        for linea in fichero.read_text(encoding="utf-8").splitlines():
            if (m := re.search(rf"#\s*{MARCA}\s*(.+)", linea)):
                puntos.append(_punto(f"motor/{fichero.name}", m.group(1)))
    for fichero in sorted((RAIZ / "data").glob("*.json")):
        if fichero == SALIDA:
            continue
        for cadena in _cadenas(json.loads(fichero.read_text(encoding="utf-8"))):
            if MARCA not in cadena:
                continue
            resto = cadena.split(MARCA, 1)[1]
            # "(1) ...; (2) ...; (3) ..." -> un punto por número.
            partes = [p for p in re.split(r"\(\d+\)", resto) if p.strip()]
            puntos += [_punto(f"data/{fichero.name}", p) for p in partes]
    return puntos


def contenido() -> str:
    datos = {"_nota": "Generado por herramientas/extraer_revisar.py: no editar a mano.", "puntos": extraer()}
    return json.dumps(datos, ensure_ascii=False, indent=2) + "\n"


if __name__ == "__main__":
    SALIDA.write_text(contenido(), encoding="utf-8")
    print(f"{len(extraer())} puntos en {SALIDA.relative_to(RAIZ)}")
