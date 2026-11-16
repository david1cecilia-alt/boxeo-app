"""Nombre y avatar o foto en la sección Ajustes del menú de Entrenar (hueco #identidad), en Chromium headless.

Se elige la inicial, uno de los 7 avatares de data/avatares.json o «Tu foto» (solo si hay foto). La foto llega
por «Hacer una foto» (capture="user", solo con pantalla táctil) o por «Elegir de la galería» (con ratón y sin
táctil, «Subir una foto…»; con táctil, test_identidad_tactil.py); los dos la recortan a 256 × 256 (foto.js) y
la eligen; «Quitar foto» la borra (si era la elegida, vuelve la inicial); elegir otro avatar no la borra. Los rechazos salen en un mensaje con aria-live, nunca en alert().
El avatar es un cuadrado redondeado (--radio-avatar) sin recortar en Ajustes, en la cabecera de Entrenar y en Perfil.
Las imágenes de prueba se dibujan en la propia página: nunca fotos de personas. Sin Playwright se salta en
local; en CI falla.
"""
import base64
import importlib.util
import json
import os
from pathlib import Path

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir
from tests.sin_intro import preparar
from tests.menu_quieto import esperar_menu_quieto

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

SEMBRAR = """<!doctype html><meta charset="utf-8">
<script>localStorage.clear(); window.listo = true;</script>"""

# Un PNG de ancho × alto con un degradado, dibujado en la página (base64 sin cabecera).
DEGRADADO = """([ancho, alto]) => {
  const c = document.createElement('canvas');
  c.width = ancho; c.height = alto;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, ancho, alto);
  g.addColorStop(0, '#c0392b'); g.addColorStop(1, '#2980b9');
  x.fillStyle = g; x.fillRect(0, 0, ancho, alto);
  return c.toDataURL('image/png').split(',')[1];
}"""
# Ancho y alto de la foto guardada, ya decodificada.
TAMANO_FOTO = """async () => {
  const { foto } = JSON.parse(localStorage.getItem('boxeo')).perfil.identidad;
  const img = new Image(); img.src = foto; await img.decode();
  return [img.naturalWidth, img.naturalHeight, foto.length, foto.slice(0, 23)];
}"""
AVATARES = json.loads((Path(__file__).parent.parent / "data" / "avatares.json").read_text(encoding="utf-8"))["avatares"]


@pytest.fixture(scope="module")
def pagina(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de identidad necesitan Playwright (pip install -r requirements.txt)"
    sitio = construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)
    with abrir(sitio, SEMBRAR, 390, 844, barras=True) as (pagina, errores):
        preparar(pagina)
        dialogos = []
        pagina.on("dialog", lambda d: (dialogos.append(d.message), d.dismiss()))
        pagina.dialogos = dialogos
        yield pagina
        assert not errores
        assert dialogos == [], "nada de alert() ni confirm()"


def _abrir_ajustes(pagina):
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/ajustes")
    pagina.wait_for_selector("#identidad #nombre", state="visible")
    esperar_menu_quieto(pagina)
    return pagina


@pytest.fixture
def ajustes(pagina):
    """El menú abierto en Ajustes, con el almacén vacío (pasa antes por la página que lo borra)."""
    return _abrir_ajustes(pagina)


def _identidad(pagina):
    return pagina.evaluate("() => JSON.parse(localStorage.getItem('boxeo'))?.perfil.identidad ?? null")


def _png(pagina, ancho=800, alto=600):
    return base64.b64decode(pagina.evaluate(DEGRADADO, [ancho, alto]))


def _subir(pagina, nombre, tipo, datos, entrada="subir-foto", guardar=True):
    """Elige el fichero y, si `guardar`, acepta el recorte tal como sale (zoom 1×, centrado)."""
    pagina.locator(f"#{entrada}").set_input_files({"name": nombre, "mimeType": tipo, "buffer": datos})
    if guardar:
        pagina.wait_for_selector("#d-recorte[open]")
        pagina.locator("#d-recorte").get_by_role("button", name="Guardar").click()


def _opciones(pagina):
    return [i.get_attribute("value") for i in pagina.locator('#identidad input[name="avatar"]').all()]


