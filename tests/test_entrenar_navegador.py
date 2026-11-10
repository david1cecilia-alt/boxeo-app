"""Entrenar en un navegador de verdad (Chromium headless con Playwright): qué sesión sale con lo elegido
(General, Personalizada o Prueba) y cómo se guarda. Los datos de prueba solo viven en el localStorage de este
Chromium. Sin Playwright se salta en local; en CI falla.
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
# Una voz que no suena y acaba a los 400 ms (el dictado espera a que termine cada frase).
VOZ_FALSA = """(() => {
  const falsa = {
    speaking: false, pending: false, onvoiceschanged: null,
    getVoices: () => [], addEventListener() {}, removeEventListener() {}, cancel() {},
    speak(frase) { setTimeout(() => frase.onend?.(), 400); },
  };
  Object.defineProperty(window, "speechSynthesis", { value: falsa, configurable: true });
})();"""


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de Entrenar necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.fixture
def pagina(sitio):
    with abrir(sitio, VACIA, 390, 844) as (pagina, errores):
        pagina.add_init_script(VOZ_FALSA)
        yield pagina
        assert not errores


def preparar(pagina, datos, ruta="#entrenar", consulta=""):
    """Deja `datos` (almacén v9) en el localStorage y abre la app."""
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps({"version": 9, **datos}))
    pagina.goto(f"{ORIGEN}/index.html{consulta}{ruta}")
    pagina.wait_for_selector("#empezar")


def guardado(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))


def entrenar_un_poco(pagina):
    """Empieza, deja pasar unos segundos (con el reloj de Playwright) y para; salta la valoración."""
    pagina.click("#empezar")
    pagina.wait_for_selector("#pantalla:not([hidden])")
    for _ in range(6):
        pagina.clock.run_for(5000)
    pagina.click("#parar")
    pagina.wait_for_selector("#postsesion[open]")
    pagina.keyboard.press("Escape")
    pagina.wait_for_selector("#postsesion:not([open])", state="attached")


def elegir_tipo(pagina, tipo):
    pagina.click(f'#presets label:has(input[value="{tipo}"])')


# ---------- El tipo de cada sesión (General, Personalizada o Prueba) ----------

def test_cada_sesion_guarda_su_tipo_y_el_historial_la_nombra_por_el(pagina):
    pagina.clock.install()
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    hoy = pagina.evaluate("""() => { const d = new Date(), dos = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`; }""")
    # Una sesión de antes (sin tipo), de hoy a las 00:00:01: la última de la lista del día.
    vieja = {"id": "vieja", "fecha": f"{hoy}T00:00:01", "asaltos": 3, "nivel": 2, "zurdo": False,
             "duracion_asalto": 180, "descanso": 60, "combinaciones": []}
    preparar(pagina, {"sesiones": [vieja], "perfil": {"sesion": {
        "tipo": "general", "nivel": 3, "personalizada": {"asaltos": 3, "duracion_asalto": 180, "descanso": 60}}}})
    entrenar_un_poco(pagina)                      # General
    elegir_tipo(pagina, "personalizada")
    entrenar_un_poco(pagina)                      # Personalizada 3×3 de nivel 3
    pagina.goto(f"{ORIGEN}/index.html?prueba#entrenar")
    pagina.wait_for_selector("#empezar")
    entrenar_un_poco(pagina)                      # Prueba
    sesiones = guardado(pagina)["sesiones"]
    assert [s.get("tipo") for s in sesiones] == ["prueba", "personalizada", "general", None]
    assert [s["nivel"] for s in sesiones[1:3]] == [3, 1]

    pagina.goto(f"{ORIGEN}/index.html#historial/dia/{hoy}")
    pagina.wait_for_selector(".titulo-sesion")
    titulos = pagina.locator(".titulo-sesion").all_inner_texts()
    assert titulos == ["Prueba", "Personalizada · nivel 3", "General · nivel 1", "Amateur 3×3 · nivel 2"]
