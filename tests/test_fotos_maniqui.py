"""Sin WebGL, cada paso de las fichas con postura tiene su foto del maniquí en la web montada.

Las fotos se pintan al montar el sitio (herramientas/fotos_maniqui.py) con Playwright: sin él se
saltan en local; en CI fallan.
"""
import importlib.util
import json
import os

import pytest

from herramientas.construir_sitio import RAIZ, construir
from herramientas.fotos_maniqui import ALTO, ANCHO, ORIGEN, abrir, fotos_necesarias

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las fotos del maniquí necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba")


def _medidas_webp(datos: bytes) -> tuple[int, int]:
    assert datos[:4] == b"RIFF" and datos[8:12] == b"WEBP", "no es una WebP"
    tipo = datos[12:16]
    if tipo == b"VP8X":
        return (int.from_bytes(datos[24:27], "little") + 1, int.from_bytes(datos[27:30], "little") + 1)
    if tipo == b"VP8 ":
        return (int.from_bytes(datos[26:28], "little") & 0x3FFF, int.from_bytes(datos[28:30], "little") & 0x3FFF)
    bits = int.from_bytes(datos[21:25], "little")  # VP8L
    return ((bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1)


def test_cada_paso_con_postura_tiene_su_foto(sitio):
    necesarias = fotos_necesarias(RAIZ)
    assert necesarias, "Ninguna ficha tiene pasos con postura"
    faltan = sorted(r for r in necesarias if not (sitio / r).is_file())
    assert not faltan, f"Faltan fotos del maniquí: {faltan}"
    for ruta in necesarias:
        datos = (sitio / ruta).read_bytes()
        assert _medidas_webp(datos) == (ANCHO, ALTO), ruta
        assert len(datos) > 4000, f"{ruta} parece vacía"


def test_las_fotos_van_al_precache(sitio):
    sw = (sitio / "sw.js").read_text(encoding="utf-8")
    assert "FOTOS_MANIQUI" not in sw
    for ruta in fotos_necesarias(RAIZ):
        assert f'"{ruta}"' in sw, ruta


@pytest.mark.parametrize("zurdo", [False, True], ids=["ortodoxa", "zurda"])
def test_sin_webgl_la_ficha_muestra_las_fotos_de_sus_pasos(sitio, zurdo):
    # Lo que ve el usuario: el maniquí de cada ficha con ?sinwebgl carga una foto por paso.
    tecnica = json.loads((RAIZ / "data" / "tecnica.json").read_text(encoding="utf-8"))
    html = f"""<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="estilos.css">
    <div id="m"></div>
    <script type="module">
    import {{ crearManiqui }} from "./maniqui/maniqui.js";
    const datos = await (await fetch("data/posturas.json")).json();
    const tecnica = await (await fetch("data/tecnica.json")).json();
    const m = document.getElementById("m");
    window.resultado = {{}};
    for (const ficha of tecnica.fichas) {{
      const maniqui = await crearManiqui(m, {{ pasos: ficha.pasos, datos, zurdo: {str(zurdo).lower()} }});
      const fotos = [...m.querySelectorAll("img.maniqui-foto")];
      await Promise.all(fotos.map((f) => f.decode().catch(() => null)));
      window.resultado[ficha.id] = {{
        canvas: m.querySelectorAll("canvas").length,
        fotos: fotos.map((f) => [new URL(f.src).pathname, f.naturalWidth]),
      }};
      maniqui.destruir();
    }}
    window.listo = true;
    </script>"""
    with abrir(sitio, html, 390, 844) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html?sinwebgl")
        pagina.wait_for_function("window.listo === true", timeout=30_000)
        resultado = pagina.evaluate("window.resultado")
    assert not errores
    for ficha in tecnica["fichas"]:
        con_postura = [p for p in ficha["pasos"] if p.get("postura")]
        if not con_postura:
            continue
        r = resultado[ficha["id"]]
        assert r["canvas"] == 0, ficha["id"]
        guardia = "zurda" if zurdo else "ortodoxa"
        assert [ruta for ruta, _ in r["fotos"]] == \
            [f"/maniqui/fotos/{p['postura']}-{guardia}.webp" for p in con_postura], ficha["id"]
        assert all(ancho == ANCHO for _, ancho in r["fotos"]), f"{ficha['id']}: alguna foto no carga"
