"""«Mis combinaciones» (el creador, en Ajustes) en un navegador de verdad (Chromium headless con Playwright).

Tarjeta en Ajustes, listado (vacío, con combinaciones y 20/20), editor (grupos, «Al cuerpo», fichas, máximo
10, Guardar con mínimo 2), avisos al guardar, borrar con confirmación y «¿Descartar los cambios?» al salir
(también con el «atrás» del navegador, sin duplicar entradas del historial). Los datos de prueba solo
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

SEMBRAR = """<!doctype html><meta charset="utf-8">
<script>localStorage.clear(); window.listo = true;</script>"""
# Las pruebas sirven la app desde http://boxeo.local, que no es un contexto seguro: ahí Chromium no tiene
# crypto.randomUUID (en https y en localhost, sí). Solo para estas pruebas, uno equivalente.
UUID_SIN_HTTPS = """if (!crypto.randomUUID) crypto.randomUUID = () =>
  '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16));"""
RUTA = "#ajustes/mis-combinaciones"
EJEMPLOS = [["jab", "rodar_der", "uppercut_der"], ["jab", "directo", "esquiva_izq", "gancho_izq", "directo"],
            ["bloqueo", "parada", "paso_atras"]]
ANIMACIONES_ACABADAS = "() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))"
# Elementos de la subpágina que se salen por la derecha del ancho útil (sin la barra de desplazamiento).
SE_SALEN = """() => { const ancho = document.documentElement.clientWidth;
  return [...document.querySelectorAll('#ajustes-contenido *')]
    .filter((e) => e.getClientRects().length && !e.closest('dialog:not([open])') && !e.closest('.solo-lectores'))
    .filter((e) => { const r = e.getBoundingClientRect(); return r.right > ancho + 0.5 || r.left < -0.5; })
    .map((e) => `${e.tagName}.${e.className}`); }"""
# Botones visibles de la subpágina con menos de 48 px de alto o de ancho.
PEQUENOS = """() => [...document.querySelectorAll('#ajustes-contenido button')]
  .filter((b) => b.getClientRects().length && !b.closest('dialog:not([open])'))
  .map((b) => ({ b, r: b.getBoundingClientRect() })).filter(({ r }) => r.height < 47.5 || r.width < 47.5)
  .map(({ b, r }) => `${b.className || b.id} ${Math.round(r.width)}x${Math.round(r.height)}`)"""

# Palabras partidas en dos líneas en las baldosas y los botones (cada palabra debe ocupar un solo trozo).
PARTIDAS = """() => [...document.querySelectorAll('#ajustes-contenido :is(.baldosa span, .boton, dialog[open] .boton)')]
  .filter((e) => e.getClientRects().length).flatMap((e) => {
    const nodo = [...e.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (!nodo) return [];
    const partidas = [];
    for (const m of nodo.textContent.matchAll(/\\S+/g)) {
      const r = document.createRange();
      r.setStart(nodo, m.index);
      r.setEnd(nodo, m.index + m[0].length);
      if (r.getClientRects().length > 1) partidas.push(m[0]);
    }
    return partidas;
  })"""


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas del creador necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.fixture(scope="module")
def navegador(sitio):
    with abrir(sitio, SEMBRAR, 390, 844, barras=True) as (pagina, errores):
        pagina.add_init_script(UUID_SIN_HTTPS)
        yield pagina
        assert not errores


@pytest.fixture
def pagina(navegador):
    navegador.set_viewport_size({"width": 390, "height": 844})
    return navegador


def ir(pagina, ruta, propias=()):
    """Abre la app de cero con esas combinaciones propias guardadas (solo en este navegador)."""
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    if propias:
        datos = {"version": 8, "combinacionesPropias": [
            {"id": f"p-{i}", "ids": ids, "creada": "2026-11-04T10:00:00"} for i, ids in enumerate(propias)]}
        pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(datos))
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    pagina.wait_for_selector("#t-creador" if ruta.startswith(RUTA) else "#t-practicar")


def guardadas(pagina):
    texto = pagina.evaluate("localStorage.getItem('boxeo')")
    return [p["ids"] for p in json.loads(texto)["combinacionesPropias"]] if texto else []


def foco(pagina):
    return pagina.evaluate("""() => { const e = document.activeElement;
      if (e.closest("dialog")) return e.textContent.trim();
      return e.id || e.dataset.anadir || (e.dataset.quitar && 'quitar-' + e.dataset.quitar)
        || (e.dataset.editar && 'editar-' + e.dataset.editar) || (e.dataset.borrar && 'borrar-' + e.dataset.borrar)
        || e.value || e.textContent.trim(); }""")


