"""«Tus combinaciones» en Entrenar, en un navegador de verdad (Chromium headless con Playwright).

Estados del selector sin propias, con 2 y con 5; que se recuerda; el nivel con «Solo las mías»; y
una sesión entera de «Prueba» con «Solo las mías» en zurdo, con el reloj de Playwright y una voz
falsa que apunta lo que se dice: solo salen propias, en espejo, dichas como el resto (nunca por un
nombre) y se guardan en el historial como el resto ({asalto, texto, ids}). Los datos de prueba solo
viven en el localStorage de este Chromium. Sin Playwright se salta en local; en CI falla.
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
# Una voz que no suena: apunta cada frase (texto y velocidad) y acaba a los 400 ms.
VOZ_FALSA = """(() => {
  window.dichos = [];
  const falsa = {
    speaking: false, pending: false, onvoiceschanged: null,
    getVoices: () => [], addEventListener() {}, removeEventListener() {}, cancel() {},
    speak(frase) {
      window.dichos.push({ texto: frase.text, velocidad: frase.rate });
      setTimeout(() => frase.onend?.(), 400);
    },
  };
  Object.defineProperty(window, "speechSynthesis", { value: falsa, configurable: true });
})();"""
CINCO = [["jab", "directo"], ["jab", "rodar_der", "directo", "gancho_izq"], ["bloqueo", "directo", "gancho_izq"],
         ["jab", "jab", "directo", "esquiva_izq"],
         ["jab", "directo", "esquiva_izq", "gancho_izq", "directo", "rodar_der", "gancho_der", "paso_atras"]]


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


def ir(pagina, propias=(), sesion=None, ruta="#entrenar/menu/personalizar"):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    datos = {"version": 9, "combinacionesPropias": [
        {"id": f"p-{i}", "ids": ids, "creada": "2026-11-04T10:00:00"} for i, ids in enumerate(propias)]}
    # «Tus combinaciones» es de la Personalizada: con la General no se mezcla nada (D1).
    datos["perfil"] = {"sesion": {"tipo": "personalizada", **(sesion or {})}}
    pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(datos))
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    pagina.wait_for_selector("#mezclas label", state="attached")


def desactivada(pagina, valor):
    return pagina.eval_on_selector(f'input[name="mezcla"][value="{valor}"]', "(i) => i.matches(':disabled')")


def elecciones(pagina):
    """Las pastillas de «Tu sesión», unidas con « · »."""
    return " · ".join(pagina.locator("#resumen-elecciones li").all_inner_texts())


def guardado(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))


def test_sin_propias_el_selector_esta_desactivado_y_lleva_al_creador(pagina):
    ir(pagina)
    assert pagina.eval_on_selector("#mezclas", "(f) => f.disabled")
    assert all(desactivada(pagina, v) for v in ("ninguna", "poco", "bastante", "mucho", "solo"))
    assert pagina.is_checked('input[name="mezcla"][value="ninguna"]')
    nota = pagina.locator("#nota-mezcla")
    assert nota.is_visible() and "Aún no tienes combinaciones propias" in nota.inner_text()
    assert pagina.get_attribute("#mezclas", "aria-describedby") == "nota-mezcla"
    # El enlace funciona aunque el grupo esté desactivado, y con el teclado.
    enlace = nota.locator("a")
    enlace.focus()
    pagina.keyboard.press("Enter")
    pagina.wait_for_selector("#t-creador")
    assert pagina.evaluate("location.hash") == "#entrenar/mis-combinaciones/nueva"


def test_con_dos_solo_las_mias_esta_desactivada_con_su_motivo_y_lo_demas_se_recuerda(pagina):
    ir(pagina, CINCO[:2], {"nivel": 1})
    assert not pagina.eval_on_selector("#mezclas", "(f) => f.disabled")
    assert desactivada(pagina, "solo")
    assert not any(desactivada(pagina, v) for v in ("ninguna", "poco", "bastante", "mucho"))
    assert pagina.inner_text("#nota-mezcla") == "«Solo las mías» necesita al menos 3 combinaciones (tienes 2)."
    # Con el teclado: las flechas recorren el grupo y se saltan la desactivada.
    pagina.focus('input[name="mezcla"][value="ninguna"]')
    for _ in range(3):
        pagina.keyboard.press("ArrowRight")
    assert pagina.is_checked('input[name="mezcla"][value="mucho"]')
    pagina.keyboard.press("ArrowRight")
    assert pagina.is_checked('input[name="mezcla"][value="ninguna"]'), "de Mucho vuelve a Ninguna, sin pasar por Solo"
    pagina.click('input[name="mezcla"][value="mucho"]', force=True)
    assert guardado(pagina)["perfil"]["sesion"]["mezcla"] == "mucho"
    assert "Mucho de las tuyas" in elecciones(pagina)
    pagina.reload()
    pagina.wait_for_selector("#mezclas label", state="visible")
    assert pagina.is_checked('input[name="mezcla"][value="mucho"]')


def test_solo_las_mias_guardada_con_menos_de_tres_se_respeta_y_se_explica(pagina):
    ir(pagina, CINCO[:2], {"mezcla": "solo", "nivel": 2})
    assert pagina.is_checked('input[name="mezcla"][value="solo"]') and desactivada(pagina, "solo")
    assert pagina.inner_text("#nota-mezcla").endswith("de momento salen las de la biblioteca.")
    assert not pagina.eval_on_selector("#niveles", "(f) => f.disabled"), "sortea como «Ninguna»: el nivel cuenta"
    assert elecciones(pagina).startswith("Nivel medio · Constante")


def test_con_cinco_solo_las_mias_desactiva_el_nivel_y_el_aviso_del_nivel_sin_propias(pagina):
    ir(pagina, CINCO, {"nivel": 2})
    assert not desactivada(pagina, "solo")
    assert pagina.locator("#nota-mezcla").is_hidden()
    pagina.click('input[name="mezcla"][value="solo"]', force=True)
    assert pagina.eval_on_selector("#niveles", "(f) => f.disabled")
    assert pagina.inner_text("#nota-nivel") == "Con «Solo las mías» no cuenta el nivel: salen todas las tuyas."
    assert pagina.get_attribute("#niveles", "aria-describedby") == "nota-nivel"
    assert elecciones(pagina).startswith("Solo las tuyas · ")
    assert pagina.is_checked('input[name="nivel"][value="2"]'), "el nivel guardado no se pierde"
    # «Mucho» en medio: ninguna propia es de medio.
    pagina.click('input[name="mezcla"][value="mucho"]', force=True)
    assert not pagina.eval_on_selector("#niveles", "(f) => f.disabled")
    assert pagina.locator("#nota-nivel").is_hidden()
    assert pagina.inner_text("#nota-mezcla") == "No tienes combinaciones de nivel medio: solo saldrán las de la biblioteca."
    pagina.click('input[name="nivel"][value="1"]', force=True)
    assert pagina.locator("#nota-mezcla").is_hidden()
    assert elecciones(pagina).startswith("Nivel básico · Mucho de las tuyas")


def test_solo_las_mias_sin_ninguna_corta_avisa_del_final_del_asalto(pagina):
    ir(pagina, CINCO[1:2] + CINCO[3:], {"mezcla": "solo"})
    assert pagina.inner_text("#nota-mezcla") == "Añade alguna de 2-3 acciones para que el final del asalto sea solo tuyo."


def test_crear_una_en_el_creador_activa_el_selector_al_volver(pagina):
    ir(pagina)
    pagina.goto(f"{ORIGEN}/index.html#entrenar/mis-combinaciones/nueva")
    pagina.wait_for_selector("#caja-combo")
    for id_ in ("jab", "directo"):
        pagina.click(f'[data-anadir="{id_}"]')
    pagina.click("#guardar")
    pagina.click('dialog[open] button[value="guardar"]')  # es igual que una de la biblioteca: «Guardar igual»
    pagina.wait_for_selector("#anadir-propia")
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/personalizar")
    pagina.wait_for_selector("#mezclas label", state="visible")
    assert not pagina.eval_on_selector("#mezclas", "(f) => f.disabled")
    assert desactivada(pagina, "solo")
    assert "tienes 1" in pagina.inner_text("#nota-mezcla")


def test_a_390_el_selector_cabe_y_cada_opcion_se_toca_con_48_px(pagina):
    ir(pagina, CINCO)
    pagina.wait_for_function("getComputedStyle(document.querySelector('.menu-panel')).transform === 'none'")
    medidas = pagina.eval_on_selector_all("#mezclas label span", """(spans) => spans.map((s) => {
      const r = s.getBoundingClientRect();
      return [s.textContent, r.width, r.height, s.scrollWidth - s.clientWidth, r.right];
    })""")
    assert len(medidas) == 5
    for texto, ancho, alto, desborde, derecha in medidas:
        assert ancho >= 48 and alto >= 48, texto
        assert desborde <= 0 and derecha <= 390 - 16, texto
    assert pagina.evaluate("document.documentElement.scrollWidth") <= 390


# Lo que hace la app con las propias de una sesión: el espejo y el texto hablado de cada una (zurdo).
ESPERADO = """async ({ propias, voz }) => {
  const { accionesPorIds, espejo, textoHablado } = await import("./motor/acciones.js");
  return propias.map((ids) => {
    const acciones = accionesPorIds(ids).map(espejo);
    return { ids: acciones.map((a) => a.id), texto: textoHablado(acciones, voz, true) };
  });
}"""


def test_sesion_con_solo_las_mias_en_zurdo_dice_solo_propias_y_las_guarda_como_el_resto(pagina):
    tres = CINCO[:3]
    pagina.clock.install()
    # Una Personalizada de 2 × 30 s (lo que era Prueba), para que la sesión sea corta.
    ir(pagina, tres, {"mezcla": "solo", "tipo": "personalizada", "zurdo": True, "voz": "ambos", "nivel": 3,
                      "personalizada": {"asaltos": 2, "duracion_asalto": 30, "descanso": 10}}, ruta="#entrenar")
    esperado = pagina.evaluate(ESPERADO, {"propias": tres, "voz": "ambos"})
    textos = {e["texto"] for e in esperado}
    pagina.click("#empezar")
    pagina.wait_for_selector("#pantalla:not([hidden])")
    for _ in range(40):  # 2 × 30 s con descanso, a saltos de 5 s
        pagina.clock.run_for(5000)
        if pagina.locator("#pantalla").is_hidden():
            break
    assert pagina.locator("#pantalla").is_hidden(), "la sesión no ha terminado"
    sesiones = guardado(pagina)["sesiones"]
    assert len(sesiones) == 1
    combinaciones = sesiones[0]["combinaciones"]
    assert combinaciones and all(set(c) == {"asalto", "texto", "ids"} for c in combinaciones)
    por_ids = {tuple(e["ids"]): e["texto"] for e in esperado}
    # Todas propias, también el relleno (hay 2 de 2-3 acciones), en espejo y dichas como el resto:
    # nunca por un nombre. El nivel 3 no cuenta.
    for c in combinaciones:
        assert tuple(c["ids"]) in por_ids, c
        assert c["texto"] == por_ids[tuple(c["ids"])], c
    assert {c["asalto"] for c in combinaciones} == {1, 2}
    # La voz dijo exactamente esos textos (además de las señales del asalto).
    dichos = [d["texto"] for d in pagina.evaluate("window.dichos")]
    guardados = {c["texto"] for c in combinaciones}
    assert [t for t in dichos if t in guardados | textos] == [c["texto"] for c in combinaciones]
    velocidades = {round(d["velocidad"], 3) for d in pagina.evaluate("window.dichos") if d["texto"] in guardados}
    assert velocidades == {1.1}  # la normal de Ajustes (rate es un float de 32 bits)
    # La valoración las rehace desde los ids (como el Historial: combinacionesParaVer) y se pueden marcar.
    pagina.wait_for_selector("#postsesion[open]")
    vistas = pagina.evaluate("""async (sesion) => {
      const { combinacionesParaVer } = await import("./vistas/pasos.js");
      return combinacionesParaVer(sesion, sesion.combinaciones).map((c) => c.texto);
    }""", sesiones[0])
    assert pagina.locator("#postsesion .check span").all_text_contents() == vistas
    assert len(vistas) == len(combinaciones)


# ---------- «Escuchar» en el editor ----------

def abrir_editor(pagina, sesion=None, voz=None):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    perfil = {}
    if sesion:
        perfil["sesion"] = sesion
    if voz:
        perfil["voz"] = voz
    pagina.evaluate("(d) => localStorage.setItem('boxeo', d)",
                    json.dumps({"version": 9, "combinacionesPropias": [], "perfil": perfil}))
    pagina.goto(f"{ORIGEN}/index.html#entrenar/mis-combinaciones/nueva")
    pagina.wait_for_selector("#caja-combo #escuchar")


@pytest.mark.parametrize("modo, velocidad, esperado", [
    ("numeros", "lenta", "uno, rueda derecha, tres"),
    ("nombres", "normal", "jab, rueda derecha, crochet de izquierda"),
    ("ambos", "rapida", "uno jab, rueda derecha, tres crochet de izquierda"),
])
def test_escuchar_dicta_la_combinacion_en_el_modo_de_voz_y_a_la_velocidad_de_ajustes(pagina, modo, velocidad, esperado):
    abrir_editor(pagina, {"voz": modo}, {"id": None, "velocidad": velocidad})
    for id_ in ("jab", "gancho_izq"):
        pagina.click(f'[data-anadir="{id_}"]')
    pagina.click('[data-grupo="defensa"]')
    pagina.click('[data-anadir="rodar_der"]')
    # En el orden en que se añadieron: jab, crochet de izquierda, rueda derecha.
    pagina.click('[data-quitar="1"]')
    pagina.click('[data-grupo="golpe"]')
    pagina.click('[data-anadir="gancho_izq"]')
    pagina.evaluate("window.dichos = []")
    pagina.focus("#escuchar")
    pagina.keyboard.press("Enter")
    pagina.wait_for_function("window.dichos.length === 1")
    dicho = pagina.evaluate("window.dichos[0]")
    assert dicho["texto"] == esperado
    assert round(dicho["velocidad"], 3) == {"lenta": 0.9, "normal": 1.1, "rapida": 1.3}[velocidad]
    assert pagina.evaluate("document.activeElement.id") == "escuchar"
    # Otra vez con Espacio: se vuelve a decir (la voz corta lo que estuviera diciendo).
    pagina.keyboard.press(" ")
    pagina.wait_for_function("window.dichos.length === 2")


def test_escuchar_esta_desactivado_sin_acciones_y_dice_por_que(pagina):
    abrir_editor(pagina)
    boton = pagina.locator("#escuchar")
    assert boton.get_attribute("aria-disabled") == "true"
    assert boton.get_attribute("aria-describedby") == "motivo-escuchar"
    assert pagina.inner_text("#motivo-escuchar") == "Añade alguna acción para escucharla."
    pagina.evaluate("window.dichos = []")
    boton.click(force=True)
    boton.focus()
    pagina.keyboard.press("Enter")
    pagina.wait_for_timeout(100)
    assert pagina.evaluate("window.dichos") == []
    # Con una acción ya se puede; al quitarla, vuelve a estar desactivado.
    pagina.click('[data-anadir="jab"]')
    assert pagina.locator("#escuchar").get_attribute("aria-disabled") is None
    assert pagina.locator("#motivo-escuchar").count() == 0
    pagina.click("#escuchar")
    pagina.wait_for_function("window.dichos.length === 1")
    assert pagina.evaluate("window.dichos[0].texto") == "jab"
    pagina.click("#quitar-ultima")
    assert pagina.locator("#escuchar").get_attribute("aria-disabled") == "true"


def test_escuchar_cabe_y_se_toca_con_48_px_en_cada_ancho(pagina):
    for ancho in (390, 1024, 1440):
        pagina.set_viewport_size({"width": ancho, "height": 900})
        abrir_editor(pagina)
        for id_ in ("jab", "directo", "gancho_izq", "gancho_der", "uppercut_izq", "uppercut_der",
                    "jab", "directo", "gancho_izq", "directo"):
            pagina.click(f'[data-anadir="{id_}"]')
        caja = pagina.locator("#caja-combo").bounding_box()
        boton = pagina.locator("#escuchar").bounding_box()
        assert boton["height"] >= 48 and boton["width"] >= 48, ancho
        assert boton["x"] >= caja["x"] and boton["x"] + boton["width"] <= caja["x"] + caja["width"], ancho
        assert pagina.evaluate("document.documentElement.scrollWidth") <= ancho, ancho
