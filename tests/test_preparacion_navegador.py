"""La preparación de 10 s antes del asalto 1 (V2), en Chromium headless con el reloj de Playwright: sin texto en
pantalla (las frases van solo por voz, a su hora y sin pisarse; una barra dice cuánto falta), «Empezar ya» (corta la
voz), Pausa y Parar (sin guardar nada) y el fondo del ring (el vídeo de su orientación; la imagen con movimiento
reducido o si falla). Los datos de prueba solo viven en el localStorage de este Chromium. Sin Playwright se salta en local.
"""
import importlib.util
import json
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir
from tests.sin_intro import preparar as sin_intro

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
# Una voz que no suena y acaba a los 400 ms (o a los `window.duracionVoz` ms); el dictado espera a que termine cada
# frase. Apunta en window.registroVoz qué se dice, cuándo (ms del reloj de Playwright) y a qué velocidad, qué frase se
# corta (cancel() con algo sonando) y si alguna empieza con otra sonando (solapes).
VOZ_FALSA = """(() => {
  const registro = { dichas: [], cortadas: [], solapes: 0 };
  let actual = null;
  let reloj = null;
  const acabar = (frase, evento) => {
    clearTimeout(reloj);
    if (actual !== frase) return;
    actual = null;
    falsa.speaking = false;
    frase[evento]?.({});
  };
  const falsa = {
    speaking: false, pending: false, onvoiceschanged: null,
    getVoices: () => [], addEventListener() {}, removeEventListener() {},
    cancel() { if (actual) { registro.cortadas.push(actual.text); acabar(actual, "onerror"); } },
    speak(frase) {
      if (actual) registro.solapes++;
      registro.dichas.push({ texto: frase.text, t: Date.now(), velocidad: frase.rate });
      actual = frase;
      falsa.speaking = true;
      reloj = setTimeout(() => acabar(frase, "onend"), window.duracionVoz ?? 400);
    },
  };
  window.registroVoz = registro;
  Object.defineProperty(window, "speechSynthesis", { value: falsa, configurable: true });
})();"""
FRASES = ["Ponte los guantes", "Ve preparándote", "Sube la guardia"]
@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Estas pruebas necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


def abrir_app(sitio, movimiento=True, ancho=390, alto=844, reaccion=False, velocidad="normal"):
    """Contexto con la app abierta en Entrenar (una Personalizada de 2 × 30 s), con el reloj parado."""
    contexto = abrir(sitio, VACIA, ancho, alto, barras=ancho > 800)
    pagina, errores = contexto.__enter__()
    sin_intro(pagina)
    pagina.add_init_script(VOZ_FALSA)
    pagina.emulate_media(reduced_motion="no-preference" if movimiento else "reduce")
    pagina.clock.install()
    pagina.goto(f"{ORIGEN}/__pagina__.html")
    pagina.wait_for_function("window.listo === true")
    datos = {"version": 9, "perfil": {"sesion": {"tipo": "personalizada",
                                                "reaccion": reaccion,
                                                "personalizada": {"asaltos": 2, "duracion_asalto": 30, "descanso": 10}},
                                      "voz": {"velocidad": velocidad}, "pistas": {"asa": True}}}
    pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(datos))
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
    return contexto, pagina, errores


@pytest.fixture
def app(sitio):
    contexto, pagina, errores = abrir_app(sitio)
    parar_reloj(pagina)  # la barra y las fases, al décimo: el reloj solo avanza con run_for
    yield pagina
    assert not errores
    contexto.__exit__(None, None, None)


def fase(pagina):
    return pagina.evaluate("document.getElementById('pantalla').dataset.fase")


def barra(pagina):
    """Lo lleno de la barra de la preparación, de 0 a 1."""
    return pagina.evaluate("""() => { const b = document.querySelector('#barra-preparacion');
      return b.firstElementChild.getBoundingClientRect().width / b.getBoundingClientRect().width; }""")


def registro(pagina):
    return pagina.evaluate("window.registroVoz")


def parar_reloj(pagina):
    """Para el reloj de Playwright: desde aquí solo avanza con run_for, tarde lo que tarde el equipo."""
    pagina.clock.pause_at(pagina.evaluate("Date.now()") + 1000)


def empezar_y_marcar(pagina):
    """Pulsa Empezar y devuelve el instante (ms del reloj de Playwright) en el que empieza la preparación."""
    inicio = pagina.evaluate("Date.now()")
    pagina.click("#empezar")
    return inicio