def fichas(pagina):
    return pagina.locator(".tira-fichas .chip-paso").evaluate_all("(bs) => bs.map((b) => b.dataset.quitar)")


def anadir(pagina, *ids):
    for id_ in ids:
        if id_.endswith("_cuerpo") and pagina.get_attribute("#al-cuerpo", "aria-checked") == "false":
            pagina.click("#al-cuerpo")
        grupo = "golpe" if id_ in GOLPES else "defensa" if id_ in DEFENSAS else "movimiento"
        pagina.click(f'[data-grupo="{grupo}"]')
        pagina.click(f'[data-anadir="{id_}"]')


GOLPES = {"jab", "directo", "gancho_izq", "gancho_der", "uppercut_izq", "uppercut_der",
          "jab_cuerpo", "directo_cuerpo", "gancho_izq_cuerpo", "gancho_der_cuerpo", "uppercut_izq_cuerpo",
          "uppercut_der_cuerpo"}
DEFENSAS = {"esquiva_der", "esquiva_izq", "rodar_der", "rodar_izq", "paso_atras", "bloqueo", "parada", "ballesteo",
            "flexion"}


# ---------- Tarjeta y listado ----------

def test_la_tarjeta_de_ajustes_dice_cuantas_y_lleva_al_listado_y_volver_devuelve_el_foco(pagina):
    ir(pagina, "#ajustes", EJEMPLOS)
    assert " ".join(pagina.inner_text("#ir-creador").split()) == (
        "MIS COMBINACIONES 3/20 Crea las tuyas y mézclalas con la biblioteca en Entrenar.")
    pagina.click("#ir-creador")
    pagina.wait_for_selector(".lista-propias")
    assert foco(pagina) == "t-creador"
    assert pagina.is_hidden("#t-ajustes")
    assert pagina.locator(".propia h2").all_inner_texts() == ["COMBINACIÓN 1", "COMBINACIÓN 2", "COMBINACIÓN 3"]
    assert pagina.locator(".pastilla-nivel").all_inner_texts() == ["Básico", "Medio", "Básico"]
    # Fichas con el código de la sesión y, para lectores de pantalla, el texto hablado.
    assert pagina.locator(".propia").first.locator(".fichas-combo li").all_text_contents() == [
        "1jab", "rueda dcha.", "6gancho dcha."]
    assert "rueda derecha" in pagina.locator(".propia .solo-lectores").first.inner_text()
    pagina.click(".volver-sub a")
    pagina.wait_for_selector("#t-practicar")
    assert foco(pagina) == "ir-creador"


def test_listado_vacio_explica_para_que_sirve(pagina):
    ir(pagina, RUTA)
    assert "Aún no tienes ninguna" in pagina.inner_text(".vacio-propias")
    assert pagina.get_attribute("#anadir-propia", "aria-disabled") is None
    assert "0 de 20" in pagina.inner_text(".cabecera-sub")


def test_con_20_anadir_no_hace_nada_y_dice_por_que(pagina):
    ir(pagina, RUTA, [EJEMPLOS[i % 3] for i in range(20)])
    boton = pagina.locator("#anadir-propia")
    assert boton.get_attribute("aria-disabled") == "true"
    assert pagina.inner_text("#motivo-anadir") == "Ya tienes 20 combinaciones: borra alguna para crear otra."
    assert boton.get_attribute("aria-describedby") == "motivo-anadir"
    assert float(boton.evaluate("(b) => getComputedStyle(b).opacity")) < 0.6
    boton.click(force=True)
    boton.focus()
    pagina.keyboard.press("Enter")
    assert pagina.evaluate("location.hash") == RUTA
    # Ni escribiendo la ruta del editor.
    pagina.evaluate(f"location.hash = '{RUTA}/nueva'")
    pagina.wait_for_function(f"location.hash === '{RUTA}'")
    assert pagina.locator(".lista-propias").count() == 1


def test_editar_una_que_no_existe_lleva_al_listado(pagina):
    ir(pagina, f"{RUTA}/editar/p-nada", EJEMPLOS)
    assert pagina.evaluate("location.hash") == RUTA
    assert pagina.locator(".propia").count() == 3


