"""El Perfil en un navegador de verdad (Chromium headless con Playwright).

Ya no enseña el aviso de «orientativo / consultar con el entrenador» ni las secciones «Notas del
entrenador» y «Revisar con el entrenador», pero lo guardado de ellas sigue en el almacén. Sin
Playwright se salta en local; en CI falla.
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

# Una nota del entrenador y una revisión guardadas de antes. En http://boxeo.local (no seguro) no
# hay crypto.randomUUID: el id lo pone la prueba.
SEMBRAR = """<!doctype html><meta charset="utf-8">
<script type="module">
import { crearAlmacen } from "./almacen.js";
localStorage.clear();
const almacen = crearAlmacen({ crearId: () => "nota-1" });
almacen.anadirNotaEntrenador("Baja la barbilla", "2026-10-20");
almacen.guardarRevision("punto-1", { respuesta: "Vale así", confirmado: true });
window.listo = true;
</script>"""


@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas del Perfil necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, SEMBRAR, 390, 844, barras=True) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        yield pagina
        assert not errores


def _guardado(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')"))


# Respuestas que dan Boxer claro (4 de las 5 clave) y las que dejan a Boxer y Fajador empatados.
BOXER = {"distancia": "larga", "presion": "salir", "volumen": "pocos_fuertes", "iniciativa": "segun_rival"}
EMPATE = {"distancia": "corta", "presion": "salir", "volumen": "combos_largos", "iniciativa": "segun_rival"}


def _abrir_perfil(pagina, estilo=None, ancho=390):
    """Abre el Perfil con `estilo` (respuestas y «Mi estilo») guardado en el localStorage de prueba."""
    pagina.set_viewport_size({"width": ancho, "height": 900})
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#zurdo")
    pagina.evaluate("""async (estilo) => {
        const datos = JSON.parse(localStorage.getItem("boxeo"));
        datos.perfil.estilo = { ...datos.perfil.estilo, mi_estilo: "no_se", distancia: "no_se", presion: "no_se",
          volumen: "no_se", iniciativa: "no_se", defensa: "no_se", cardio: "no_se", golpe_favorito: "no_se", ...estilo };
        localStorage.setItem("boxeo", JSON.stringify(datos));
    }""", estilo or {})
    pagina.goto(f"{ORIGEN}/index.html#perfil")
    pagina.reload()
    pagina.wait_for_function("!document.querySelector('#estilo-resumen')?.textContent.includes('Cargando')")


def test_orden_rectangulo_sobre_ti_y_mi_estilo_con_las_preguntas_en_su_orden(pagina):
    _abrir_perfil(pagina)
    hijos = pagina.eval_on_selector_all("#perfil-contenido > *", "els => els.map(e => e.id || e.className)")
    assert hijos[:3] == ["tarjeta estilo-recomendado", "d-sobre-ti", "d-mi-estilo"]
    preguntas = pagina.eval_on_selector_all("#f-estilo legend", "els => els.map(e => e.textContent)")
    assert preguntas == ["Distancia cómoda", "Qué hago bajo presión", "Volumen", "Iniciativa", "Tipo de defensa",
                         "Cardio", "Golpe favorito"]
    assert pagina.locator("#f-estilo [data-campo='mi_estilo']").count() == 0
    assert pagina.locator("#d-mi-estilo [data-campo='mi_estilo']").count() == 5


def test_sobre_ti_abierto_mientras_falten_respuestas_y_mi_estilo_cerrado(pagina):
    _abrir_perfil(pagina, {"distancia": "larga", "presion": "salir", "volumen": "pocos_fuertes"})
    assert pagina.locator("#d-sobre-ti").evaluate("d => d.open")
    assert not pagina.locator("#d-mi-estilo").evaluate("d => d.open")
    assert pagina.locator("#resumen-sobre-ti").inner_text() == "3 de 7 preguntas"
    _abrir_perfil(pagina, BOXER)
    assert not pagina.locator("#d-sobre-ti").evaluate("d => d.open")
    assert pagina.locator("#estilo-resumen .titular").inner_text().lower() == "boxer"


def test_las_secciones_se_abren_con_el_teclado(pagina):
    _abrir_perfil(pagina, BOXER)
    resumen = pagina.locator("#d-mi-estilo > summary")
    resumen.focus()
    pagina.keyboard.press("Enter")
    assert pagina.locator("#d-mi-estilo").evaluate("d => d.open")
    pagina.keyboard.press("Space")
    assert not pagina.locator("#d-mi-estilo").evaluate("d => d.open")
    # El foco se ve con el subrayado rojo del título, no con el recuadro.
    pagina.keyboard.press("Shift+Tab")
    pagina.keyboard.press("Tab")
    estilo = pagina.locator("#d-mi-estilo .titulo-plegable").evaluate("e => getComputedStyle(e).textDecorationLine")
    assert "underline" in estilo


def test_mi_estilo_manda_y_solo_se_dice_otro_si_las_respuestas_apuntan_a_otro(pagina):
    _abrir_perfil(pagina, {**BOXER, "mi_estilo": "boxer"})
    assert pagina.locator("#t-estilo").inner_text().lower() == "tu estilo"
    assert pagina.locator("#estilo-resumen .titular").inner_text().lower() == "boxer"
    assert pagina.locator("#estilo-resumen .segun").count() == 0
    assert pagina.locator("#resumen-mi-estilo").inner_text() == "Boxer"
    _abrir_perfil(pagina, {**BOXER, "mi_estilo": "fajador"})
    assert pagina.locator("#estilo-resumen .titular").inner_text().lower() == "fajador"
    assert pagina.locator("#estilo-resumen .segun").inner_text() == "Según tus respuestas: Boxer"
    texto = pagina.locator("#estilo-resumen").inner_text().lower()
    for frase in ("recomendado", "porque", "también", "aviso"):
        assert frase not in texto, frase
    # Empate en el que está el elegido: nada; si no está, los dos.
    _abrir_perfil(pagina, {**EMPATE, "mi_estilo": "fajador"})
    assert pagina.locator("#estilo-resumen .segun").count() == 0
    _abrir_perfil(pagina, {**EMPATE, "mi_estilo": "contragolpeador"})
    assert pagina.locator("#estilo-resumen .segun").inner_text() == "Según tus respuestas: Boxer o Fajador"


@pytest.mark.parametrize("ancho", (390, 1440))
def test_el_perfil_no_muestra_el_aviso_ni_las_secciones_del_entrenador(pagina, ancho):
    pedidos = []
    pagina.on("request", lambda r: pedidos.append(r.url))
    _abrir_perfil(pagina, ancho=ancho)
    texto = pagina.locator("#perfil-contenido").inner_text().lower()
    for frase in ("orientativo", "consúltalo", "entrenador", "notas del", "revisar"):
        assert frase not in texto, frase
    for selector in ("#t-notas", "#f-nota", "#t-revisar", "#lista-revisar", ".nota-estilo"):
        assert pagina.locator(selector).count() == 0, selector
    assert not [u for u in pedidos if u.endswith("data/revisar.json")]


def test_lo_guardado_del_entrenador_sigue_en_el_almacen(pagina):
    _abrir_perfil(pagina)
    pagina.fill('[data-campo="altura_cm"]', "180")
    pagina.locator('[data-campo="altura_cm"]').dispatch_event("change")
    datos = _guardado(pagina)
    assert datos["perfil"]["basicos"]["altura_cm"] == 180
    assert datos["notas_entrenador"] == [{"id": "nota-1", "fecha": "2026-10-20", "texto": "Baja la barbilla"}]
    assert datos["revisiones"]["punto-1"]["respuesta"] == "Vale así"