def sesiones(pagina):
    return json.loads(pagina.evaluate("localStorage.getItem('boxeo')")).get("sesiones", [])


def test_al_empezar_sale_la_preparacion_de_10_s_y_luego_el_asalto_1(app):
    app.click("#empezar")
    assert fase(app) == "preparacion" and barra(app) < 0.02
    assert app.is_visible("#preparacion") and app.is_visible("#empezar-ya") and app.is_visible(".fondo-ring img")
    assert app.is_visible("#barra-preparacion")
    assert app.is_hidden("#tiempo") and app.is_hidden(".tarjeta-combo")
    assert app.text_content("#fase") == "Prepárate"  # la pastilla de arriba se queda
    app.clock.run_for(5000)
    assert 0.48 <= barra(app) <= 0.52
    app.clock.run_for(4800)
    assert fase(app) == "preparacion" and barra(app) >= 0.97
    app.clock.run_for(300)
    assert fase(app) == "asalto"
    assert app.is_hidden("#preparacion") and app.is_hidden(".fondo-ring")  # el ring nítido se va: queda el borroso
    assert app.inner_text("#tiempo") in ("0:30", "0:29")


def test_empezar_ya_salta_al_asalto_1_al_momento(app):
    app.click("#empezar")
    app.clock.run_for(2000)
    app.click("#empezar-ya")
    assert fase(app) == "asalto" and app.is_hidden("#preparacion")
    assert app.inner_text("#tiempo") == "0:30"
    app.clock.run_for(10_100)
    assert app.inner_text("#tiempo") == "0:20"  # el asalto no espera a los 10 s de la preparación


def test_la_pausa_para_la_barra(app):
    app.click("#empezar")
    app.clock.run_for(3000)
    app.click("#pausa")
    assert fase(app) == "pausa" and app.is_visible("#preparacion")
    app.clock.run_for(20_000)
    assert 0.29 <= barra(app) <= 0.31
    app.click("#pausa")
    assert 0.29 <= barra(app) <= 0.31  # sigue donde se quedó
    app.clock.run_for(6500)
    assert fase(app) == "preparacion"
    app.clock.run_for(1500)  # el tic es cada 100 ms: margen de sobra
    assert fase(app) == "asalto"


def test_parar_en_la_preparacion_no_guarda_nada_en_el_historial(app):
    app.click("#empezar")
    app.clock.run_for(5000)
    app.click("#parar")
    assert app.is_hidden("#pantalla")
    assert not app.evaluate("document.body.classList.contains('entrenando')")
    app.clock.run_for(15_000)  # la preparación no sigue por detrás
    assert sesiones(app) == []
    assert app.is_hidden("#postsesion")


# El texto que se ve dentro de la preparación (sin lo oculto para el lector de pantalla).
TEXTO_PREPARACION = """() => [...document.querySelectorAll('#preparacion *')].filter((e) =>
  e.checkVisibility() && !e.closest('.solo-lectores') && [...e.childNodes].some((n) =>
    n.nodeType === 3 && n.textContent.trim())).map((e) => e.textContent.trim())"""


# El texto que se ve en toda la pantalla de la sesión: nodos de texto visibles que ocupan más de 1 × 1 px.
TEXTO_EN_PANTALLA = """() => { const textos = [];
  const recorrido = document.createTreeWalker(document.getElementById('pantalla'), NodeFilter.SHOW_TEXT);
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    if (!n.textContent.trim() || !n.parentElement.checkVisibility({ visibilityProperty: true })) continue;
    const rango = document.createRange();
    rango.selectNodeContents(n);
    const r = rango.getBoundingClientRect();
    const recorte = n.parentElement.closest('.solo-lectores, #asalto, .atajos');
    const visible = !recorte || recorte.getBoundingClientRect().width > 1;
    if (r.width > 1 && r.height > 1 && visible) textos.push(n.textContent.trim());
  }
  return textos; }"""


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_en_la_preparacion_no_hay_texto_en_pantalla_salvo_empezar_ya(sitio, ancho, alto):
    contexto, pagina, errores = abrir_app(sitio, ancho=ancho, alto=alto)
    try:
        pagina.click("#empezar")
        assert pagina.locator("#cuenta-atras").count() == 0
        assert pagina.evaluate(TEXTO_PREPARACION) == ["Empezar ya"]  # ni número ni «Prepárate»
        # En toda la pantalla, solo la pastilla y los tres botones (lo de .solo-lectores mide 1 px).
        assert sorted(pagina.evaluate(TEXTO_EN_PANTALLA)) == ["Empezar ya", "Parar", "Pausa", "Prepárate"]
        assert not pagina.is_visible(".progreso") and pagina.is_visible("#barra-preparacion")
        # «Asalto 1/2» y el teclado siguen para el lector de pantalla, y la pastilla, a la derecha.
        assert pagina.locator("#asalto").get_attribute("aria-hidden") is None
        assert pagina.text_content("#asalto") == "Asalto 1/2" and "Teclado" in pagina.text_content(".atajos")
        fase_caja, pantalla_caja = pagina.locator("#fase").bounding_box(), pagina.locator("#pantalla").bounding_box()
        assert fase_caja["x"] + fase_caja["width"] > pantalla_caja["x"] + pantalla_caja["width"] * 0.7
        # Para el lector de pantalla sí se anuncia como preparación.
        assert "Preparación" in pagina.text_content("#preparacion .solo-lectores")
        pagina.clock.run_for(200)
        assert pagina.text_content("#estado").startswith("Preparación")
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