def test_borrar_pide_confirmacion_avisa_de_la_renumeracion_y_devuelve_el_foco(pagina):
    ir(pagina, RUTA, EJEMPLOS)
    pagina.click('[data-borrar="p-0"]')
    dialogo = pagina.locator("#d-borrar")
    assert dialogo.get_attribute("open") is not None
    assert pagina.inner_text("#t-borrar") == "¿BORRAR LA COMBINACIÓN 1?"
    assert "se renumeran: la 2 pasará a ser la 1" in pagina.inner_text("#detalle-borrar")
    assert foco(pagina) == "Cancelar"
    pagina.keyboard.press("Escape")
    assert guardadas(pagina) == EJEMPLOS
    assert foco(pagina) == "borrar-p-0"
    pagina.click('[data-borrar="p-0"]')
    pagina.click('#d-borrar button[value="borrar"]')
    assert guardadas(pagina) == EJEMPLOS[1:]
    assert pagina.locator(".propia h2").all_inner_texts() == ["COMBINACIÓN 1", "COMBINACIÓN 2"]
    assert foco(pagina) == "borrar-p-1"
    # La última: no hay renumeración que avisar.
    pagina.click('[data-borrar="p-2"]')
    assert pagina.inner_text("#detalle-borrar") == "No se puede deshacer."
    pagina.click('#d-borrar button[value="borrar"]')
    assert foco(pagina) == "borrar-p-1"


# ---------- Editor ----------

def test_crear_con_el_teclado_al_cuerpo_se_apaga_solo_y_guardar_vuelve_al_listado(pagina):
    ir(pagina, RUTA)
    pagina.focus("#anadir-propia")
    pagina.keyboard.press("Enter")
    pagina.wait_for_selector("#caja-combo")
    assert foco(pagina) == "t-creador"
    assert "NUEVA" in pagina.inner_text("#t-creador")
    # Guardar no hace nada con 0 o 1 acciones y dice por qué.
    guardar = pagina.locator("#guardar")
    assert guardar.get_attribute("aria-disabled") == "true"
    assert pagina.inner_text("#motivo-guardar") == "Mínimo 2"
    assert guardar.get_attribute("aria-describedby") == "motivo-guardar"
    guardar.focus()
    pagina.keyboard.press("Enter")
    assert pagina.evaluate("location.hash") == f"{RUTA}/nueva"
    # «Al cuerpo» con Espacio: interruptor; tras añadir un golpe se apaga solo.
    interruptor = pagina.locator("#al-cuerpo")
    assert interruptor.get_attribute("role") == "switch"
    interruptor.focus()
    pagina.keyboard.press("Space")
    assert interruptor.get_attribute("aria-checked") == "true"
    assert pagina.locator(".baldosa b").all_inner_texts() == ["7", "8", "9", "10", "11", "12"]
    pagina.focus('[data-anadir="directo_cuerpo"]')
    pagina.keyboard.press("Enter")
    assert pagina.get_attribute("#al-cuerpo", "aria-checked") == "false"
    assert pagina.locator(".baldosa b").all_inner_texts() == ["1", "2", "3", "4", "5", "6"]
    assert foco(pagina) == "directo"  # la baldosa del mismo sitio
    assert pagina.inner_text("#motivo-guardar") == "Mínimo 2"
    pagina.keyboard.press("Enter")  # recto
    assert pagina.is_hidden("#motivo-guardar")
    assert guardar.get_attribute("aria-disabled") is None
    assert pagina.inner_text(".nivel-grande") == "BÁSICO"
    assert pagina.inner_text(".contador") == "2 de 10 acciones"
    # «Añadido…» solo para lectores de pantalla.
    pagina.wait_for_function("document.getElementById('estado').textContent === 'Añadido recto. 2 acciones, básico.'")
    assert pagina.inner_text("#estado") == "Añadido recto. 2 acciones, básico."
    assert pagina.locator("#estado").evaluate("(e) => e.getAttribute('aria-live')") == "polite"
    assert pagina.locator("#caja-combo :text('Añadido')").count() == 0
    guardar.focus()
    pagina.keyboard.press("Enter")
    pagina.wait_for_selector(".lista-propias")
    assert guardadas(pagina) == [["directo_cuerpo", "directo"]]
    assert foco(pagina).startswith("editar-p-")
    pagina.wait_for_function("document.getElementById('estado').textContent === 'Guardada la combinación 1.'")


def test_quitar_una_ficha_o_la_ultima_y_el_foco_va_a_la_siguiente(pagina):
    ir(pagina, f"{RUTA}/nueva")
    anadir(pagina, "jab", "directo", "bloqueo", "gancho_izq")
    assert pagina.get_attribute('[data-quitar="1"]', "aria-label") == "Quitar recto, acción 2"
    pagina.click('[data-quitar="1"]')
    assert fichas(pagina) == ["0", "1", "2"]
    assert foco(pagina) == "quitar-1"
    assert "bloqueo" in pagina.inner_text('[data-quitar="1"]')
    pagina.click('[data-quitar="2"]')  # la última ficha: el foco, a «Quitar la última»
    assert foco(pagina) == "quitar-ultima"
    pagina.click("#quitar-ultima")
    pagina.click("#quitar-ultima")
    assert fichas(pagina) == []
    assert pagina.get_attribute("#quitar-ultima", "aria-disabled") == "true"
    pagina.click("#quitar-ultima", force=True)  # no hace nada


