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
from tests.sin_intro import preparar as sin_intro  # aquí `preparar` es la de este fichero
from tests.menu_quieto import esperar_menu_quieto

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
        sin_intro(pagina)
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
    esperar_menu_quieto(pagina)


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
    esperar_menu_quieto(pagina)
    pagina.click('#menu-ajustes label:has(input[name="guardia"][value="zurdo"])')
    assert tipo_marcado(pagina) == "prueba"
    assert pagina.inner_text("#resumen-grande").startswith("2 × 0:30")
    assert sesion_guardada(pagina)["tipo"] == "personalizada"  # lo de antes: Prueba nunca se guarda
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")  # #empezar ya está en el HTML
    assert tipo_marcado(pagina) == "personalizada"


# ---------- La página: cabecera, selector, «Tu sesión», barra ----------

def test_la_cabecera_es_un_solo_enlace_que_lleva_al_perfil(pagina):
    preparar(pagina, {"perfil": {"sesion": {"zurdo": True}, "estilo": {"mi_estilo": "fajador"}}})
    cabecera = pagina.locator(".cabecera-perfil")
    assert cabecera.count() == 1 and cabecera.get_attribute("href") == "#perfil"
    # Un solo elemento enfocable: nada dentro se enfoca aparte.
    assert cabecera.locator("a, button, input, [tabindex]").count() == 0
    assert " ".join(cabecera.inner_text().split()) == "Tu perfil Fajador · Zurdo"
    # Sin nombre ni avatar: la inicial no hay, así que una silueta decorativa.
    assert cabecera.locator("img").count() == 0
    assert cabecera.locator(".avatar-inicial[aria-hidden='true'] svg").count() == 1
    cabecera.click()
    pagina.wait_for_selector("#vista-perfil:not([hidden])")
    assert pagina.evaluate("location.hash") == "#perfil"


FOTO = "data:image/jpeg;base64," + "A" * 400  # bien formada (fotoValida solo mira el formato)


def test_la_cabecera_ensena_el_nombre_y_la_inicial(pagina):
    preparar(pagina, {"perfil": {"identidad": {"nombre": "álex", "avatar": {"tipo": "inicial"}},
                                 "estilo": {"mi_estilo": "boxer"}}})
    cabecera = pagina.locator(".cabecera-perfil")
    assert cabecera.locator(".cabecera-perfil-nombre").inner_text() == "álex"
    inicial = cabecera.locator(".avatar-inicial")
    assert inicial.inner_text() == "Á" and inicial.get_attribute("aria-hidden") == "true"
    # El nombre accesible del enlace es el nombre y el estilo (la inicial no se lee).
    assert pagina.get_by_role("link", name="álex Boxer · Diestro").count() == 1


def test_la_cabecera_ensena_el_avatar_predefinido_o_la_foto_con_alt_vacio(pagina):
    preparar(pagina, {"perfil": {"identidad": {"nombre": "Alex", "avatar": {"tipo": "predefinido", "id": "chica-gorra"}}}})
    img = pagina.locator(".cabecera-perfil img.avatar")
    assert img.get_attribute("src") == "imagenes/avatares/chica-gorra.webp"
    assert img.get_attribute("alt") == ""
    assert pagina.locator(".cabecera-perfil-nombre").inner_text() == "Alex"
    preparar(pagina, {"perfil": {"identidad": {"nombre": "Alex", "avatar": {"tipo": "foto"}, "foto": FOTO}}})
    img = pagina.locator(".cabecera-perfil img.avatar")
    assert img.get_attribute("src") == FOTO
    assert img.get_attribute("alt") == ""
    assert pagina.get_by_role("link", name="Alex Descubre tu estilo · Diestro").count() == 1


