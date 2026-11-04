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


def ir(pagina, propias=(), sesion=None, ruta="#entrenar"):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    datos = {"version": 8, "combinacionesPropias": [
        {"id": f"p-{i}", "ids": ids, "creada": "2026-11-04T10:00:00"} for i, ids in enumerate(propias)]}
    if sesion:
        datos["perfil"] = {"sesion": sesion}
    pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(datos))
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    pagina.wait_for_selector("#mezclas label")


def desactivada(pagina, valor):
    return pagina.eval_on_selector(f'input[name="mezcla"][value="{valor}"]', "(i) => i.matches(':disabled')")


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
    assert pagina.evaluate("location.hash") == "#ajustes/mis-combinaciones/nueva"


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
    assert "Mucho de las tuyas" in pagina.text_content("#resumen-elecciones")
    pagina.reload()
    pagina.wait_for_selector("#mezclas label")
    assert pagina.is_checked('input[name="mezcla"][value="mucho"]')


def test_solo_las_mias_guardada_con_menos_de_tres_se_respeta_y_se_explica(pagina):
    ir(pagina, CINCO[:2], {"mezcla": "solo", "nivel": 2})
    assert pagina.is_checked('input[name="mezcla"][value="solo"]') and desactivada(pagina, "solo")
    assert pagina.inner_text("#nota-mezcla").endswith("de momento salen las de la biblioteca.")
    assert not pagina.eval_on_selector("#niveles", "(f) => f.disabled"), "sortea como «Ninguna»: el nivel cuenta"
    assert pagina.text_content("#resumen-elecciones").startswith("Medio · Constante")


def test_con_cinco_solo_las_mias_desactiva_el_nivel_y_el_aviso_del_nivel_sin_propias(pagina):
    ir(pagina, CINCO, {"nivel": 2})
    assert not desactivada(pagina, "solo")
    assert pagina.locator("#nota-mezcla").is_hidden()
    pagina.click('input[name="mezcla"][value="solo"]', force=True)
    assert pagina.eval_on_selector("#niveles", "(f) => f.disabled")
    assert pagina.inner_text("#nota-nivel") == "Con «Solo las mías» no cuenta el nivel: salen todas las tuyas."
    assert pagina.get_attribute("#niveles", "aria-describedby") == "nota-nivel"
    assert pagina.text_content("#resumen-elecciones").startswith("Solo las tuyas · ")
    assert pagina.is_checked('input[name="nivel"][value="2"]'), "el nivel guardado no se pierde"
    # «Mucho» en medio: ninguna propia es de medio.
    pagina.click('input[name="mezcla"][value="mucho"]', force=True)
    assert not pagina.eval_on_selector("#niveles", "(f) => f.disabled")
    assert pagina.locator("#nota-nivel").is_hidden()
    assert pagina.inner_text("#nota-mezcla") == "No tienes combinaciones de nivel medio: solo saldrán las de la biblioteca."
    pagina.click('input[name="nivel"][value="1"]', force=True)
    assert pagina.locator("#nota-mezcla").is_hidden()
    assert pagina.text_content("#resumen-elecciones").startswith("Básico · Mucho de las tuyas")


def test_solo_las_mias_sin_ninguna_corta_avisa_del_final_del_asalto(pagina):
    ir(pagina, CINCO[1:2] + CINCO[3:], {"mezcla": "solo"})
    assert pagina.inner_text("#nota-mezcla") == "Añade alguna de 2-3 acciones para que el final del asalto sea solo tuyo."


def test_crear_una_en_ajustes_activa_el_selector_al_volver(pagina):
    ir(pagina)
    pagina.goto(f"{ORIGEN}/index.html#ajustes/mis-combinaciones/nueva")
    pagina.wait_for_selector("#caja-combo")
    for id_ in ("jab", "directo"):
        pagina.click(f'[data-anadir="{id_}"]')
    pagina.click("#guardar")
    pagina.click('dialog[open] button[value="guardar"]')  # es igual que una de la biblioteca: «Guardar igual»
    pagina.wait_for_selector("#anadir-propia")
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#vista-entrenar:not([hidden])")
    assert not pagina.eval_on_selector("#mezclas", "(f) => f.disabled")
    assert desactivada(pagina, "solo")
    assert "tienes 1" in pagina.inner_text("#nota-mezcla")


def test_a_390_el_selector_cabe_y_cada_opcion_se_toca_con_48_px(pagina):
    ir(pagina, CINCO)
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
    ir(pagina, tres, {"mezcla": "solo", "asalto": "prueba", "zurdo": True, "voz": "ambos", "nivel": 3})
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
    cortas = pagina.evaluate("""async () => {
      const { biblioteca, espejo } = await import("./motor/acciones.js");
      return biblioteca().filter((c) => c.acciones.length <= 3).map((c) => c.acciones.map((a) => espejo(a).id));
    }""")
    de_relleno = {tuple(ids) for ids in cortas}
    for c in combinaciones:
        if tuple(c["ids"]) in por_ids:  # en espejo y dichas como el resto: nunca por un nombre
            assert c["texto"] == por_ids[tuple(c["ids"])], c
        else:  # de la biblioteca, solo coletillas cortas de relleno (C1); el nivel 3 no cuenta
            assert tuple(c["ids"]) in de_relleno, c
    assert {c["asalto"] for c in combinaciones} == {1, 2}
    assert sum(tuple(c["ids"]) in por_ids for c in combinaciones) > len(combinaciones) / 2
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