def test_con_10_acciones_la_paleta_no_anade_mas_y_dice_por_que(pagina):
    ir(pagina, f"{RUTA}/nueva")
    for _ in range(10):
        pagina.click('[data-anadir="jab"]')
    assert len(fichas(pagina)) == 10
    assert pagina.inner_text(".nivel-grande") == "AVANZADO"
    assert pagina.inner_text("#motivo-paleta") == "Máximo 10 acciones"
    baldosa = pagina.locator('[data-anadir="jab"]')
    assert baldosa.get_attribute("aria-disabled") == "true"
    assert float(baldosa.evaluate("(b) => getComputedStyle(b).opacity")) < 0.6
    baldosa.click(force=True)
    baldosa.focus()
    pagina.keyboard.press("Enter")
    pagina.click('[data-grupo="defensa"]')
    pagina.click('[data-anadir="bloqueo"]', force=True)
    assert len(fichas(pagina)) == 10
    assert pagina.get_attribute("#guardar", "aria-disabled") is None


def test_avisos_al_guardar_volver_a_editar_no_guarda_y_guardar_igual_si(pagina):
    ir(pagina, f"{RUTA}/nueva", [["bloqueo", "parada"]])
    anadir(pagina, "bloqueo", "parada")
    pagina.click("#guardar")
    assert pagina.get_attribute("#d-avisos", "open") is not None
    assert pagina.locator(".lista-avisos li").all_inner_texts() == [
        "No lleva ningún golpe.", "Es igual que tu combinación 1."]
    assert foco(pagina) == "Volver a editar"
    # El foco no sale del diálogo con Tab.
    pagina.keyboard.press("Tab")
    assert foco(pagina) == "Guardar igual"
    pagina.keyboard.press("Tab")
    assert foco(pagina) == "Volver a editar"
    pagina.keyboard.press("Shift+Tab")
    assert foco(pagina) == "Guardar igual"
    pagina.keyboard.press("Escape")
    assert foco(pagina) == "guardar" and pagina.get_attribute("#d-avisos", "open") is None
    pagina.click("#guardar")
    pagina.click('#d-avisos button[value=""]')
    assert guardadas(pagina) == [["bloqueo", "parada"]]
    pagina.click("#guardar")
    pagina.click('#d-avisos button[value="guardar"]')
    pagina.wait_for_selector(".lista-propias")
    assert guardadas(pagina) == [["bloqueo", "parada"]] * 2


def test_igual_que_una_de_la_biblioteca_dice_su_nivel_y_no_se_compara_consigo_misma(pagina):
    biblioteca = json.loads(open("data/combinaciones.json", encoding="utf-8").read())["combinaciones"][0]
    ir(pagina, f"{RUTA}/editar/p-0", [biblioteca["ids"]])
    assert "EDITAR" in pagina.inner_text("#t-creador")
    pagina.click("#guardar")
    textos = pagina.locator(".lista-avisos li").all_inner_texts()
    assert textos == ["Ya está en la biblioteca, en nivel básico."]
    pagina.click('#d-avisos button[value="guardar"]')
    pagina.wait_for_selector(".lista-propias")
    # Se abrió el editor directamente (sin pasar por el listado): el listado lo sustituye en el historial.
    assert pagina.evaluate("location.hash") == RUTA


# ---------- Salir con cambios ----------

def _largo_historial(pagina):
    return pagina.evaluate("history.length")


def test_volver_con_cambios_pregunta_y_descartar_vuelve_al_listado_sin_apilar(pagina):
    ir(pagina, RUTA)
    largo = _largo_historial(pagina)
    pagina.click("#anadir-propia")
    pagina.wait_for_selector("#caja-combo")
    # Sin cambios, «← Mis combinaciones» vuelve atrás sin preguntar.
    pagina.click("#salir-editor")
    pagina.wait_for_selector(".vacio-propias")
    pagina.click("#anadir-propia")
    pagina.wait_for_selector("#caja-combo")
    pagina.click('[data-anadir="jab"]')
    pagina.click("#salir-editor")
    assert pagina.get_attribute("#d-descartar", "open") is not None
    assert foco(pagina) == "Seguir editando"
    pagina.keyboard.press("Escape")
    assert fichas(pagina) == ["0"]
    pagina.click("#salir-editor")
    pagina.click('#d-descartar button[value="descartar"]')
    pagina.wait_for_selector(".vacio-propias")
    assert pagina.evaluate("location.hash") == RUTA
    assert _largo_historial(pagina) == largo + 1
    assert guardadas(pagina) == []