def test_a_390_un_nombre_largo_cabe_en_una_linea_con_puntos_suspensivos(pagina):
    nombre = "Maximiliano Fernández-Castillo"
    preparar(pagina, {"perfil": {"identidad": {"nombre": nombre, "avatar": {"tipo": "inicial"}}}})
    caja = pagina.locator(".cabecera-perfil-nombre")
    medida = caja.evaluate("""(el) => ({ cabe: el.scrollWidth <= el.clientWidth, alto: el.getBoundingClientRect().height,
      linea: parseFloat(getComputedStyle(el).lineHeight) || 0, corte: getComputedStyle(el).textOverflow,
      derecha: el.getBoundingClientRect().right, flecha: el.closest('a').querySelector('.flecha').getBoundingClientRect().left })""")
    assert caja.inner_text() == nombre
    assert not medida["cabe"], "a 390 no cabe entero: se corta"
    assert medida["corte"] == "ellipsis"
    assert medida["alto"] < 30  # una sola línea
    assert medida["derecha"] <= medida["flecha"]  # no pisa la flecha


def test_lo_que_se_cambia_en_ajustes_sale_en_la_cabecera_sin_recargar(pagina):
    preparar(pagina, {}, ruta="#entrenar/menu/ajustes")
    pagina.wait_for_selector("#identidad #nombre", state="visible")
    esperar_menu_quieto(pagina)
    pagina.locator("#nombre").fill("Sam")
    pagina.locator("#nombre").dispatch_event("change")
    assert pagina.locator(".cabecera-perfil-nombre").inner_text() == "Sam"
    assert pagina.locator(".cabecera-perfil .avatar-inicial").inner_text() == "S"
    pagina.locator('#identidad input[value="predefinido:chico-oro"]').check()
    assert pagina.locator(".cabecera-perfil img.avatar").get_attribute("src") == "imagenes/avatares/chico-oro.webp"
    pagina.locator('#identidad input[value="inicial"]').check()
    assert pagina.locator(".cabecera-perfil img").count() == 0
    assert pagina.evaluate("performance.getEntriesByType('navigation').length") == 1  # sin recargar
    pagina.keyboard.press("Escape")
    pagina.wait_for_function("location.hash === '#entrenar'")
    assert pagina.locator(".cabecera-perfil-nombre").inner_text() == "Sam"


def test_el_selector_tiene_general_y_personalizada_y_prueba_solo_con_el_parametro(pagina):
    preparar(pagina, {})
    assert pagina.locator("#tipo-sesion label").all_inner_texts() == ["General", "Personalizada"]
    pagina.goto(f"{ORIGEN}/index.html?prueba#entrenar")
    pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
    assert pagina.locator("#tipo-sesion label").all_inner_texts() == ["General", "Personalizada", "Prueba 2×30 s"]


# Cuánto se sale el texto de cada chip de su caja, y si dos cajas de chip se cruzan.
CHIPS = """() => {
  const cajas = [...document.querySelectorAll('#tipo-sesion span')].map((s) => {
    const rango = document.createRange();
    rango.selectNodeContents(s);
    return [s.textContent, s.getBoundingClientRect(), rango.getBoundingClientRect()];
  });
  const sale = cajas.map(([t, c, r]) => [t, Math.max(c.left - r.left, r.right - c.right, c.top - r.top, r.bottom - c.bottom)]);
  const cruzan = cajas.slice(1).some(([, c], i) => c.left < cajas[i][1].right);
  return { sale, cruzan };
}"""


@pytest.mark.parametrize("ancho", [320, 390])
def test_con_prueba_ningun_chip_se_sale_ni_toca_al_de_al_lado(pagina, ancho):
    pagina.set_viewport_size({"width": ancho, "height": 844})
    preparar(pagina, {}, consulta="?prueba")
    pagina.evaluate("document.fonts.ready")
    medida = pagina.evaluate(CHIPS)
    assert [t for t, _ in medida["sale"]] == ["General", "Personalizada", "Prueba 2×30 s"]
    assert all(s <= 0.5 for _, s in medida["sale"]), medida["sale"]
    assert not medida["cruzan"]
    assert pagina.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


