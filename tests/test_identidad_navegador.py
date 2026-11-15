"""Nombre y avatar o foto en la sección Ajustes del menú de Entrenar (hueco #identidad), en Chromium headless.

Se elige la inicial, uno de los 7 avatares de data/avatares.json o «Tu foto» (solo si hay foto). «Subir una
foto…» la recorta a 256 × 256 (foto.js) y la elige; «Quitar foto» la borra (si era la elegida, vuelve la
inicial); elegir otro avatar no la borra. Los rechazos salen en un mensaje con aria-live, nunca en alert().
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
        dialogos = []
        pagina.on("dialog", lambda d: (dialogos.append(d.message), d.dismiss()))
        pagina.dialogos = dialogos
        yield pagina
        assert not errores
        assert dialogos == [], "nada de alert() ni confirm()"


@pytest.fixture
def ajustes(pagina):
    """El menú abierto en Ajustes, con el almacén vacío (pasa antes por la página que lo borra)."""
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/ajustes")
    pagina.wait_for_selector("#identidad #nombre", state="visible")
    esperar_menu_quieto(pagina)
    return pagina


def _identidad(pagina):
    return pagina.evaluate("() => JSON.parse(localStorage.getItem('boxeo'))?.perfil.identidad ?? null")


def _png(pagina, ancho=800, alto=600):
    return base64.b64decode(pagina.evaluate(DEGRADADO, [ancho, alto]))


def _subir(pagina, nombre, tipo, datos):
    pagina.locator("#subir-foto").set_input_files({"name": nombre, "mimeType": tipo, "buffer": datos})


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
    assert pagina.locator('#identidad label[for="subir-foto"]').inner_text() == "Subir una foto…"
    assert pagina.locator("#subir-foto").get_attribute("accept") == "image/*"
    assert pagina.locator("#quitar-foto").count() == 0
    assert pagina.locator("#mensaje-foto").get_attribute("aria-live") == "polite"


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
    assert pagina.evaluate("document.activeElement.id") == "subir-foto"


def test_quitar_la_foto_elegida_vuelve_a_la_inicial(ajustes):
    pagina = ajustes
    _subir(pagina, "degradado.png", "image/png", _png(pagina))
    pagina.wait_for_selector("#quitar-foto")
    pagina.locator("#quitar-foto").click()
    assert _identidad(pagina) == {"nombre": "", "avatar": {"tipo": "inicial"}, "foto": None}
    assert pagina.locator('#identidad input[value="inicial"]').is_checked()


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
    _subir(pagina, nombre, tipo, datos())
    mensaje = pagina.locator("#mensaje-foto.aviso")
    mensaje.wait_for()
    assert texto in mensaje.inner_text()
    assert mensaje.get_attribute("aria-live") == "polite"
    assert _identidad(pagina) == antes
    assert pagina.dialogos == []