def test_las_frases_de_la_preparacion_van_por_voz_a_su_hora_y_no_salen_en_pantalla(sitio):
    contexto, pagina, errores = abrir_app(sitio, velocidad="lenta")
    parar_reloj(pagina)
    try:
        inicio = empezar_y_marcar(pagina)
        for _ in range(115):  # hasta 11,5 s: las tres frases y el anuncio del asalto 1
            texto = pagina.evaluate("document.body.innerText").lower()
            assert not any(f.lower() in texto for f in FRASES)
            pagina.clock.run_for(100)
        r = registro(pagina)
        dichas = [(d["texto"], (d["t"] - inicio) / 1000, d["velocidad"]) for d in r["dichas"]]
        assert [d[0] for d in dichas[:3]] == FRASES
        for (_, segundo, _), esperado in zip(dichas, [0, 4, 7, 11.2]):
            assert esperado <= segundo <= esperado + 0.25, dichas
        assert len(dichas) == 4 and dichas[3][0] not in FRASES  # a los 10 s, el anuncio de siempre (tras la campana)
        assert all(abs(d[2] - 0.9) < 1e-6 for d in dichas)  # a la velocidad de Ajustes («lenta»), igual que el anuncio
        assert r["solapes"] == 0 and r["cortadas"] == []
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


def test_con_una_voz_lenta_ninguna_frase_pisa_a_la_siguiente_ni_al_asalto(sitio):
    contexto, pagina, errores = abrir_app(sitio)
    parar_reloj(pagina)
    try:
        pagina.evaluate("window.duracionVoz = 4500")
        inicio = empezar_y_marcar(pagina)
        for _ in range(130):
            pagina.clock.run_for(100)
        r = registro(pagina)
        dichas = [(d["texto"], (d["t"] - inicio) / 1000) for d in r["dichas"]]
        # La segunda espera a que acabe la primera (4,5 s); la tercera ya no cabe antes de los 10 s y no se dice.
        assert [d[0] for d in dichas[:2]] == FRASES[:2] and FRASES[2] not in [d[0] for d in dichas]
        assert dichas[0][1] <= 0.25 and 4.5 <= dichas[1][1] <= 4.8, dichas
        assert dichas[2][1] >= 10, dichas  # el anuncio del asalto, con todo ya callado
        assert r["solapes"] == 0 and r["cortadas"] == []
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


def test_empezar_ya_corta_la_voz_y_salta_al_asalto(sitio):
    contexto, pagina, errores = abrir_app(sitio)
    parar_reloj(pagina)
    try:
        pagina.evaluate("window.duracionVoz = 3000")
        pagina.click("#empezar")
        pagina.clock.run_for(1000)
        pagina.click("#empezar-ya")
        assert fase(pagina) == "asalto" and registro(pagina)["cortadas"] == ["Ponte los guantes"]
        pagina.clock.run_for(12_000)
        dichas = [d["texto"] for d in registro(pagina)["dichas"]]
        assert dichas[0] == "Ponte los guantes" and not set(FRASES[1:]) & set(dichas)
        assert registro(pagina)["solapes"] == 0 and not errores
    finally:
        contexto.__exit__(None, None, None)


