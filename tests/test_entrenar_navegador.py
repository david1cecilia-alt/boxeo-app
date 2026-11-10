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
    pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")  # la app ya ha arrancado


def elecciones(pagina):
    """Las pastillas de «Tu sesión», unidas con « · »."""
    return " · ".join(pagina.locator("#resumen-elecciones li").all_inner_texts())


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
    pagina.click(f'#tipo-sesion label:has(input[value="{tipo}"])')


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
    pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
    entrenar_un_poco(pagina)                      # Prueba
    sesiones = guardado(pagina)["sesiones"]
    assert [s.get("tipo") for s in sesiones] == ["prueba", "personalizada", "general", None]
    assert [s["nivel"] for s in sesiones[1:3]] == [3, 1]

    pagina.goto(f"{ORIGEN}/index.html#historial/dia/{hoy}")
    pagina.wait_for_selector(".titulo-sesion")
    titulos = pagina.locator(".titulo-sesion").all_inner_texts()
    assert titulos == ["Prueba", "Personalizada · nivel 3", "General · nivel 1", "Amateur 3×3 · nivel 2"]


# ---------- General | Personalizada y D3 ----------

# La Personalizada de 6.2 del plan, guardada, con la General elegida.
PERSONALIZADA = {"nivel": 2, "ritmo": 4, "mezcla": "poco", "personalizada": {"asaltos": 4, "duracion_asalto": 120, "descanso": 45}}
PROPIAS = [{"id": "p-0", "ids": ["jab", "directo", "gancho_izq", "directo"], "creada": "2026-11-04T10:00:00"}]
AVISO_GENERAL = "Estás en General. Estos son los ajustes de tu Personalizada; si cambias algo, pasarás a ella."
AVISO_PRUEBA = "Estás en Prueba. Estos son los ajustes de tu Personalizada; si cambias algo, pasarás a ella."


def tipo_marcado(pagina):
    return pagina.eval_on_selector('#tipo-sesion input[name="tipo"]:checked', "e => e.value")


def abrir_personalizar(pagina):
    pagina.evaluate("location.hash = '#entrenar/menu/personalizar'")
    pagina.wait_for_selector("#niveles", state="visible")


def cerrar_menu(pagina):
    pagina.click(".menu-cerrar")
    pagina.wait_for_function("!document.querySelector('#menu').open")


def controles(pagina):
    return pagina.evaluate("""() => [
      ...['#asaltos', '#duracion', '#descanso', '#ritmo'].map((s) => document.querySelector(s).value),
      document.querySelector('input[name=nivel]:checked').value, document.querySelector('input[name=mezcla]:checked').value]""")


def sesion_guardada(pagina):
    return guardado(pagina)["perfil"]["sesion"]


def test_d3_con_la_general_el_menu_ensena_la_personalizada_y_tocar_algo_pasa_a_ella(pagina):
    preparar(pagina, {"combinacionesPropias": PROPIAS, "perfil": {"sesion": {"tipo": "general", **PERSONALIZADA}}})
    assert tipo_marcado(pagina) == "general"
    abrir_personalizar(pagina)
    # Lo guardado de la Personalizada (no 3×3 ni Básico), con el aviso.
    assert controles(pagina) == ["4", "120", "45", "4", "2", "poco"]
    assert pagina.inner_text("#aviso-personalizar") == AVISO_GENERAL
    assert pagina.get_attribute("#aviso-personalizar", "role") == "status"
    # Cambiar solo el nivel: Personalizada = lo guardado + el cambio; nada toma el valor de la General.
    pagina.click('#menu-personalizar label:has(input[name="nivel"][value="3"])')
    s = sesion_guardada(pagina)
    assert s["tipo"] == "personalizada"
    assert (s["nivel"], s["ritmo"], s["mezcla"], s["personalizada"]) == (3, 4, "poco", PERSONALIZADA["personalizada"])
    assert tipo_marcado(pagina) == "personalizada"
    assert pagina.locator("#aviso-personalizar").is_hidden()
    assert pagina.inner_text("#resumen-grande").startswith("4 × 2:00")
    assert "Nivel avanzado" in elecciones(pagina)
    # Volver a General no borra nada: al reabrir, la Personalizada sigue con el nivel 3 (y vuelve el aviso).
    cerrar_menu(pagina)
    elegir_tipo(pagina, "general")
    assert sesion_guardada(pagina)["nivel"] == 3
    abrir_personalizar(pagina)
    assert controles(pagina) == ["4", "120", "45", "4", "3", "poco"]
    assert pagina.inner_text("#aviso-personalizar") == AVISO_GENERAL