def test_atras_del_navegador_con_cambios_vuelve_al_editor_y_pregunta_sin_bucles(pagina):
    ir(pagina, RUTA)
    pagina.click("#anadir-propia")
    pagina.wait_for_selector("#caja-combo")
    largo = _largo_historial(pagina)
    anadir(pagina, "jab", "bloqueo")
    pagina.go_back()
    pagina.wait_for_selector("#d-descartar[open]")
    pagina.wait_for_function(f"location.hash === '{RUTA}/nueva'")
    assert fichas(pagina) == ["0", "1"]
    assert _largo_historial(pagina) == largo
    pagina.click('#d-descartar button[value=""]')
    assert fichas(pagina) == ["0", "1"]
    # Otra vez atrás y «Descartar»: al listado, que es adonde se iba.
    pagina.go_back()
    pagina.wait_for_selector("#d-descartar[open]")
    pagina.wait_for_function(f"location.hash === '{RUTA}/nueva'")
    pagina.click('#d-descartar button[value="descartar"]')
    pagina.wait_for_selector(".vacio-propias")
    pagina.wait_for_timeout(200)
    assert pagina.evaluate("location.hash") == RUTA
    assert _largo_historial(pagina) == largo
    assert pagina.locator("dialog[open]").count() == 0


def test_cambiar_de_pestana_con_cambios_pregunta_y_descartar_va_a_la_pestana(pagina):
    ir(pagina, f"{RUTA}/nueva")
    pagina.click('[data-anadir="jab"]')
    pagina.click('#pestanas a[href="#historial"]')
    pagina.wait_for_selector("#d-descartar[open]")
    pagina.wait_for_function(f"location.hash === '{RUTA}/nueva'")
    assert fichas(pagina) == ["0"]
    pagina.click('#d-descartar button[value="descartar"]')
    pagina.wait_for_function("location.hash === '#historial'")
    pagina.wait_for_selector("#vista-historial", state="visible")
    assert pagina.locator("dialog[open]").count() == 0


# ---------- Diseño ----------

@pytest.mark.parametrize("ancho", [390, 1024, 1440])
def test_nada_se_sale_y_los_toques_miden_48(pagina, ancho):
    pagina.set_viewport_size({"width": ancho, "height": 900})
    ir(pagina, RUTA, [EJEMPLOS[i % 3] for i in range(3)])
    if ancho == 390:  # 375 px útiles: la barra de desplazamiento ocupa sitio
        assert pagina.evaluate("document.documentElement.clientWidth") <= 375
    pagina.evaluate(ANIMACIONES_ACABADAS)
    assert pagina.evaluate(SE_SALEN) == []
    assert pagina.evaluate(PEQUENOS) == []
    assert pagina.evaluate(PARTIDAS) == []
    pagina.click('[data-borrar="p-1"]')
    assert pagina.evaluate(SE_SALEN) == []
    pagina.keyboard.press("Escape")
    pagina.click('[data-editar="p-1"]')
    pagina.wait_for_selector("#caja-combo")
    pagina.click("#al-cuerpo")
    for _ in range(5):
        pagina.click('[data-anadir="gancho_der_cuerpo"]')
        pagina.click("#al-cuerpo")
    pagina.evaluate(ANIMACIONES_ACABADAS)
    assert len(fichas(pagina)) == 10
    assert pagina.evaluate(SE_SALEN) == []
    assert pagina.evaluate(PEQUENOS) == []
    assert pagina.evaluate(PARTIDAS) == []
    for grupo in ("defensa", "movimiento"):
        pagina.click(f'[data-grupo="{grupo}"]')
        assert pagina.evaluate(SE_SALEN) == []
        assert pagina.evaluate(PEQUENOS) == []
        assert pagina.evaluate(PARTIDAS) == []
    paleta = pagina.locator(".editor-paleta").bounding_box()
    caja = pagina.locator(".editor-combo").bounding_box()
    if ancho >= 1024:  # dos columnas: paleta a la izquierda, combinación a la derecha
        assert caja["x"] > paleta["x"] + paleta["width"] - 1 and abs(caja["y"] - paleta["y"]) < 2
    else:  # una: la combinación encima
        assert caja["y"] + caja["height"] <= paleta["y"]