def test_la_pausa_calla_las_frases_y_al_reanudar_siguen_a_su_hora(sitio):
    contexto, pagina, errores = abrir_app(sitio)
    parar_reloj(pagina)
    try:
        pagina.evaluate("window.duracionVoz = 3000")
        pagina.click("#empezar")
        pagina.clock.run_for(1000)
        pagina.click("#pausa")
        assert registro(pagina)["cortadas"] == ["Ponte los guantes"]
        pagina.clock.run_for(20_000)
        assert len(registro(pagina)["dichas"]) == 1  # en pausa no se dice nada
        pagina.click("#pausa")
        pagina.clock.run_for(3200)  # hasta pasado el segundo 4 de la preparación
        assert [d["texto"] for d in registro(pagina)["dichas"]] == FRASES[:2]
        assert registro(pagina)["solapes"] == 0 and not errores
    finally:
        contexto.__exit__(None, None, None)


def test_la_preparacion_no_tiene_ajuste_en_el_menu(app):
    app.evaluate("location.hash = '#entrenar/menu/personalizar'")
    app.wait_for_selector("#t-menu", state="visible")
    assert "prepara" not in app.inner_text("#menu").lower()


ESTADO_VIDEO = """() => { const v = document.getElementById('video-ring');
  return { bucle: v.loop, parado: v.paused, falta: v.duration - v.currentTime, fuente: v.currentSrc, ancho: v.videoWidth }; }"""


def test_en_horizontal_el_video_sale_una_vez_y_se_queda_en_el_ultimo_fotograma(sitio):
    contexto, pagina, errores = abrir_app(sitio, ancho=1440, alto=900)
    try:
        pagina.click("#empezar")
        assert pagina.is_visible("#video-ring")
        pagina.wait_for_function("document.getElementById('video-ring').ended", timeout=20_000)
        estado = pagina.evaluate(ESTADO_VIDEO)
        assert not estado["bucle"] and estado["parado"] and estado["falta"] < 0.05
        # El Chromium de Playwright no trae H.264: coge el WebM, que va primero.
        assert estado["fuente"].endswith("video/ring-horizontal.webm") and estado["ancho"] == 1280
        assert pagina.is_visible("#video-ring") and fase(pagina) == "preparacion"  # sigue ahí, quieto
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_con_movimiento_reducido_solo_se_ve_la_imagen_y_no_se_pide_el_video(sitio, ancho, alto):
    contexto, pagina, errores = abrir_app(sitio, movimiento=False, ancho=ancho, alto=alto)
    try:
        pedidos = []
        pagina.on("request", lambda r: "/video/" in r.url and pedidos.append(r.url))
        pagina.click("#empezar")
        assert pagina.locator("#video-ring").count() == 0
        assert pagina.is_visible(".fondo-ring img") and fase(pagina) == "preparacion"
        pagina.clock.run_for(10_100)
        assert fase(pagina) == "asalto"
        assert pedidos == [] and not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("fallo", ["sin_red", "404"])
def test_si_el_video_no_llega_se_ve_la_imagen_y_la_preparacion_sigue(sitio, fallo):
    contexto, pagina, errores = abrir_app(sitio, ancho=1440, alto=900)
    try:
        # sw.js no guarda el vídeo: sin red, la petición falla tal cual (aquí, cortada o 404).
        pagina.route("**/video/**", lambda r: r.abort("internetdisconnected") if fallo == "sin_red"
                     else r.fulfill(status=404))
        pagina.click("#empezar")
        pagina.wait_for_function("!document.getElementById('video-ring')")  # quitado: se ve lo de debajo
        assert pagina.is_visible(".fondo-ring img") and fase(pagina) == "preparacion"
        pagina.clock.run_for(10_100)
        assert fase(pagina) == "asalto" and not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("ancho,alto,pedido,otro,medidas", [
    (390, 844, "ring-vertical", "ring-horizontal", (720, 1254)),
    (1440, 900, "ring-horizontal", "ring-vertical", (1280, 720)),
])
def test_cada_orientacion_pide_solo_su_video(sitio, ancho, alto, pedido, otro, medidas):
    contexto, pagina, errores = abrir_app(sitio, ancho=ancho, alto=alto)
    try:
        pedidos = []
        pagina.on("request", lambda r: "/video/" in r.url and pedidos.append(r.url))
        pagina.click("#empezar")
        assert pagina.is_visible("#video-ring")
        pagina.wait_for_function("document.getElementById('video-ring').ended", timeout=20_000)
        estado = pagina.evaluate(ESTADO_VIDEO)
        assert not estado["bucle"] and estado["parado"] and estado["falta"] < 0.05  # quieto en el último fotograma
        assert estado["fuente"].endswith(f"video/{pedido}.webm")
        assert (estado["ancho"], pagina.evaluate("document.getElementById('video-ring').videoHeight")) == medidas
        assert pedidos and all(pedido in u for u in pedidos) and not any(otro in u for u in pedidos)
        assert pagina.get_attribute("#video-ring", "poster") == "imagenes/ring-cenital.jpg"
        assert pagina.is_visible("#video-ring") and fase(pagina) == "preparacion"
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_el_ring_cubre_toda_la_pantalla(sitio, ancho, alto):
    contexto, pagina, errores = abrir_app(sitio, ancho=ancho, alto=alto)
    try:
        pagina.click("#empezar")
        ring, pantalla = pagina.locator(".fondo-ring").bounding_box(), pagina.locator("#pantalla").bounding_box()
        assert (ring["x"], ring["y"], ring["width"], ring["height"]) == (
            pantalla["x"], pantalla["y"], pantalla["width"], pantalla["height"])
        img = pagina.locator(".fondo-ring img").bounding_box()
        assert img["width"] == ring["width"] and img["height"] == ring["height"]
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