def test_con_la_personalizada_elegida_no_hay_aviso(pagina):
    preparar(pagina, {"perfil": {"sesion": {"tipo": "personalizada", **PERSONALIZADA}}})
    abrir_personalizar(pagina)
    assert pagina.locator("#aviso-personalizar").is_hidden()
    assert pagina.inner_text("#aviso-personalizar") == ""


def test_con_prueba_el_aviso_dice_prueba_y_tocar_algo_pasa_a_la_personalizada(pagina):
    preparar(pagina, {"perfil": {"sesion": {"tipo": "general", **PERSONALIZADA}}}, consulta="?prueba")
    assert tipo_marcado(pagina) == "prueba"
    abrir_personalizar(pagina)
    assert pagina.inner_text("#aviso-personalizar") == AVISO_PRUEBA
    pagina.click("#reaccion")
    s = sesion_guardada(pagina)
    assert (s["tipo"], s["reaccion"], s["nivel"]) == ("personalizada", True, 2)
    assert tipo_marcado(pagina) == "personalizada"
    assert pagina.locator("#aviso-personalizar").is_hidden()


def test_a_medio_escribir_no_se_guarda_ni_pasa_a_la_personalizada_e_intro_no_empieza(pagina):
    preparar(pagina, {"perfil": {"sesion": {"tipo": "general", **PERSONALIZADA}}})
    abrir_personalizar(pagina)
    pagina.fill("#duracion", "")  # vacío: no vale
    assert sesion_guardada(pagina)["tipo"] == "general"
    pagina.keyboard.press("Enter")
    assert pagina.is_hidden("#pantalla") and not pagina.evaluate("document.body.classList.contains('entrenando')")
    pagina.fill("#duracion", "150")
    s = sesion_guardada(pagina)
    assert (s["tipo"], s["personalizada"]) == ("personalizada", {"asaltos": 4, "duracion_asalto": 150, "descanso": 45})
    pagina.keyboard.press("Enter")
    assert pagina.is_hidden("#pantalla")


def test_el_resumen_de_la_general_dice_su_nivel_y_no_el_de_la_personalizada(pagina):
    preparar(pagina, {"combinacionesPropias": PROPIAS, "perfil": {"sesion": {"tipo": "general", **PERSONALIZADA}}})
    assert pagina.inner_text("#resumen-grande").startswith("3 × 3:00")
    resumen = elecciones(pagina)
    assert resumen.startswith("Nivel básico · Constante"), resumen
    assert "Nivel medio" not in resumen and "tuyas" not in resumen
    elegir_tipo(pagina, "personalizada")
    # La Personalizada: nivel medio; «Poco» de las tuyas no cuenta porque la única propia es de básico.
    assert elecciones(pagina).startswith("Nivel medio · Vivo")


def test_con_prueba_cambiar_la_guardia_no_la_quita_y_prueba_no_se_guarda(pagina):
    preparar(pagina, {"perfil": {"sesion": {"tipo": "personalizada", **PERSONALIZADA}}}, consulta="?prueba")
    assert tipo_marcado(pagina) == "prueba"
    pagina.evaluate("location.hash = '#entrenar/menu/ajustes'")
    pagina.wait_for_selector("#voz-id", state="visible")
    pagina.click('#menu-ajustes label:has(input[name="guardia"][value="zurdo"])')
    assert tipo_marcado(pagina) == "prueba"
    assert pagina.inner_text("#resumen-grande").startswith("2 × 0:30")
    assert sesion_guardada(pagina)["tipo"] == "personalizada"  # lo de antes: Prueba nunca se guarda
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#empezar")
    assert tipo_marcado(pagina) == "personalizada"


# ---------- La página: cabecera, selector, «Tu sesión», barra ----------

