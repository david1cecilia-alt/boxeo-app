"""La pantalla de la sesión ocupa la ventana desde arriba, en un navegador de verdad (Chromium headless con
Playwright), a 390×844 y 1440×900, en asalto y en descanso.

Antes, el relleno de arriba de Entrenar seguía puesto durante la sesión: quedaba una franja del fondo encima de
la pantalla de fase (se veía en el descanso, que es verde) y la página se desplazaba ese tanto.

Una Prueba (2 × 30 s) con el reloj de Playwright parado y una semilla fija, para que salga siempre la misma
combinación. Y con combinaciones de 10 acciones (las propias más largas, con «Solo las mías»), Pausa y Parar se ven
enteros sin desplazar y no tapan la última acción, del móvil (360 × 800) al PC (1440 × 900).
Sin Playwright se salta en local; en CI falla.
"""
import importlib.util
import json
import os

import pytest

from herramientas.construir_sitio import construir
from herramientas.fotos_maniqui import ORIGEN, abrir
from tests.sin_intro import preparar

HAY_PLAYWRIGHT = importlib.util.find_spec("playwright") is not None
pytestmark = pytest.mark.skipif(not HAY_PLAYWRIGHT and not os.environ.get("CI"),
                                reason="Playwright no está instalado")

VACIA = """<!doctype html><meta charset="utf-8"><script>localStorage.clear(); window.listo = true;</script>"""
SEMILLA = """const _g = crypto.getRandomValues.bind(crypto);
crypto.getRandomValues = (a) => (a instanceof Uint32Array && a.length === 1 ? (a[0] = 7, a) : _g(a));"""
INICIO = 1_800_000_000_000
# (segundos desde Empezar, fase): la Prueba no tiene preparación; el descanso dura 15 s.
MOMENTOS = [(12, "asalto"), (32, "descanso")]


@pytest.fixture(scope="module")
def sitio(tmp_path_factory):
    assert HAY_PLAYWRIGHT, "Las pruebas de la sesión necesitan Playwright (pip install -r requirements.txt)"
    return construir(tmp_path_factory.mktemp("sitio") / "_site", "prueba", fotos=False)


@pytest.mark.parametrize("segundos,fase", MOMENTOS)
@pytest.mark.parametrize("ancho,alto", [(390, 844), (1440, 900)])
def test_la_pantalla_de_la_sesion_empieza_arriba_y_la_pagina_no_se_desplaza(sitio, ancho, alto, segundos, fase):
    with abrir(sitio, VACIA, ancho, alto, barras=ancho > 800) as (pagina, errores):
        preparar(pagina)
        pagina.add_init_script(SEMILLA)
        pagina.emulate_media(reduced_motion="reduce")
        pagina.clock.install(time=INICIO)
        pagina.clock.pause_at(INICIO)
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        pagina.goto(f"{ORIGEN}/index.html?prueba#entrenar")
        pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
        pagina.click('#tipo-sesion label:has(input[value="prueba"])')
        pagina.click("#empezar")
        pagina.click("#empezar-ya")  # sin los 10 s de preparación
        pagina.clock.run_for(segundos * 1000)
        assert pagina.evaluate("document.getElementById('pantalla').dataset.fase") == fase
        assert pagina.evaluate("document.getElementById('pantalla').getBoundingClientRect().top") == 0
        assert pagina.evaluate("document.documentElement.scrollHeight") <= alto
        # Pausa y Parar, enteros a la vista.
        assert pagina.evaluate("document.querySelector('#pantalla .controles').getBoundingClientRect().bottom") <= alto
        assert not errores


# Tres combinaciones propias de 10 acciones, de nombres largos (golpes al cuerpo, pasos laterales).
DIEZ = ["gancho_der_cuerpo", "uppercut_izq_cuerpo", "directo_cuerpo", "gancho_izq_cuerpo", "uppercut_der_cuerpo",
        "jab_cuerpo", "paso_lateral_izq", "rodar_der", "esquiva_izq", "paso_lateral_der"]
PROPIAS_DIEZ = [{"id": f"p-{i}", "ids": DIEZ[i:] + DIEZ[:i], "creada": "2026-11-01T10:00:00Z"} for i in range(3)]
CON_DIEZ = {"version": 9, "combinacionesPropias": PROPIAS_DIEZ, "perfil": {
    "pistas": {"asa": True},
    "sesion": {"tipo": "personalizada", "mezcla": "solo", "voz": "ambos", "golpes_cuerpo": True,  # las 3 llevan golpes al cuerpo
               "personalizada": {"asaltos": 1, "duracion_asalto": 120, "descanso": 0}}}}
MEDIR_DIEZ = """() => {
  const caja = (e) => e.getBoundingClientRect();
  const lis = [...document.querySelectorAll('#combo .pasos li')];
  const controles = caja(document.querySelector('#pantalla .controles'));
  const tarjeta = document.querySelector('.tarjeta-combo');
  tarjeta.scrollTop = tarjeta.scrollHeight; // si la tarjeta se desplaza por dentro, al final
  return { acciones: lis.length, ultima: caja(lis.at(-1)).bottom, controlesArriba: controles.top,
    controlesAbajo: controles.bottom, pagina: document.documentElement.scrollHeight,
    desplazaTarjeta: tarjeta.scrollHeight > tarjeta.clientHeight + 1 };
}"""


@pytest.mark.parametrize("ancho,alto", [(390, 844), (360, 800), (1024, 768), (1440, 900)])
def test_con_10_acciones_pausa_y_parar_se_ven_sin_desplazar_y_no_tapan_la_ultima(sitio, ancho, alto):
    with abrir(sitio, VACIA, ancho, alto, barras=ancho > 800) as (pagina, errores):
        preparar(pagina)
        pagina.add_init_script(SEMILLA)
        pagina.emulate_media(reduced_motion="reduce")
        pagina.clock.install(time=INICIO)
        pagina.clock.pause_at(INICIO)
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        pagina.evaluate("(d) => localStorage.setItem('boxeo', d)", json.dumps(CON_DIEZ))
        pagina.goto(f"{ORIGEN}/index.html#entrenar")
        pagina.wait_for_selector("#tipo-sesion input:checked", state="attached")
        pagina.click("#empezar")
        pagina.click("#empezar-ya")
        for _ in range(40):
            pagina.clock.run_for(500)
            if pagina.locator("#combo .pasos li").count() == 10:
                break
        pagina.evaluate("document.fonts.ready")
        m = pagina.evaluate(MEDIR_DIEZ)
        assert m["acciones"] == 10, m
        assert m["controlesAbajo"] <= alto and m["pagina"] <= alto, m
        assert m["ultima"] <= m["controlesArriba"], m
        if ancho >= 1024:
            assert not m["desplazaTarjeta"], m  # en el PC cabe todo, sin desplazar ni dentro de la tarjeta
        assert not errores