ESTILO_PARAR = """() => { const e = getComputedStyle(document.getElementById('parar'));
  return { sombra: e.boxShadow, borde: e.borderColor, fondo: e.backgroundColor, contorno: e.outlineStyle }; }"""


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_en_la_preparacion_el_foco_va_a_empezar_ya_y_parar_se_ve_como_en_el_asalto(sitio, ancho, alto):
    contexto, pagina, errores = abrir_app(sitio, ancho=ancho, alto=alto)
    try:
        pagina.focus("#empezar")
        pagina.keyboard.press("Enter")  # con el teclado: el foco se ve (focus-visible)
        assert pagina.evaluate("document.activeElement.id") == "empezar-ya"
        en_preparacion = pagina.evaluate(ESTILO_PARAR)
        assert en_preparacion["sombra"] == "none" and en_preparacion["contorno"] == "none"
        pagina.click("#pausa")
        assert fase(pagina) == "pausa" and pagina.evaluate(ESTILO_PARAR)["sombra"] == "none"  # en pausa, igual
        pagina.click("#pausa")
        pagina.click("#empezar-ya")
        assert fase(pagina) == "asalto"
        en_asalto = pagina.evaluate(ESTILO_PARAR)
        assert {**en_preparacion, "contorno": None} == {**en_asalto, "contorno": None}
        pagina.clock.run_for(21_000)  # a falta de 10 s: el fondo rojo, y Parar se distingue con su borde
        assert fase(pagina) == "final" and "inset" in pagina.evaluate(ESTILO_PARAR)["sombra"]
        assert not errores
    finally:
        contexto.__exit__(None, None, None)


@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_parar_lleva_borde_blanco_solo_en_los_ultimos_10_s_del_asalto(sitio, ancho, alto):
    contexto, pagina, errores = abrir_app(sitio, ancho=ancho, alto=alto, reaccion=True)
    try:
        def con_borde():
            return "inset" in pagina.evaluate(ESTILO_PARAR)["sombra"]
        vistas = {}
        pagina.click("#empezar")
        vistas[fase(pagina)] = con_borde()  # preparación
        pagina.click("#pausa")
        vistas["pausa en la preparación"] = con_borde()
        pagina.click("#pausa")
        pagina.click("#empezar-ya")
        for paso in range(360):  # la sesión entera (30 + 10 + 30 s), de 200 en 200 ms
            if pagina.is_hidden("#pantalla"):
                break
            if paso in (25, 225):  # una pausa en cada asalto
                pagina.click("#pausa")
                vistas.setdefault(fase(pagina), set()).add(con_borde())
                pagina.click("#pausa")
            vistas.setdefault(fase(pagina), set()).add(con_borde())
            pagina.clock.run_for(200)
        # Que salga una reacción en 30 s depende del sorteo: la fase se pone a mano y se lee en el mismo momento.
        vistas.setdefault("reaccion", set()).add(pagina.evaluate("""() => {
          document.getElementById('pantalla').dataset.fase = 'reaccion';
          return getComputedStyle(document.getElementById('parar')).boxShadow.includes('inset'); }"""))
        assert vistas.pop("preparacion") is False and vistas.pop("pausa en la preparación") is False
        assert set(vistas) == {"asalto", "reaccion", "final", "descanso", "pausa"}, vistas
        assert vistas.pop("final") == {True}
        assert all(v == {False} for v in vistas.values()), vistas
        assert not errores
    finally:
        contexto.__exit__(None, None, None)
