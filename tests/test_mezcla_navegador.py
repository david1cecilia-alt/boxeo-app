"""«Mis combinaciones» en Entrenar (el interruptor) y en Ajustes («Cuánto aparecen»), en un navegador
de verdad (Chromium headless con Playwright).

El interruptor sin propias (desactivado, sin borrar lo guardado), que se recuerda, que usa lo de
Ajustes, el nivel con «Solo las mías»; y sesiones enteras de «Prueba» con el reloj de Playwright y una
voz falsa que apunta lo que se dice: apagado, solo biblioteca; con «Solo las mías» en zurdo, solo
propias, en espejo, dichas como el resto (nunca por un nombre) y guardadas en el historial como el
resto ({asalto, texto, ids}). Los datos de prueba solo
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


def ir(pagina, propias=(), sesion=None, cuanto=None, ruta="#entrenar", version=9):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    datos = {"version": version, "combinacionesPropias": [
        {"id": f"p-{i}", "ids": ids, "creada": "2026-11-04T10:00:00"} for i, ids in enumerate(propias)], "perfil": {}}
    if sesion:
        datos["perfil"]["sesion"] = sesion
    if cuanto:
        datos["perfil"]["misCombinaciones"] = {"cuanto": cuanto}
    pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(datos))
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    pagina.wait_for_selector("#t-creador" if ruta.startswith("#ajustes") else "#vista-entrenar:not([hidden]) #mis-combinaciones")


def interruptor(pagina):
    return pagina.eval_on_selector("#mis-combinaciones", "(i) => ({ encendido: i.checked, desactivado: i.disabled })")


def guardado(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))


def test_sin_propias_el_interruptor_esta_desactivado_y_lleva_a_mis_combinaciones(pagina):
    ir(pagina)
    assert interruptor(pagina) == {"encendido": False, "desactivado": True}
    assert pagina.locator("#mezclas").count() == 0, "en Entrenar ya no está el selector"
    nota = pagina.locator("#nota-mezcla")
    assert nota.is_visible() and nota.inner_text() == "Crea tus combinaciones en Ajustes"
    assert pagina.get_attribute("#mis-combinaciones", "aria-describedby") == "nota-mezcla"
    assert "%" not in pagina.inner_text("#config")
    # El enlace funciona aunque el interruptor esté desactivado, y con el teclado.
    enlace = nota.locator("a")
    assert enlace.get_attribute("href") == "#ajustes/mis-combinaciones"
    enlace.focus()
    pagina.keyboard.press("Enter")
    pagina.wait_for_selector("#t-creador")
    assert pagina.evaluate("location.hash") == "#ajustes/mis-combinaciones"


def test_el_interruptor_se_guarda_y_se_recuerda_como_el_resto(pagina):
    ir(pagina, CINCO, {"nivel": 1})
    assert interruptor(pagina) == {"encendido": False, "desactivado": False}
    assert pagina.locator("#nota-mezcla").is_hidden()
    assert "de las tuyas" not in pagina.text_content("#resumen-elecciones")
    pagina.click("label:has(#mis-combinaciones)")  # toda la fila se toca
    assert guardado(pagina)["perfil"]["sesion"]["usarMisCombinaciones"] is True
    assert guardado(pagina)["perfil"]["misCombinaciones"] == {"cuanto": "bastante"}, "por defecto, «Bastante»"
    assert pagina.text_content("#resumen-elecciones").startswith("Básico · Bastante de las tuyas")
    pagina.reload()
    pagina.wait_for_selector("#mis-combinaciones")
    assert interruptor(pagina) == {"encendido": True, "desactivado": False}
    # Con el teclado (Espacio) se apaga y se guarda.
    pagina.focus("#mis-combinaciones")
    pagina.keyboard.press(" ")
    assert guardado(pagina)["perfil"]["sesion"]["usarMisCombinaciones"] is False
    assert "de las tuyas" not in pagina.text_content("#resumen-elecciones")
    pagina.reload()
    pagina.wait_for_selector("#mis-combinaciones")
    assert interruptor(pagina)["encendido"] is False


def test_encendido_usa_lo_elegido_en_ajustes(pagina):
    ir(pagina, CINCO, {"nivel": 1, "usarMisCombinaciones": True}, cuanto="mucho")
    assert pagina.text_content("#resumen-elecciones").startswith("Básico · Mucho de las tuyas")
    # Se cambia en Ajustes y Entrenar lo usa al volver; el interruptor sigue como estaba.
    pagina.goto(f"{ORIGEN}/index.html#ajustes/mis-combinaciones")
    pagina.wait_for_selector("#cuantos")
    pagina.click('label:has(input[name="cuanto"][value="poco"])')
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#vista-entrenar:not([hidden])")
    assert interruptor(pagina)["encendido"] is True
    assert pagina.text_content("#resumen-elecciones").startswith("Básico · Poco de las tuyas")


def test_una_v8_publicada_con_mezcla_se_abre_con_el_interruptor_encendido_y_esa_cantidad(pagina):
    ir(pagina, CINCO, {"nivel": 1, "mezcla": "mucho"}, version=8)
    assert interruptor(pagina) == {"encendido": True, "desactivado": False}
    datos = guardado(pagina)
    assert datos["version"] == 9 and datos["perfil"]["misCombinaciones"] == {"cuanto": "mucho"}
    assert "mezcla" not in datos["perfil"]["sesion"]
    assert len(datos["combinacionesPropias"]) == 5


def test_encendido_sin_propias_se_ve_desactivado_pero_no_se_borra_y_vuelve_al_crear_una(pagina):
    ir(pagina, (), {"usarMisCombinaciones": True}, cuanto="mucho")
    assert interruptor(pagina) == {"encendido": False, "desactivado": True}
    assert pagina.inner_text("#nota-mezcla") == "Crea tus combinaciones en Ajustes"
    assert "de las tuyas" not in pagina.text_content("#resumen-elecciones"), "la sesión usa solo la biblioteca"
    # Tocarlo o cambiar otra cosa no borra lo guardado.
    pagina.click("label:has(#mis-combinaciones)", force=True)
    pagina.click("#zurdo", force=True)
    assert guardado(pagina)["perfil"]["sesion"]["usarMisCombinaciones"] is True
    pagina.goto(f"{ORIGEN}/index.html#ajustes/mis-combinaciones/nueva")
    pagina.wait_for_selector("#caja-combo")
    for id_ in ("jab", "directo"):
        pagina.click(f'[data-anadir="{id_}"]')
    pagina.click("#guardar")
    pagina.click('dialog[open] button[value="guardar"]')  # es igual que una de la biblioteca: «Guardar igual»
    pagina.wait_for_selector("#anadir-propia")
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#vista-entrenar:not([hidden])")
    assert interruptor(pagina) == {"encendido": True, "desactivado": False}
    assert pagina.locator("#nota-mezcla").is_hidden()
    assert guardado(pagina)["perfil"]["sesion"]["usarMisCombinaciones"] is True


def test_solo_las_mias_con_menos_de_tres_se_respeta_y_se_explica(pagina):
    ir(pagina, CINCO[:2], {"usarMisCombinaciones": True, "nivel": 2}, cuanto="solo")
    assert interruptor(pagina) == {"encendido": True, "desactivado": False}
    assert pagina.inner_text("#nota-mezcla") == ("«Solo las mías» necesita al menos 3 combinaciones (tienes 2): "
                                                  "de momento salen las de la biblioteca.")
    assert not pagina.eval_on_selector("#niveles", "(f) => f.disabled"), "sortea como «Ninguna»: el nivel cuenta"
    assert pagina.text_content("#resumen-elecciones").startswith("Medio · Constante")
    # Apagado, nada que explicar.
    pagina.click("label:has(#mis-combinaciones)")
    assert pagina.locator("#nota-mezcla").is_hidden()


def test_con_cinco_solo_las_mias_desactiva_el_nivel_con_su_nota(pagina):
    ir(pagina, CINCO, {"usarMisCombinaciones": True, "nivel": 2}, cuanto="solo")
    assert pagina.eval_on_selector("#niveles", "(f) => f.disabled")
    assert pagina.inner_text("#nota-nivel") == "Con «Solo las mías» no se usa el nivel."
    assert pagina.get_attribute("#niveles", "aria-describedby") == "nota-nivel"
    assert pagina.text_content("#resumen-elecciones").startswith("Solo las tuyas · ")
    assert pagina.is_checked('input[name="nivel"][value="2"]'), "el nivel guardado no se pierde"
    # Apagado, el nivel vuelve a contar.
    pagina.click("label:has(#mis-combinaciones)")
    assert not pagina.eval_on_selector("#niveles", "(f) => f.disabled")
    assert pagina.locator("#nota-nivel").is_hidden()
    assert pagina.text_content("#resumen-elecciones").startswith("Medio · Constante")


def test_mucho_sin_propias_del_nivel_avisa(pagina):
    ir(pagina, CINCO, {"usarMisCombinaciones": True, "nivel": 2}, cuanto="mucho")
    assert pagina.inner_text("#nota-mezcla") == "No tienes combinaciones de nivel medio: solo saldrán las de la biblioteca."
    pagina.click('input[name="nivel"][value="1"]', force=True)
    assert pagina.locator("#nota-mezcla").is_hidden()
    assert pagina.text_content("#resumen-elecciones").startswith("Básico · Mucho de las tuyas")


def test_solo_las_mias_sin_ninguna_corta_avisa_del_final_del_asalto(pagina):
    ir(pagina, CINCO[1:2] + CINCO[3:], {"usarMisCombinaciones": True}, cuanto="solo")
    assert pagina.inner_text("#nota-mezcla") == "Añade alguna de 2-3 acciones para que el final del asalto sea solo tuyo."


def test_el_interruptor_cabe_y_se_toca_con_48_px_en_cada_ancho(pagina):
    for ancho in (390, 1024, 1440):
        pagina.set_viewport_size({"width": ancho, "height": 900})
        ir(pagina, CINCO)
        caja = pagina.locator("label:has(#mis-combinaciones)").bounding_box()
        tarjeta = pagina.locator(".config-tarjeta").bounding_box()
        assert caja["height"] >= 48 and caja["width"] >= 48, ancho
        assert caja["x"] >= tarjeta["x"] and caja["x"] + caja["width"] <= tarjeta["x"] + tarjeta["width"], ancho
        assert pagina.evaluate("document.documentElement.scrollWidth") <= ancho, ancho


# Lo que hace la app con las propias de una sesión: el espejo y el texto hablado de cada una (zurdo).
ESPERADO = """async ({ propias, voz }) => {
  const { accionesPorIds, espejo, textoHablado } = await import("./motor/acciones.js");
  return propias.map((ids) => {
    const acciones = accionesPorIds(ids).map(espejo);
    return { ids: acciones.map((a) => a.id), texto: textoHablado(acciones, voz, true) };
  });
}"""


def sesion_entera(pagina):
    pagina.click("#empezar")
    pagina.wait_for_selector("#pantalla:not([hidden])")
    for _ in range(40):  # 2 × 30 s con descanso, a saltos de 5 s
        pagina.clock.run_for(5000)
        if pagina.locator("#pantalla").is_hidden():
            break
    assert pagina.locator("#pantalla").is_hidden(), "la sesión no ha terminado"
    sesiones = guardado(pagina)["sesiones"]
    assert len(sesiones) == 1
    return sesiones[0]


def test_sesion_con_solo_las_mias_en_zurdo_dice_solo_propias_y_las_guarda_como_el_resto(pagina):
    tres = CINCO[:3]
    pagina.clock.install()
    ir(pagina, tres, {"usarMisCombinaciones": True, "asalto": "prueba", "zurdo": True, "voz": "ambos", "nivel": 3},
       cuanto="solo")
    esperado = pagina.evaluate(ESPERADO, {"propias": tres, "voz": "ambos"})
    textos = {e["texto"] for e in esperado}
    sesion = sesion_entera(pagina)
    combinaciones = sesion["combinaciones"]
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
    }""", sesion)
    assert pagina.locator("#postsesion .check span").all_text_contents() == vistas
    assert len(vistas) == len(combinaciones)


