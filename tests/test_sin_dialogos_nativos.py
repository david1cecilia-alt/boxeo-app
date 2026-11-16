"""La app no usa los diálogos nativos del navegador (alert, confirm, prompt): bloquean la página, no se
pueden adaptar y en una PWA instalada se ven fuera de lugar. Los errores van en avisos con role="alert" y
las confirmaciones, en el diálogo de la app (static/vistas/confirmar.js).

Se buscan llamadas, no palabras: `role="alert"`, `confirmar(` o un texto que diga «alert» no cuentan. Los
comentarios se quitan antes de buscar.
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
STATIC = RAIZ / "static"

# alert( / window.alert( / confirm( / prompt( … pero no confirmar( ni objeto.alert( (otro método).
LLAMADA = re.compile(r"(?<![\w$.])(?:window\s*\.\s*)?(alert|confirm|prompt)\s*\(")
COMENTARIOS = re.compile(r"/\*.*?\*/|//[^\n]*", re.S)


def llamadas(codigo: str) -> list[str]:
    return [m.group(0) for m in LLAMADA.finditer(COMENTARIOS.sub("", codigo))]


def ficheros():
    yield from (f for f in STATIC.rglob("*.js") if "vendor" not in f.parts)
    yield from STATIC.rglob("*.html")


def test_la_busqueda_encuentra_llamadas_y_no_palabras():
    assert llamadas('alert("x"); window.alert(1); confirm ("¿?"); prompt(a)') == [
        'alert(', 'window.alert(', 'confirm (', 'prompt(']
    assert llamadas('<p role="alert"></p> confirmar({}); aviso.alert(); "un alert"; // alert(1)') == []


def test_ningun_fichero_de_la_app_llama_a_alert_confirm_ni_prompt():
    encontrados = {str(f.relative_to(RAIZ)): ll for f in ficheros() if (ll := llamadas(f.read_text(encoding="utf-8")))}
    assert encontrados == {}