def test_la_cabecera_es_un_solo_enlace_que_lleva_al_perfil(pagina):
    preparar(pagina, {"perfil": {"sesion": {"zurdo": True}, "estilo": {"mi_estilo": "fajador"}}})
    cabecera = pagina.locator(".cabecera-perfil")
    assert cabecera.count() == 1 and cabecera.get_attribute("href") == "#perfil"
    # Un solo elemento enfocable: nada dentro se enfoca aparte.
    assert cabecera.locator("a, button, input, [tabindex]").count() == 0
    assert " ".join(cabecera.inner_text().split()) == "Tu perfil Fajador · Zurdo"
    assert cabecera.locator("img").count() == 0  # sin nombre ni avatar todavía (R5): un icono genérico
    cabecera.click()
    pagina.wait_for_selector("#vista-perfil:not([hidden])")
    assert pagina.evaluate("location.hash") == "#perfil"


def test_el_selector_tiene_general_y_personalizada_y_prueba_solo_con_el_parametro(pagina):
    preparar(pagina, {})
    assert pagina.locator("#tipo-sesion label").all_inner_texts() == ["General", "Personalizada"]
    pagina.goto(f"{ORIGEN}/index.html?prueba#entrenar")
    pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
    assert pagina.locator("#tipo-sesion label").all_inner_texts() == ["General", "Personalizada", "Prueba 2×30 s"]


def test_la_barra_trae_entrenar_aprende_e_historial_y_entrenar_ya_no_tiene_foto(pagina):
    preparar(pagina, {})
    assert pagina.locator("#pestanas a").evaluate_all("(as) => as.map((a) => a.getAttribute('href'))") == [
        "#entrenar", "#aprende", "#historial"]
    assert pagina.locator("#vista-entrenar :is(.foto-cabecera, .marca-agua.vertical, .marca-movil, #presets, #avanzados)").count() == 0
    assert pagina.locator("#vista-entrenar .cabecera").count() == 0  # ni el titular
    assert pagina.locator("#vista-entrenar h1").count() == 1  # el de los lectores (destino del foco)
    # Las fotos de Aprende e Historial se quedan (D9).
    assert pagina.locator("#vista-aprende .foto-cabecera, #vista-historial .foto-cabecera").count() == 2


def test_la_guardia_de_ajustes_cambia_la_general_y_su_sesion_sale_con_lo_de_d1(pagina):
    pagina.clock.install()
    preparar(pagina, {"perfil": {"sesion": {"tipo": "general", **PERSONALIZADA}, "practicar": [{"movimiento": "3"}]}})
    pagina.evaluate("location.hash = '#entrenar/menu/ajustes'")
    pagina.wait_for_selector("#voz-id", state="visible")
    pagina.click('#menu-ajustes label:has(input[name="guardia"][value="zurdo"])')
    cerrar_menu(pagina)
    assert tipo_marcado(pagina) == "general"
    assert "Zurdo" in elecciones(pagina)
    entrenar_un_poco(pagina)
    s = guardado(pagina)["sesiones"][0]
    # La General zurda: 3:00 con 1:00 de descanso, nivel de data/perfil.json, sin Reacción (D1).
    assert (s["tipo"], s["zurdo"], s["duracion_asalto"], s["descanso"], s["nivel"], s["modo_reaccion"], s["ritmo"]) == (
        "general", True, 180, 60, 1, False, 3)


def test_a_1440_dos_columnas_tu_sesion_fija_y_el_margen_del_asa(pagina):
    pagina.set_viewport_size({"width": 1440, "height": 900})
    preparar(pagina, {})
    caja = lambda s: pagina.locator(s).bounding_box()  # noqa: E731
    cabecera, selector, sesion, empezar = caja(".cabecera-perfil"), caja("#tipo-sesion"), caja(".tu-sesion"), caja("#empezar")
    assert sesion["x"] > selector["x"] + selector["width"]  # «Tu sesión» a la derecha del selector
    assert abs(sesion["y"] - selector["y"]) <= 1 and cabecera["y"] < selector["y"]
    assert empezar["y"] > sesion["y"] + sesion["height"] and abs(empezar["x"] - sesion["x"]) <= 1
    assert pagina.eval_on_selector(".derecha-entrenar", "(e) => getComputedStyle(e).position") == "sticky"
    # Margen de 112 px a la derecha de la columna (desde el borde de la zona visible, la del asa fija).
    borde = pagina.evaluate("document.documentElement.clientWidth")
    assert borde - (sesion["x"] + sesion["width"]) >= 112
    asa = caja("#asa .asa-puntos")
    assert asa["x"] - (empezar["x"] + empezar["width"]) >= 36  # 36 px libres hasta Empezar (2.1)