# Propias que la biblioteca no tiene (tres uppercuts seguidos…): si salen, son propias.
RARAS = [["uppercut_der", "uppercut_der", "uppercut_der"], ["gancho_der", "gancho_der", "esquiva_izq"],
         ["uppercut_izq", "paso_atras", "uppercut_izq"]]


def test_sesion_con_el_interruptor_apagado_solo_saca_la_biblioteca(pagina):
    pagina.clock.install()
    ir(pagina, RARAS, {"usarMisCombinaciones": False, "asalto": "prueba", "nivel": 1}, cuanto="solo")
    combinaciones = sesion_entera(pagina)["combinaciones"]
    assert combinaciones
    raras = {tuple(r) for r in RARAS}
    assert not [c for c in combinaciones if tuple(c["ids"]) in raras], "con el interruptor apagado no sale ninguna propia"


def test_sesion_con_el_interruptor_encendido_y_solo_las_mias_saca_las_raras(pagina):
    pagina.clock.install()
    ir(pagina, RARAS, {"usarMisCombinaciones": True, "asalto": "prueba", "nivel": 1}, cuanto="solo")
    combinaciones = sesion_entera(pagina)["combinaciones"]
    raras = {tuple(r) for r in RARAS}
    assert combinaciones and all(tuple(c["ids"]) in raras for c in combinaciones)