def test_el_hueco_tiene_nombre_inicial_los_7_avatares_y_subir_foto_sin_foto_que_quitar(ajustes):
    pagina = ajustes
    identidad = pagina.locator("#identidad")
    assert identidad.is_visible()
    assert pagina.get_by_label("Nombre", exact=True).get_attribute("maxlength") == "30"
    assert identidad.locator("fieldset legend").inner_text() == "Avatar"
    assert _opciones(pagina) == ["inicial"] + [f"predefinido:{a['id']}" for a in AVATARES]
    assert pagina.locator('#identidad input[value="inicial"]').is_checked()
    # Cada radio tiene nombre accesible: «Inicial» y el alt de cada avatar.
    assert pagina.get_by_role("radio", name="Inicial").count() == 1
    for a in AVATARES:
        assert pagina.get_by_role("radio", name=a["alt"]).count() == 1, a["id"]
    # Con ratón y sin táctil (el Chromium de las pruebas), un solo botón: «Subir una foto…».
    assert pagina.get_by_role("button", name="Subir una foto…").is_visible()
    assert not pagina.locator("#boton-camara").is_visible()
    assert pagina.get_by_role("button", name="Hacer una foto").count() == 0
    assert pagina.get_by_role("button", name="Elegir de la galería").count() == 0
    assert pagina.locator("#quitar-foto").count() == 0
    assert pagina.locator("#mensaje-foto").get_attribute("aria-live") == "polite"


def test_los_dos_inputs_ocultos_con_sus_atributos(ajustes):
    pagina = ajustes
    camara, galeria = pagina.locator("#hacer-foto"), pagina.locator("#subir-foto")
    for entrada in (camara, galeria):
        assert entrada.get_attribute("type") == "file"
        assert entrada.get_attribute("accept") == "image/*"
        assert entrada.get_attribute("hidden") is not None
        assert entrada.get_attribute("multiple") is None
    assert camara.get_attribute("capture") == "user"
    assert galeria.get_attribute("capture") is None
    # Cada botón (de verdad) dice qué input abre y lleva el mensaje de la foto como descripción.
    for boton, entrada in (("#boton-camara", "hacer-foto"), ("#boton-galeria", "subir-foto")):
        assert pagina.locator(boton).evaluate("(b) => b.tagName + ':' + b.type") == "BUTTON:button"
        assert pagina.locator(boton).get_attribute("aria-controls") == entrada
        assert pagina.locator(boton).get_attribute("aria-describedby") == "mensaje-foto"
    # «Subir una foto…» abre el selector de la galería.
    with pagina.expect_file_chooser() as elegir:
        pagina.get_by_role("button", name="Subir una foto…").click()
    assert elegir.value.element.get_attribute("id") == "subir-foto"


def test_elegir_un_predefinido_lo_guarda_y_sigue_al_volver(ajustes):
    pagina = ajustes
    a = AVATARES[2]
    pagina.get_by_role("radio", name=a["alt"]).check()
    assert _identidad(pagina) == {"nombre": "", "avatar": {"tipo": "predefinido", "id": a["id"]}, "foto": None}
    pagina.reload()
    pagina.wait_for_selector("#identidad #nombre", state="visible")
    assert pagina.locator(f'#identidad input[value="predefinido:{a["id"]}"]').is_checked()


def test_el_nombre_se_recorta_a_30_y_vacio_vale(ajustes):
    pagina = ajustes
    campo = pagina.locator("#nombre")
    # Pegado de golpe: 45 caracteres se quedan en 30, y sin los espacios de los extremos.
    campo.fill("Alexandra" * 5)
    campo.dispatch_event("change")
    assert _identidad(pagina)["nombre"] == ("Alexandra" * 5)[:30]
    assert campo.input_value() == ("Alexandra" * 5)[:30]
    campo.fill("  Alex  ")
    campo.dispatch_event("change")
    assert _identidad(pagina)["nombre"] == "Alex"
    assert campo.input_value() == "Alex"
    # Aunque el campo dejara pasar más (maxlength quitado), se guardan 30.
    campo.evaluate("(el) => el.removeAttribute('maxlength')")
    campo.fill("C" * 40)
    campo.dispatch_event("change")
    assert _identidad(pagina)["nombre"] == "C" * 30
    assert campo.input_value() == "C" * 30
    # Tecleado, maxlength corta en 30.
    campo.fill("")
    campo.press_sequentially("B" * 40)
    campo.press("Tab")
    assert _identidad(pagina)["nombre"] == "B" * 30
    # La inicial de la opción sigue al nombre.
    assert pagina.locator(".avatar-opcion .avatar-inicial").inner_text() == "B"
    # Vacío vale: sin nombre, «Tu perfil» de marcador y la silueta en vez de inicial.
    campo.fill("   ")
    campo.dispatch_event("change")
    assert _identidad(pagina)["nombre"] == ""
    assert campo.input_value() == ""
    assert campo.get_attribute("placeholder") == "Tu perfil"
    assert pagina.locator(".avatar-opcion .avatar-inicial svg").count() == 1


