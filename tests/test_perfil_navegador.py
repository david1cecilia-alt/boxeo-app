"""El Perfil en un navegador de verdad (Chromium headless con Playwright).

Rectángulo rojo, «Sobre ti» y «Mi estilo» plegables; sin el aviso de «orientativo / consultar con el
entrenador» ni las secciones del entrenador. Un almacén v6 con notas y revisiones se migra a v7 sin ellas.
Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import json
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir
from tests.sin_intro import preparar
from tests.menu_quieto import esperar_menu_quieto

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

# Un almacén v6 escrito tal cual (como lo dejó la app antes de la v7): con una nota del entrenador, una
# revisión y la guardia y el nivel de «Tus datos», sin nada elegido aún en Entrenar.
V6 = {
    "version": 6, "sesiones": [], "valoraciones": {},
    "perfil": {"basicos": {"guardia": "zurda", "nivel": "3", "inicio": None, "altura_cm": 178, "peso_kg": None,
                           "alcance_cm": None},
               "sesion": {"voz": "nombres", "ritmo": 3, "asalto": "amateur", "nivel": None, "zurdo": None},
               "practicar": []},
    "notas_entrenador": [{"id": "nota-1", "fecha": "2026-10-20", "texto": "Baja la barbilla"}],
    "revisiones": {"punto-1": {"respuesta": "Vale así", "confirmado": True, "fecha": "2026-10-21"}},
}
SEMBRAR = f"""<!doctype html><meta charset="utf-8">
<script>localStorage.setItem("boxeo", {json.dumps(json.dumps(V6))}); window.listo = true;</script>"""


@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas del Perfil necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, SEMBRAR, 390, 844, barras=True) as (pagina, errores):
        preparar(pagina)
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
    pagina.wait_for_selector("#empezar")
    pagina.wait_for_function("localStorage.getItem('boxeo') !== null")  # migrada y guardada al arrancar
    pagina.evaluate("""async (estilo) => {
        const datos = JSON.parse(localStorage.getItem("boxeo"));
        datos.perfil.estilo = { ...datos.perfil.estilo, mi_estilo: "no_se", distancia: "no_se", presion: "no_se",
          volumen: "no_se", iniciativa: "no_se", defensa: "no_se", cardio: "no_se", golpe_favorito: "no_se", ...estilo };
        localStorage.setItem("boxeo", JSON.stringify(datos));
    }""", estilo or {})
    pagina.goto(f"{ORIGEN}/index.html#perfil")
    pagina.reload()
    # Pintado y con la tabla de estilos cargada. Sin `#estilo-resumen` (la app aún no ha arrancado tras el
    # reload) no vale: `?.` daría undefined y la espera acabaría antes de pintar nada.
    pagina.wait_for_function("""() => { const r = document.querySelector('#perfil-contenido #estilo-resumen');
      return r !== null && r.textContent.trim() !== '' && !r.textContent.includes('Cargando'); }""")


def test_el_almacen_v6_se_migra_sin_notas_ni_revisiones_y_la_guardia_pasa_a_ajustes(pagina):
    _abrir_perfil(pagina)
    datos = _guardado(pagina)
    assert datos["version"] == 9  # la actual: pasa por la 7, la 8 (combinaciones propias) y la 9
    # Amateur con nivel 3 no es la General: Personalizada 3×3, para que la sesión no cambie.
    assert datos["perfil"]["sesion"]["tipo"] == "personalizada" and "asalto" not in datos["perfil"]["sesion"]
    assert datos["perfil"]["sesion"]["personalizada"] == {"asaltos": 3, "duracion_asalto": 180, "descanso": 60}
    assert datos["perfil"]["identidad"] == {"nombre": "", "avatar": {"tipo": "inicial"}, "foto": None} and datos["perfil"]["pistas"] == {"asa": False}
    assert datos["combinacionesPropias"] == [] and datos["perfil"]["sesion"]["mezcla"] == "ninguna"
    assert "notas_entrenador" not in datos and "revisiones" not in datos
    assert datos["perfil"]["basicos"] == {"inicio": None, "altura_cm": 178, "peso_kg": None, "alcance_cm": None}
    assert (datos["perfil"]["sesion"]["nivel"], datos["perfil"]["sesion"]["zurdo"]) == (3, True)
    assert pagina.locator("#antetitulo-perfil").inner_text().lower() == "zurdo"  # solo la guardia, sin nivel
    pagina.locator("#d-sobre-ti > summary").click()  # cerrado: «Sobre ti» ya no se abre solo
    pagina.fill('[data-campo="altura_cm"]', "180")
    pagina.locator('[data-campo="altura_cm"]').dispatch_event("change")
    assert _guardado(pagina)["perfil"]["basicos"]["altura_cm"] == 180
    # La guardia sigue igual: en Ajustes (menú de Entrenar) sale marcado Zurdo.
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/ajustes")
    pagina.wait_for_selector("#voz-id", state="visible")
    esperar_menu_quieto(pagina)
    assert pagina.is_checked('#menu-ajustes input[name="guardia"][value="zurdo"]')


def test_orden_estilo_cuestionario_mi_estilo_y_sobre_ti_con_las_preguntas_en_su_orden(pagina):
    _abrir_perfil(pagina)
    hijos = pagina.eval_on_selector_all("#perfil-contenido > *", "els => els.map(e => e.id || e.className)")
    assert hijos == ["tarjeta estilo-recomendado", "d-cuestionario", "d-mi-estilo", "d-sobre-ti", "nota pie-perfil"]
    preguntas = pagina.eval_on_selector_all("#d-cuestionario #f-estilo legend", "els => els.map(e => e.textContent)")
    assert preguntas == ["Distancia cómoda", "Qué hago bajo presión", "Volumen", "Iniciativa", "Tipo de defensa",
                         "Cardio", "Golpe favorito"]
    assert pagina.locator("#f-estilo [data-campo='mi_estilo']").count() == 0
    assert pagina.locator("#d-mi-estilo [data-campo='mi_estilo']").count() == 5
    # «Sobre ti» ya solo trae la fecha y las medidas.
    assert pagina.locator("#d-sobre-ti input").count() == 4
    assert pagina.locator("#d-sobre-ti [data-grupo='estilo']").count() == 0


def test_el_cuestionario_solo_se_ve_al_abrirlo_y_dice_hacer_o_repetir(pagina):
    _abrir_perfil(pagina, {"distancia": "larga", "presion": "salir", "volumen": "pocos_fuertes"})
    # Faltan respuestas: «Hacer el cuestionario», cerrado.
    assert pagina.locator("#t-cuestionario").text_content() == "Hacer el cuestionario"
    assert pagina.locator("#resumen-cuestionario").inner_text() == "3 de 7 preguntas"
    assert not pagina.locator("#d-cuestionario").evaluate("d => d.open")
    assert not pagina.locator("#f-estilo").is_visible()
    pagina.locator("#d-cuestionario > summary").click()
    assert pagina.locator("#f-estilo").is_visible()
    # Completo (da recomendación): «Repetir el cuestionario», y también cerrado.
    _abrir_perfil(pagina, BOXER)
    assert pagina.locator("#t-cuestionario").text_content() == "Repetir el cuestionario"
    assert not pagina.locator("#d-cuestionario").evaluate("d => d.open")
    assert not pagina.locator("#f-estilo").is_visible()
    assert pagina.locator("#estilo-resumen .titular").inner_text().lower() == "boxer"
    # Completo y con «Mi estilo» elegido (la tarjeta dice el elegido): «Repetir».
    _abrir_perfil(pagina, {**BOXER, "mi_estilo": "fajador"})
    assert pagina.locator("#t-cuestionario").text_content() == "Repetir el cuestionario"
    assert pagina.locator("#estilo-resumen .titular").inner_text().lower() == "fajador"
    # 0 de 7 con «Mi estilo» elegido: la tarjeta dice el estilo, pero el cuestionario sigue por hacer.
    _abrir_perfil(pagina, {"mi_estilo": "fajador"})
    assert pagina.locator("#resumen-cuestionario").inner_text() == "0 de 7 preguntas"
    assert pagina.locator("#t-estilo").inner_text().lower() == "tu estilo"
    assert pagina.locator("#estilo-resumen .titular").inner_text().lower() == "fajador"
    assert pagina.locator("#t-cuestionario").text_content() == "Hacer el cuestionario"
    # A medias con «Mi estilo» elegido: también «Hacer».
    _abrir_perfil(pagina, {"distancia": "larga", "presion": "salir", "mi_estilo": "boxer"})
    assert pagina.locator("#t-cuestionario").text_content() == "Hacer el cuestionario"
    assert not pagina.locator("#d-sobre-ti").evaluate("d => d.open")
    assert not pagina.locator("#d-mi-estilo").evaluate("d => d.open")
    assert pagina.locator("#resumen-sobre-ti").inner_text() == "1 de 4 datos"  # la altura del almacén v6


def test_responder_la_ultima_pregunta_que_faltaba_cambia_hacer_por_repetir(pagina):
    _abrir_perfil(pagina, {"distancia": "larga", "presion": "salir", "volumen": "pocos_fuertes"})
    pagina.locator("#d-cuestionario > summary").click()
    pagina.locator('input[name="estilo-iniciativa"][value="segun_rival"]').check(force=True)
    pagina.wait_for_function("document.querySelector('#t-cuestionario').textContent === 'Repetir el cuestionario'")
    assert pagina.locator("#d-cuestionario").evaluate("d => d.open")  # se queda abierto mientras responde


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


# ---------- La identidad, «Cambiar» y «← Volver» ----------

FOTO = "data:image/jpeg;base64," + "A" * 400  # bien formada (fotoValida solo mira el formato)


def _con_identidad(pagina, identidad, zurdo=False, ruta="#perfil"):
    """Guarda `identidad` y la guardia y abre `ruta` en un documento nuevo."""
    _abrir_perfil(pagina)
    pagina.evaluate("""([identidad, zurdo]) => {
        const datos = JSON.parse(localStorage.getItem("boxeo"));
        datos.perfil.identidad = identidad;
        datos.perfil.sesion.zurdo = zurdo;
        localStorage.setItem("boxeo", JSON.stringify(datos));
    }""", [identidad, zurdo])
    # Recargar, no pasar por __pagina__.html: en este módulo vuelve a sembrar el almacén v6.
    pagina.goto(f"{ORIGEN}/index.html{ruta}")
    pagina.reload()
    pagina.wait_for_selector("#perfil-contenido #d-cuestionario, #ir-perfil:visible")


def test_la_identidad_ensena_avatar_nombre_y_solo_la_guardia(pagina):
    _con_identidad(pagina, {"nombre": "Alex", "avatar": {"tipo": "predefinido", "id": "chica-gorra"}}, zurdo=True)
    assert pagina.locator("#t-perfil").text_content() == "Alex"
    assert pagina.locator("#antetitulo-perfil").text_content() == "Zurdo"
    img = pagina.locator("#perfil-avatar img.avatar")
    assert img.get_attribute("src") == "imagenes/avatares/chica-gorra.webp"
    assert img.get_attribute("alt").startswith("Avatar:")  # el alt de data/avatares.json
    _con_identidad(pagina, {"nombre": "Alex", "avatar": {"tipo": "foto"}, "foto": FOTO}, zurdo=False)
    assert pagina.locator("#antetitulo-perfil").text_content() == "Diestro"
    assert "nivel" not in pagina.locator("#antetitulo-perfil").inner_text().lower()
    img = pagina.locator("#perfil-avatar img.avatar")
    assert img.get_attribute("src") == FOTO and img.get_attribute("alt") == "Tu foto de perfil"
    # Sin nombre: «Tu perfil» y la silueta (decorativa).
    _con_identidad(pagina, {"nombre": "", "avatar": {"tipo": "inicial"}})
    assert pagina.locator("#t-perfil").text_content() == "Tu perfil"
    assert pagina.locator("#perfil-avatar .avatar-inicial[aria-hidden='true'] svg").count() == 1


def test_un_nombre_largo_ocupa_como_mucho_dos_lineas(pagina):
    _con_identidad(pagina, {"nombre": "Maximiliano Fernández-Castillo", "avatar": {"tipo": "inicial"}})
    h1 = pagina.locator("#t-perfil")
    lineas = h1.evaluate("(el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))")
    assert 1 <= lineas <= 2
    assert pagina.locator("#perfil-avatar .avatar-inicial").inner_text() == "M"


def _desde_entrenar(pagina):
    """Abre Entrenar y entra en Perfil por la cabecera (la entrada #perfil queda marcada)."""
    _con_identidad(pagina, {"nombre": "Alex", "avatar": {"tipo": "inicial"}}, ruta="#entrenar")
    pagina.click("#ir-perfil")
    pagina.wait_for_selector("#vista-perfil:not([hidden]) #d-cuestionario")
    assert pagina.evaluate("history.state?.desdeEntrenar") is True


def test_volver_desde_entrenar_hace_atras(pagina):
    _desde_entrenar(pagina)
    largo = pagina.evaluate("history.length")
    pagina.click("#volver-perfil")
    pagina.wait_for_function("location.hash === '#entrenar'")
    assert pagina.evaluate("history.length") == largo
    # Ha sido un «atrás»: hacia delante se vuelve a Perfil.
    pagina.go_forward()
    pagina.wait_for_function("location.hash === '#perfil'")


def test_volver_llegando_directo_sustituye_por_entrenar_sin_salir_de_la_app(pagina):
    _con_identidad(pagina, {"nombre": "Alex", "avatar": {"tipo": "inicial"}})
    assert not pagina.evaluate("history.state?.desdeEntrenar")
    largo = pagina.evaluate("history.length")
    pagina.click("#volver-perfil")
    pagina.wait_for_function("location.hash === '#entrenar'")
    pagina.wait_for_selector("#ir-perfil", state="visible")
    assert pagina.evaluate("history.length") == largo  # sustituida, no añadida: «atrás» no sale de la app


CIERRES = {
    "x": lambda p: p.click(".menu-cerrar"),
    "esc": lambda p: p.keyboard.press("Escape"),
    "velo": lambda p: p.mouse.click(10, 450),
    "atras": lambda p: p.go_back(),
}


@pytest.mark.parametrize("cierre", CIERRES)
def test_cambiar_abre_ajustes_en_el_menu_y_al_cerrar_vuelve_a_perfil_con_el_foco_en_cambiar(pagina, cierre):
    _desde_entrenar(pagina)
    pagina.click("#cambiar-identidad")
    pagina.wait_for_function("location.hash === '#entrenar/menu/ajustes'")
    pagina.wait_for_selector("#identidad #nombre", state="visible")
    esperar_menu_quieto(pagina)
    assert pagina.evaluate("history.state?.menu") is True
    assert pagina.locator('details[data-seccion="ajustes"]').evaluate("d => d.open")
    # Lo que se cambia allí sale en Perfil al volver.
    pagina.locator("#nombre").fill("Sam")
    pagina.locator("#nombre").dispatch_event("change")
    CIERRES[cierre](pagina)
    pagina.wait_for_function("location.hash === '#perfil'")
    pagina.wait_for_function("document.activeElement?.id === 'cambiar-identidad'")
    assert pagina.locator("#t-perfil").text_content() == "Sam"
    assert not pagina.locator("#menu").evaluate("d => d.open")
    # La marca del foco se gasta; la de «Volver», no.
    assert not pagina.evaluate("history.state?.focoCambiar")
    pagina.click("#volver-perfil")
    pagina.wait_for_function("location.hash === '#entrenar'")
