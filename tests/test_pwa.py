"""La web estática (PWA) lleva todo lo necesario para funcionar sin servidor."""
import json
import re

import pytest

from herramientas.construir_sitio import RAIZ, construir


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    # Sin fotos del maniquí (necesitan Playwright): las prueba tests/test_fotos_maniqui.py.
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


def _precache(sitio) -> list[str]:
    sw = (sitio / "sw.js").read_text(encoding="utf-8")
    lista = re.search(r"const FICHEROS = \[(.*?)\];", sw, re.S).group(1)
    return re.findall(r'"([^"]+)"', lista)


def test_el_service_worker_precachea_todos_los_ficheros_del_sitio(sitio):
    en_sitio = {p.relative_to(sitio).as_posix() for p in sitio.rglob("*") if p.is_file()}
    en_sitio -= {"sw.js"}
    assert set(_precache(sitio)) - {"./"} == en_sitio


def test_cada_version_estrena_cache(sitio):
    assert 'const VERSION = "boxeo-prueba"' in (sitio / "sw.js").read_text(encoding="utf-8")


def test_el_sitio_lleva_los_mismos_datos_que_el_motor_python(sitio):
    for nombre in ("acciones", "combos", "perfil", "presets"):
        fichero = f"{nombre}.json"
        assert (sitio / "data" / fichero).read_bytes() == (RAIZ / "data" / fichero).read_bytes()


def test_manifest_instalable(sitio):
    manifest = json.loads((sitio / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["display"] == "standalone" and manifest["start_url"] == "./"
    tamanos = {i["sizes"] for i in manifest["icons"] if i["type"] == "image/png"}
    assert {"192x192", "512x512"} <= tamanos
    assert any(i["purpose"] == "maskable" for i in manifest["icons"])
    for icono in manifest["icons"]:
        assert (sitio / icono["src"]).is_file(), icono["src"]


def test_el_perfil_publicado_no_lleva_datos_personales(sitio):
    perfil = json.loads((sitio / "data" / "perfil.json").read_text(encoding="utf-8"))
    assert "nombre" not in perfil


def test_las_fotos_de_fondo_se_publican_en_webp_y_sin_los_originales(sitio):
    # Los PNG originales no se versionan: solo están en el equipo de quien los generó.
    originales = {p.stem for p in (RAIZ / "static" / "imagenes" / "originales").glob("*.png")}
    publicadas = {p.stem for p in (sitio / "imagenes").glob("*.webp")}
    assert publicadas and originales <= publicadas
    assert not list(sitio.rglob("imagenes/**/*.png"))


def test_el_maniqui_3d_pesa_menos_de_1_mb():
    # Lo que se descarga al abrir una ficha con maniquí: Three.js, la escena y las posturas.
    ficheros = [RAIZ / "static" / "vendor" / "three" / "three.module.min.js",
                *(RAIZ / "static" / "maniqui").glob("*.js"), RAIZ / "data" / "posturas.json"]
    assert sum(f.stat().st_size for f in ficheros) < 1_000_000