def test_subir_una_foto_la_recorta_a_256_y_la_elige(ajustes):
    pagina = ajustes
    _subir(pagina, "degradado.png", "image/png", _png(pagina))
    pagina.wait_for_selector('#identidad input[value="foto"]')
    ancho, alto, largo, cabecera = pagina.evaluate(TAMANO_FOTO)
    assert (ancho, alto) == (256, 256)
    assert cabecera == "data:image/jpeg;base64,"
    assert largo < 60_000 * 4 / 3
    identidad = _identidad(pagina)
    assert identidad["avatar"] == {"tipo": "foto"}
    assert pagina.locator('#identidad input[value="foto"]').is_checked()
    assert pagina.get_by_role("radio", name="Tu foto").count() == 1
    assert pagina.locator("#mensaje-foto").inner_text() == "Foto guardada. Ya es tu avatar."
    assert pagina.evaluate("document.activeElement.value") == "foto"
    # La foto se pinta con src (un data URL), nunca metida en el HTML a mano.
    assert pagina.locator(".avatar-opcion img[src^='data:image/jpeg']").count() == 1


# Un PNG de 800 × 400: mitad izquierda roja y derecha azul (base64 sin cabecera).
MITADES = """() => {
  const c = document.createElement('canvas'); c.width = 800; c.height = 400;
  const x = c.getContext('2d');
  x.fillStyle = '#ff0000'; x.fillRect(0, 0, 400, 400); x.fillStyle = '#0000ff'; x.fillRect(400, 0, 400, 400);
  return c.toDataURL('image/png').split(',')[1];
}"""
# El color del centro de la foto guardada.
CENTRO_FOTO = """async () => {
  const { foto } = JSON.parse(localStorage.getItem('boxeo')).perfil.identidad;
  const img = new Image(); img.src = foto; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  return [...x.getImageData(128, 128, 1, 1).data.slice(0, 3)];
}"""


def test_el_recorte_se_mueve_y_acerca_con_el_teclado_y_guarda_ese_cuadrado_a_256(ajustes):
    pagina = ajustes
    pagina.locator("#subir-foto").set_input_files(
        {"name": "mitades.png", "mimeType": "image/png", "buffer": base64.b64decode(pagina.evaluate(MITADES))})
    recorte = pagina.locator("#d-recorte")
    recorte.wait_for()
    vista = recorte.locator(".recorte-vista")
    assert pagina.evaluate("document.activeElement.classList.contains('recorte-vista')")  # el foco, en el encuadre
    assert recorte.get_by_role("slider", name="Zoom").input_value() == "1"
    for _ in range(10):
        vista.press("+")
    assert float(recorte.get_by_role("slider", name="Zoom").input_value()) == pytest.approx(2)
    recorte.get_by_role("button", name="Acercar").click()
    for _ in range(40):
        vista.press("ArrowRight")  # la foto a la derecha: se ve su mitad izquierda (roja)
    recorte.get_by_role("button", name="Guardar").click()
    pagina.wait_for_selector('#identidad input[value="foto"]')
    ancho, alto, _, cabecera = pagina.evaluate(TAMANO_FOTO)
    assert (ancho, alto, cabecera) == (256, 256, "data:image/jpeg;base64,")
    r, g, b = pagina.evaluate(CENTRO_FOTO)
    assert r > 200 and b < 60, (r, g, b)
    assert pagina.locator("#mensaje-foto").inner_text() == "Foto guardada. Ya es tu avatar."