# ---------- «Cuánto aparecen» en Ajustes → Mis combinaciones ----------

def test_ajustes_cuanto_aparecen_por_defecto_bastante_sin_porcentajes(pagina):
    ir(pagina, CINCO, ruta="#ajustes/mis-combinaciones")
    opciones = pagina.locator("#cuantos label").all_inner_texts()
    assert [o.strip() for o in opciones] == ["Poco", "Bastante", "Mucho", "Solo las mías"]
    assert pagina.text_content("#cuantos legend") == "Cuánto aparecen"
    assert pagina.is_checked('input[name="cuanto"][value="bastante"]')
    assert "%" not in pagina.inner_text("#ajustes-contenido")
    assert pagina.inner_text("#nota-cuantos") == "Se usa en Entrenar con «Mis combinaciones» encendido."
    assert pagina.get_attribute("#cuantos", "aria-describedby") == "nota-cuantos"


def test_ajustes_guarda_la_cantidad_y_la_recuerda_sin_tocar_el_interruptor(pagina):
    ir(pagina, CINCO, {"usarMisCombinaciones": False}, ruta="#ajustes/mis-combinaciones")
    pagina.click('label:has(input[name="cuanto"][value="mucho"])')
    datos = guardado(pagina)
    assert datos["perfil"]["misCombinaciones"] == {"cuanto": "mucho"}
    assert datos["perfil"]["sesion"]["usarMisCombinaciones"] is False
    # Con el teclado: las flechas recorren el grupo y guardan.
    pagina.focus('input[name="cuanto"][value="mucho"]')
    pagina.keyboard.press("ArrowRight")
    assert guardado(pagina)["perfil"]["misCombinaciones"] == {"cuanto": "solo"}
    pagina.reload()
    pagina.wait_for_selector("#cuantos")
    assert pagina.is_checked('input[name="cuanto"][value="solo"]')