@pytest.mark.parametrize("ancho, alto", [(390, 844), (360, 800)])
def test_en_el_movil_tu_sesion_y_empezar_van_separados_y_la_barra_no_tapa_empezar(pagina, ancho, alto):
    pagina.set_viewport_size({"width": ancho, "height": alto})
    preparar(pagina, {})
    pagina.wait_for_selector("#resumen-elecciones li")
    pagina.evaluate("document.fonts.ready")
    # La entrada de la vista (translateY) acabada: medir a medias movería una caja y no la otra.
    pagina.evaluate("Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))")
    medida = pagina.evaluate("""() => {
      const [t, e, b] = ['.tu-sesion', '#empezar', '#pestanas'].map((s) => document.querySelector(s).getBoundingClientRect());
      return { hueco: e.top - t.bottom, sobra: b.top - e.bottom };
    }""")
    assert medida["hueco"] >= 16, medida
    assert medida["sobra"] > 0, medida


def test_el_texto_de_prueba_dice_que_es_y_que_se_guarda(pagina):
    preparar(pagina, {}, consulta="?prueba")
    pagina.click('#tipo-sesion label:has(input[value="prueba"])')
    assert pagina.inner_text("#nota-sesion") == (
        'Sesión corta de prueba: 2 asaltos de 30 s con lo de tu Personalizada. Se guarda en el Historial como "Prueba".')


def test_la_barra_trae_entrenar_aprende_e_historial_y_entrenar_ya_no_tiene_foto(pagina, sitio):
    assert not (sitio / "imagenes" / "entrenar-cabecera.webp").exists()  # ni se publica su foto
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
    esperar_menu_quieto(pagina)
    pagina.click('#menu-ajustes label:has(input[name="guardia"][value="zurdo"])')
    cerrar_menu(pagina)
    assert tipo_marcado(pagina) == "general"
    assert "Zurdo" in elecciones(pagina)
    entrenar_un_poco(pagina)
    s = guardado(pagina)["sesiones"][0]
    # La General zurda: 3:00 con 1:00 de descanso, nivel de data/perfil.json, sin Reacción (D1).
    assert (s["tipo"], s["zurdo"], s["duracion_asalto"], s["descanso"], s["nivel"], s["modo_reaccion"], s["ritmo"]) == (
        "general", True, 180, 60, 1, False, 3)


@pytest.mark.parametrize("ancho, alto", [(1024, 768), (1440, 900)])
def test_desde_1024_una_columna_centrada_en_el_orden_del_movil(pagina, ancho, alto):
    pagina.set_viewport_size({"width": ancho, "height": alto})
    preparar(pagina, {"perfil": {"estilo": {"mi_estilo": "contragolpeador"}}})
    pagina.evaluate("document.fonts.ready")
    caja = lambda s: pagina.locator(s).bounding_box()  # noqa: E731
    bloques = [caja(s) for s in (".cabecera-perfil", "#tipo-sesion", ".tu-sesion", "#empezar")]
    # Uno debajo de otro, en el orden del móvil, del mismo ancho (como mucho 640) y alineados.
    assert all(a["y"] + a["height"] <= b["y"] for a, b in zip(bloques, bloques[1:])), bloques
    assert all(abs(b["x"] - bloques[0]["x"]) <= 1 and abs(b["width"] - bloques[0]["width"]) <= 1 for b in bloques)
    # Centrada en el sitio que deja la barra lateral, y de 640 px (o todo el sitio, si hay menos).
    main = pagina.evaluate("""() => { const m = document.querySelector('main'), r = m.getBoundingClientRect(),
      s = getComputedStyle(m); return [r.left + parseFloat(s.paddingLeft), r.right - parseFloat(s.paddingRight)]; }""")
    assert abs(bloques[0]["width"] - min(640, main[1] - main[0])) <= 1, (bloques[0]["width"], main)
    izquierda, derecha = bloques[0]["x"] - main[0], main[1] - (bloques[0]["x"] + bloques[0]["width"])
    assert abs(izquierda - derecha) <= 2, (izquierda, derecha)
    # Nada cortado: ni el estilo de la cabecera («Boxe…») ni el selector, que no se sale de su caja.
    assert pagina.eval_on_selector("#cabecera-estilo", "(e) => e.scrollWidth <= e.clientWidth")
    assert pagina.inner_text("#cabecera-estilo") == "Contragolpeador · Diestro"
    selector = caja("#tipo-sesion")
    for chip in pagina.locator("#tipo-sesion span").all():
        c = chip.bounding_box()
        assert selector["x"] <= c["x"] and c["x"] + c["width"] <= selector["x"] + selector["width"] + 0.5
    # El asa, fuera de la columna.
    asa = caja("#asa .asa-puntos")
    assert asa["x"] >= bloques[0]["x"] + bloques[0]["width"] + 16