def test_cancelar_el_recorte_no_cambia_nada(ajustes):
    pagina = ajustes
    antes = _identidad(pagina)
    pagina.locator("#subir-foto").set_input_files({"name": "d.png", "mimeType": "image/png", "buffer": _png(pagina)})
    recorte = pagina.locator("#d-recorte")
    recorte.wait_for()
    recorte.get_by_role("button", name="Cancelar").click()
    assert not pagina.locator("#d-recorte[open]").count()
    assert _identidad(pagina) == antes
    assert pagina.locator('#identidad input[value="foto"]').count() == 0
    assert pagina.locator("#mensaje-foto").inner_text() == "Foto sin cambiar."
    # Esc también cancela.
    pagina.locator("#subir-foto").set_input_files({"name": "d.png", "mimeType": "image/png", "buffer": _png(pagina)})
    recorte.wait_for()
    pagina.keyboard.press("Escape")
    assert not pagina.locator("#d-recorte[open]").count()
    assert _identidad(pagina) == antes
    assert pagina.locator("#menu[open]").count() == 1  # el menú sigue abierto debajo


def test_elegir_otro_avatar_no_borra_la_foto_y_quitarla_la_borra(ajustes):
    pagina = ajustes
    _subir(pagina, "degradado.png", "image/png", _png(pagina))
    pagina.wait_for_selector("#quitar-foto")
    foto = _identidad(pagina)["foto"]
    pagina.get_by_role("radio", name=AVATARES[0]["alt"]).check()
    assert _identidad(pagina) == {"nombre": "", "avatar": {"tipo": "predefinido", "id": AVATARES[0]["id"]}, "foto": foto}
    assert _opciones(pagina)[-1] == "foto"
    # Quitar la foto sin ser la elegida: el avatar se queda.
    pagina.locator("#quitar-foto").click()
    assert _identidad(pagina) == {"nombre": "", "avatar": {"tipo": "predefinido", "id": AVATARES[0]["id"]}, "foto": None}
    assert "foto" not in _opciones(pagina)
    assert pagina.locator("#quitar-foto").count() == 0
    assert pagina.locator("#mensaje-foto").inner_text() == "Foto quitada."
    assert pagina.evaluate("document.activeElement.id") == "boton-galeria"


def test_quitar_la_foto_elegida_vuelve_a_la_inicial(ajustes):
    pagina = ajustes
    _subir(pagina, "degradado.png", "image/png", _png(pagina))
    pagina.wait_for_selector("#quitar-foto")
    pagina.locator("#quitar-foto").click()
    assert _identidad(pagina) == {"nombre": "", "avatar": {"tipo": "inicial"}, "foto": None}
    assert pagina.locator('#identidad input[value="inicial"]').is_checked()


# La forma del avatar y si la imagen llena la caja: el radio (las cuatro esquinas), las proporciones de la
# imagen y de la caja (iguales: con object-fit cover no se recorta nada) y el tamaño de la caja.
FORMA = """(el) => {
  const s = getComputedStyle(el);
  return {
    radios: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius],
    ajuste: s.objectFit,
    proporcion: el.naturalWidth ? [el.naturalWidth / el.naturalHeight, el.clientWidth / el.clientHeight] : null,
    llena: el.naturalWidth ? el.complete && el.clientWidth > 0 : null,
  };
}"""


def _radio_avatar(pagina):
    return pagina.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--radio-avatar').trim()")


def test_el_avatar_es_un_cuadrado_redondeado_sin_recortar_en_ajustes_entrenar_y_perfil(ajustes):
    pagina = ajustes
    radio = _radio_avatar(pagina)
    assert radio == "28%"
    a = AVATARES[4]
    pagina.get_by_role("radio", name=a["alt"]).check()
    elegido = pagina.locator(f'#identidad input[value="predefinido:{a["id"]}"] + .avatar')
    # Ajustes: la opción elegida, la caja del radio (de la que cuelga el foco) y la inicial.
    vistas = {"ajustes": elegido.evaluate(FORMA),
              "ajustes-opcion": pagina.locator(".avatar-opcion").first.evaluate(FORMA),
              "ajustes-inicial": pagina.locator(".avatar-opcion .avatar-inicial").evaluate(FORMA)}
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#ir-perfil img.avatar", state="visible")
    vistas["entrenar"] = pagina.locator("#ir-perfil img.avatar").evaluate(FORMA)
    pagina.goto(f"{ORIGEN}/index.html#perfil")
    pagina.wait_for_selector("#perfil-avatar img.avatar", state="visible")
    vistas["perfil"] = pagina.locator("#perfil-avatar img.avatar").evaluate(FORMA)
    for vista, forma in vistas.items():
        assert forma["radios"] == [radio] * 4, vista
        if forma["proporcion"] is not None:
            assert forma["ajuste"] == "cover" and forma["llena"], vista
            assert forma["proporcion"][0] == pytest.approx(forma["proporcion"][1]), vista