def test_ajustes_solo_las_mias_con_menos_de_tres_se_puede_elegir_y_se_explica(pagina):
    ir(pagina, CINCO[:2], ruta="#ajustes/mis-combinaciones")
    assert pagina.inner_text("#nota-cuantos") == (
        "Se usa en Entrenar con «Mis combinaciones» encendido. «Solo las mías» necesita al menos 3 combinaciones (tienes 2).")
    pagina.click('label:has(input[name="cuanto"][value="solo"])')
    assert guardado(pagina)["perfil"]["misCombinaciones"] == {"cuanto": "solo"}
    assert pagina.inner_text("#nota-cuantos") == (
        "Se usa en Entrenar con «Mis combinaciones» encendido. «Solo las mías» necesita al menos 3 "
        "combinaciones (tienes 2): de momento salen las de la biblioteca.")


def test_ajustes_cuanto_aparecen_cabe_y_cada_opcion_se_toca_con_48_px(pagina):
    for ancho in (390, 1024, 1440):
        pagina.set_viewport_size({"width": ancho, "height": 900})
        ir(pagina, CINCO, ruta="#ajustes/mis-combinaciones")
        medidas = pagina.eval_on_selector_all("#cuantos label span", """(spans) => spans.map((s) => {
          const r = s.getBoundingClientRect();
          return [s.textContent, r.width, r.height, s.scrollWidth - s.clientWidth, r.right];
        })""")
        assert len(medidas) == 4
        for texto, ancho_op, alto, desborde, derecha in medidas:
            assert ancho_op >= 48 and alto >= 48, (ancho, texto)
            assert desborde <= 0 and derecha <= ancho - 16, (ancho, texto)
        assert pagina.evaluate("document.documentElement.scrollWidth") <= ancho, ancho


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
    pagina.goto(f"{ORIGEN}/index.html#ajustes/mis-combinaciones/nueva")
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