# ---------- El asa no tapa nada (geometría) ----------

# La caja visible del asa y las de lo que no debe tapar en Entrenar.
CAJAS_MOVIL = """() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
  return { asa: r('#asa .asa-puntos'), boton: r('#asa'), ancho: document.documentElement.clientWidth,
    otras: ['.cabecera-perfil', '#tipo-sesion', '.tu-sesion', '#empezar', '#info-voz', '#pestanas'].map((s) => [s, r(s)]) };
}"""


@pytest.mark.parametrize("ancho, alto", [(390, 844), (360, 800), (390, 667)])
def test_en_el_movil_el_asa_va_en_el_hueco_bajo_empezar_sin_tapar_nada(pagina, ancho, alto):
    pagina.set_viewport_size({"width": ancho, "height": alto})
    preparar(pagina, {"perfil": {"sesion": {"tipo": "personalizada", "zurdo": True, "reaccion": True, **PERSONALIZADA},
                                 "practicar": [{"movimiento": "3"}]}})
    pagina.evaluate("document.fonts.ready")
    for abajo in (False, True):  # arriba del todo y al final de la página
        if abajo:
            pagina.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        c = pagina.evaluate(CAJAS_MOVIL)
        for nombre, caja in c["otras"]:
            assert not cruzan(c["asa"], caja), (nombre, abajo, c["asa"], caja)
        assert c["boton"]["right"] <= c["ancho"] - 16  # sin pegarse al borde (el gesto «Atrás»)
    # Sigue siendo un botón: con el teclado abre el menú.
    pagina.focus("#asa")
    pagina.keyboard.press("Enter")
    pagina.wait_for_function("document.getElementById('menu').open")



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
    esperar_menu_quieto(pagina)
    assert pagina.locator("#asa").evaluate("(e) => getComputedStyle(e).visibility") == "hidden"
    for seccion in ("personalizar", "combinaciones", "ajustes"):
        pagina.evaluate(f"document.querySelector(\"[data-seccion='{seccion}']\").open = true")
        for y in (0, 400, 800, 100000):  # el panel, desplazado de arriba abajo
            pagina.evaluate(f"document.querySelector('.menu-contenido').scrollTop = {y}")
            c = pagina.evaluate(CAJAS, {"abierto": True})
            assert not cruzan(c["asa"], c["empezar"]), (seccion, y)
            for nombre, caja in c["controles"]:
                assert not cruzan(c["asa"], caja), (seccion, y, nombre)


def test_la_cabecera_de_perfil_lleva_el_radio_de_las_tarjetas(pagina):
    preparar(pagina, {})
    radio = lambda s: pagina.eval_on_selector(s, "(e) => getComputedStyle(e).borderTopLeftRadius")  # noqa: E731
    assert radio(".cabecera-perfil") == radio(".tu-sesion") == "22px"