# ---------- El asa no tapa nada (geometría) ----------

# Cajas que no deben cruzarse con la visible del asa. `visible` recorta Empezar a lo que no tapa el panel
# (con el menú abierto el panel opaco lo cubre; así se comprobó en el boceto, 2.1).
CAJAS = """({ abierto }) => {
  const rect = (e) => e.getBoundingClientRect();
  const asa = rect(document.querySelector(abierto ? '#menu .asa-panel .asa-puntos' : '#asa .asa-puntos'));
  const panel = rect(document.querySelector('.menu-panel'));
  const empezar = rect(document.querySelector('#empezar'));
  const visible = abierto ? { ...empezar.toJSON(), right: Math.min(empezar.right, panel.left) } : empezar.toJSON();
  const controles = abierto ? [...document.querySelectorAll(
      '#menu :is(input, select, button:not(.asa-panel), summary, a, label, .hueco)')]
    .filter((e) => e.getClientRects().length && e.checkVisibility()).map((e) => [e.id || e.className || e.tagName, rect(e).toJSON()]) : [];
  // El texto de «Tu sesión», línea a línea (Range: solo donde hay letras, no la caja entera).
  const textos = [];
  const andar = document.createTreeWalker(document.querySelector('.tu-sesion'), NodeFilter.SHOW_TEXT);
  while (andar.nextNode()) {
    if (!andar.currentNode.textContent.trim()) continue;
    const r = document.createRange(); r.selectNodeContents(andar.currentNode);
    for (const l of r.getClientRects()) textos.push([andar.currentNode.textContent.trim(), l.toJSON()]);
  }
  return { asa: asa.toJSON(), empezar: visible, sesion: rect(document.querySelector('.tu-sesion')).toJSON(), controles, textos };
}"""


def cruzan(a, b):
    return a["left"] < b["right"] and b["left"] < a["right"] and a["top"] < b["bottom"] and b["top"] < a["bottom"]


@pytest.mark.parametrize("ancho, alto", [(390, 844), (1440, 900)])
@pytest.mark.parametrize("tipo", ["general", "personalizada"])
def test_el_asa_no_tapa_empezar_ni_los_controles_ni_el_texto(pagina, ancho, alto, tipo):
    pagina.set_viewport_size({"width": ancho, "height": alto})
    preparar(pagina, {"perfil": {"sesion": {"tipo": tipo, "zurdo": True, "reaccion": True, **PERSONALIZADA},
                                 "practicar": [{"movimiento": "3"}]}})
    pagina.evaluate("document.fonts.ready")
    # Cerrado: ni Empezar ni el texto de «Tu sesión»; a 1440, ni siquiera la caja de «Tu sesión».
    c = pagina.evaluate(CAJAS, {"abierto": False})
    assert not cruzan(c["asa"], c["empezar"])
    for texto, caja in c["textos"]:
        assert not cruzan(c["asa"], caja), texto
    if ancho >= 1024:
        assert not cruzan(c["asa"], c["sesion"])
    # Abierto: el asa de la franja del panel, ni con Empezar ni con ningún control del panel, en cada sección.
    pagina.evaluate("location.hash = '#entrenar/menu/personalizar'")
    pagina.wait_for_function("getComputedStyle(document.querySelector('.menu-panel')).transform === 'none'")
    assert pagina.locator("#asa").evaluate("(e) => getComputedStyle(e).visibility") == "hidden"
    for seccion in ("personalizar", "combinaciones", "ajustes"):
        pagina.evaluate(f"document.querySelector(\"[data-seccion='{seccion}']\").open = true")
        for y in (0, 400, 800, 100000):  # el panel, desplazado de arriba abajo
            pagina.evaluate(f"document.querySelector('.menu-contenido').scrollTop = {y}")
            c = pagina.evaluate(CAJAS, {"abierto": True})
            assert not cruzan(c["asa"], c["empezar"]), (seccion, y)
            for nombre, caja in c["controles"]:
                assert not cruzan(c["asa"], caja), (seccion, y, nombre)
