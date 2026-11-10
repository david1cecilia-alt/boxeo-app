"""El almacén v9 con la interfaz de siempre, en un navegador de verdad (Chromium headless con Playwright).

Un almacén v8 real abre Entrenar con lo mismo elegido (la General o la Personalizada 3×3 que le da la
migración); «Practicar más» sale sin el cuánto; «Prueba 2×30 s» solo existe con ?prueba y no se guarda;
e importar una copia v8 desde el Historial la deja en v9 (una foto mala se quita y se avisa). Los datos
de prueba solo viven en el localStorage de este Chromium. Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import json
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
PROPIA = {"id": "p-uno", "ids": ["jab", "directo", "gancho_izq"], "creada": "2026-11-04T10:00:00Z"}


def v8(sesion=None, practicar=None):
    """Un almacén v8 como lo deja hoy la app: Amateur, nivel y guardia sin elegir, una propia."""
    return {
        "version": 8, "sesiones": [], "valoraciones": {}, "combinacionesPropias": [PROPIA],
        "perfil": {
            "practicar": practicar or [],
            "sesion": {"voz": "nombres", "ritmo": 3, "asalto": "amateur", "nivel": None, "zurdo": None,
                       "reaccion": False, "mezcla": "ninguna",
                       "personalizada": {"asaltos": 4, "duracion_asalto": 120, "descanso": 45}, **(sesion or {})},
        },
    }


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas del almacén v9 necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.fixture
def pagina(sitio):
    with abrir(sitio, VACIA, 390, 844) as (pagina, errores):
        yield pagina
        assert not errores


def ir(pagina, datos=None, ruta="#entrenar"):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    if datos is not None:
        pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(datos))
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    if "entrenar" in ruta:
        pagina.wait_for_selector('#presets input[name="preset"]:checked', state="attached")


def guardado(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))


def elegido(pagina):
    return pagina.eval_on_selector('input[name="preset"]:checked', "e => e.value")


def chips(pagina):
    return pagina.eval_on_selector_all('#presets input[name="preset"]', "es => es.map((e) => e.value)")


def test_un_v8_con_lo_de_la_general_abre_con_amateur_y_se_guarda_en_v9(pagina):
    ir(pagina, v8())
    assert elegido(pagina) == "general"
    assert pagina.inner_text("#resumen-config") == "3 × 3:00 · descanso 1:00"
    assert pagina.locator("#avanzados").is_hidden()
    datos = guardado(pagina)
    assert datos["version"] == 9
    assert datos["perfil"]["sesion"]["tipo"] == "general" and "asalto" not in datos["perfil"]["sesion"]
    assert datos["perfil"]["identidad"] == {"nombre": "", "avatar": None}
    assert datos["perfil"]["pistas"] == {"asa": False}
    assert datos["combinacionesPropias"] == [PROPIA]


def test_un_v8_con_amateur_y_elecciones_propias_abre_con_la_misma_sesion_en_personalizado(pagina):
    ir(pagina, v8({"nivel": 2, "mezcla": "poco", "ritmo": 4}))
    # La migración lo deja en Personalizada 3×3: lo que se ve y lo que se va a hacer, igual que antes.
    assert elegido(pagina) == "personalizada"
    assert pagina.inner_text("#resumen-config") == "3 × 3:00 · descanso 1:00"
    assert [pagina.input_value(f"#{c}") for c in ("asaltos", "duracion", "descanso")] == ["3", "180", "60"]
    assert pagina.is_checked('input[name="nivel"][value="2"]')
    assert pagina.is_checked('input[name="mezcla"][value="poco"]')
    assert pagina.input_value("#ritmo") == "4"
    # Elegir Amateur guarda la General; la Personalizada no se pierde.
    pagina.click('#presets label:has(input[value="general"])')
    sesion = guardado(pagina)["perfil"]["sesion"]
    assert sesion["tipo"] == "general"
    assert sesion["personalizada"] == {"asaltos": 3, "duracion_asalto": 180, "descanso": 60}
    pagina.click('#presets label:has(input[value="personalizada"])')
    assert guardado(pagina)["perfil"]["sesion"]["tipo"] == "personalizada"


def test_un_v8_con_personalizado_conserva_sus_valores(pagina):
    ir(pagina, v8({"asalto": "personalizado"}))
    assert elegido(pagina) == "personalizada"
    assert pagina.inner_text("#resumen-config") == "4 × 2:00 · descanso 0:45"
    # Cambiar la personalizada (en el menú) se sigue guardando.
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/personalizar")
    pagina.fill("#asaltos", "5")
    assert guardado(pagina)["perfil"]["sesion"]["personalizada"] == {"asaltos": 5, "duracion_asalto": 120, "descanso": 45}


def test_practicar_mas_de_un_v8_sale_sin_el_cuanto(pagina):
    ir(pagina, v8(practicar=[{"movimiento": "6", "cuanto": "bastante"}, {"movimiento": "rodar", "cuanto": "poco"}]),
       ruta="#entrenar/menu/personalizar")
    pagina.wait_for_selector("#t-practicar", state="visible")
    assert pagina.locator(".hueco.lleno h3").all_inner_texts() == ["6 gancho de derecha", "rueda"]
    assert pagina.locator("#f-practicar .segmentado, [data-cuanto]").count() == 0
    assert guardado(pagina)["perfil"]["practicar"] == [{"movimiento": "6"}, {"movimiento": "rodar"}]


def test_prueba_solo_con_el_parametro_y_nunca_se_guarda(pagina):
    ir(pagina, v8({"asalto": "personalizado"}))
    assert chips(pagina) == ["general", "personalizada"]
    assert pagina.locator("#presets").inner_text().count("Prueba") == 0
    # Con ?prueba aparece, sale elegida y la sesión es de 2 × 30 s; lo guardado no cambia.
    pagina.goto(f"{ORIGEN}/index.html?prueba#entrenar")
    pagina.wait_for_selector('#presets input[name="preset"]:checked', state="attached")
    assert chips(pagina) == ["general", "prueba", "personalizada"]
    assert elegido(pagina) == "prueba"
    assert pagina.inner_text("#resumen-config") == "2 × 0:30 · descanso 0:10"
    assert guardado(pagina)["perfil"]["sesion"]["tipo"] == "personalizada"
    pagina.click('#presets label:has(input[value="general"])')
    pagina.click('#presets label:has(input[value="prueba"])')
    assert guardado(pagina)["perfil"]["sesion"]["tipo"] == "general"
    # Sin ?prueba vuelve lo de siempre.
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.reload()
    pagina.wait_for_selector('#presets input[name="preset"]:checked', state="attached")
    assert chips(pagina) == ["general", "personalizada"]
    assert elegido(pagina) == "general"


def _importar(pagina, tmp_path, copia):
    fichero = tmp_path / "copia.json"
    fichero.write_text(json.dumps(copia), encoding="utf-8")
    dialogos = []

    def responder(d):
        dialogos.append((d.type, d.message))
        d.accept()

    pagina.on("dialog", responder)
    pagina.set_input_files("#importar", str(fichero))
    pagina.wait_for_function("""() => { const d = JSON.parse(localStorage.getItem('boxeo') ?? '{}');
      return d.version === 9 && d.sesiones?.length === 1; }""")
    return dialogos


def test_importar_una_copia_v8_la_deja_en_v9(pagina, tmp_path):
    ir(pagina, ruta="#historial")
    pagina.wait_for_selector("#importar", state="attached")
    datos = v8({"nivel": 3}, practicar=[{"movimiento": "cuerpo", "cuanto": "bastante"}])
    datos["sesiones"] = [{"id": "s-1", "fecha": "2026-11-08T18:00:00", "asaltos": 3, "nivel": 3, "zurdo": False,
                          "duracion_asalto": 180, "descanso": 60, "num_combinaciones": 0, "combinaciones": []}]
    dialogos = _importar(pagina, tmp_path, {"app": "boxeo", "version": 8, "exportado": "2026-11-09", "datos": datos})
    assert [t for t, _ in dialogos] == ["confirm"]  # sin avisos: no había nada mal formado
    assert pagina.is_hidden("#aviso-almacen")
    nuevo = guardado(pagina)
    assert nuevo["perfil"]["sesion"]["tipo"] == "personalizada"
    assert nuevo["perfil"]["practicar"] == [{"movimiento": "cuerpo"}]
    assert nuevo["perfil"]["identidad"] == {"nombre": "", "avatar": None}
    assert nuevo["combinacionesPropias"] == [PROPIA]
    # Entrenar lo enseña con la sesión de siempre.
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector('#presets input[name="preset"]:checked', state="attached")
    assert elegido(pagina) == "personalizada"
    assert pagina.inner_text("#resumen-config") == "3 × 3:00 · descanso 1:00"
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/personalizar")
    pagina.wait_for_selector("#niveles", state="visible")
    assert pagina.is_checked('input[name="nivel"][value="3"]')


def test_importar_una_copia_con_una_foto_mala_la_quita_y_avisa(pagina, tmp_path):
    ir(pagina, ruta="#historial")
    pagina.wait_for_selector("#importar", state="attached")
    datos = json.loads(json.dumps(v8()))
    datos["version"] = 9
    del datos["perfil"]["sesion"]["asalto"]
    datos["perfil"]["identidad"] = {"nombre": "Alex", "avatar": {"tipo": "foto", "datos": "data:image/svg+xml;base64,PHN2Zz4="}}
    datos["sesiones"] = [{"id": "s-1", "fecha": "2026-11-08T18:00:00", "asaltos": 1, "nivel": 1, "zurdo": False,
                          "duracion_asalto": 180, "descanso": 60, "num_combinaciones": 0, "combinaciones": []}]
    dialogos = _importar(pagina, tmp_path, {"app": "boxeo", "version": 9, "exportado": "2026-11-10", "datos": datos})
    # El aviso sale arriba (#aviso-almacen, role="alert"), sin alert() que bloquee la página.
    aviso = pagina.locator("#aviso-almacen")
    aviso.wait_for(state="visible")
    assert aviso.inner_text() == "La foto de tu avatar no era válida y se ha quitado."
    assert aviso.get_attribute("role") == "alert"
    assert [t for t, _ in dialogos] == ["confirm"]  # solo «¿Seguir?»: ningún alert
    assert guardado(pagina)["perfil"]["identidad"] == {"nombre": "Alex", "avatar": None}


def test_exportar_lleva_la_v9(pagina):
    ir(pagina, v8(), ruta="#historial")
    pagina.wait_for_selector("#exportar")
    with pagina.expect_download() as descarga:
        pagina.click("#exportar")
    copia = json.loads(open(descarga.value.path(), encoding="utf-8").read())
    assert copia["version"] == 9 and copia["datos"]["version"] == 9
    assert copia["datos"]["perfil"]["sesion"]["tipo"] == "general"
    assert copia["datos"]["perfil"]["identidad"] == {"nombre": "", "avatar": None}