# Los datos se fabrican en la prueba, con ids cortos: el id del caso va a una variable de entorno.
RECHAZOS = {
    "no-imagen": ("notas.txt", "text/plain", lambda: b"hola", "Eso no es una imagen"),
    "heic": ("foto.heic", "image/heic", lambda: b"\x00\x00\x00\x18ftypheic" + b"\x00" * 64,
             "No se puede leer esta imagen (puede ser HEIC)"),
    "mas-de-20-mb": ("enorme.jpg", "image/jpeg", lambda: b"\xff" * (20 * 1024 * 1024 + 1), "pesa más de 20 MB"),
}


@pytest.mark.parametrize("caso", RECHAZOS)
def test_un_rechazo_sale_en_el_mensaje_sin_alert_y_no_cambia_nada(ajustes, caso):
    pagina = ajustes
    nombre, tipo, datos, texto = RECHAZOS[caso]
    antes = _identidad(pagina)
    _subir(pagina, nombre, tipo, datos(), guardar=False)
    assert not pagina.locator("#d-recorte[open]").count()  # un rechazo no llega al recorte
    mensaje = pagina.locator("#mensaje-foto.aviso")
    mensaje.wait_for()
    assert texto in mensaje.inner_text()
    assert mensaje.get_attribute("aria-live") == "polite"
    assert _identidad(pagina) == antes
    assert pagina.dialogos == []


REJILLA = """() => {
  const cajas = [...document.querySelectorAll('#identidad .avatares-fila .avatar-opcion')].map((e) => e.getBoundingClientRect());
  const filas = [...new Set(cajas.map((c) => Math.round(c.top)))];
  const visibles = (s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length)
    .map((e) => e.getBoundingClientRect());
  const foto = visibles('#identidad :is(.foto-actual, .fila-foto) > *');
  const botones = visibles('#identidad .fila-foto > .boton');
  const avatares = document.querySelector('#identidad .avatares-fila').getBoundingClientRect();
  return { n: cajas.length, filas: filas.length, porFila: cajas.filter((c) => Math.round(c.top) === filas[0]).length,
    mayor: Math.max(...cajas.map((c) => c.width)), cuadrados: cajas.every((c) => Math.abs(c.width - c.height) < 1),
    fotoDebajo: foto.every((c) => c.top >= avatares.bottom), botonesEnFila: new Set(botones.map((c) => Math.round(c.top))).size,
    fotoAcompanada: foto.length > 0 && new Set(foto.map((c) => Math.round(c.top + c.height / 2))).size < foto.length };
}"""


@pytest.mark.parametrize("ancho", [390, 1440])
def test_los_avatares_van_en_4_columnas_sin_crecer_y_la_foto_en_una_fila_debajo(ajustes, ancho):
    pagina = ajustes
    pagina.set_viewport_size({"width": ancho, "height": 900})
    _subir(pagina, "degradado.png", "image/png", _png(pagina))  # con foto: «Tu foto» y «Quitar foto»
    pagina.wait_for_selector('#identidad input[value="foto"]')
    esperar_menu_quieto(pagina)
    r = pagina.evaluate(REJILLA)
    assert (r["n"], r["filas"], r["porFila"]) == (8, 2, 4), r
    assert r["mayor"] <= 80 and r["cuadrados"], r
    assert r["fotoDebajo"] and r["botonesEnFila"] == 1, r  # los botones de la foto, en una fila
    assert r["fotoAcompanada"], r  # «Tu foto» comparte fila con «Quitar foto»: no va suelta
    pagina.set_viewport_size({"width": 390, "height": 844})
