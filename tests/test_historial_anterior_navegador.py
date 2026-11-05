"""Las sesiones guardadas con la biblioteca anterior se siguen viendo en el Historial (Chromium con Playwright).

Se rehacen desde los ids de las acciones, no desde data/combinaciones.json: aunque sus combinaciones ya no
estén en la biblioteca, se ven con los nombres de hoy. Sin Playwright se salta en local; en CI falla.
"""
import json

import pytest

from herramientas.fotos_maniqui import ORIGEN, abrir
from tests.test_historial_navegador import _abrir_historial, pytestmark, sitio  # noqa: F401

# Un almacén v5 escrito tal cual en el localStorage (como lo dejó la app antes de la biblioteca de 150):
# perfil con los pesos de entonces y dos sesiones con combinaciones que ya no están en
# data/combinaciones.json, con el texto que se dijo entonces («gancho» era el crochet).
V5 = {
    "version": 5,
    "sesiones": [
        {"id": "vieja-ortodoxa", "fecha": "2026-10-20T18:00:00", "asaltos": 3, "nivel": 3, "zurdo": False,
         "duracion_asalto": 180, "descanso": 60, "pausa": None, "ritmo": 3, "voz": "ambos", "modo_reaccion": False,
         "combinaciones": [
             {"asalto": 1, "texto": "uno jab, tres gancho de izquierda", "ids": ["jab", "gancho_izq"]},
             {"asalto": 1, "texto": "esquiva derecha, dos recto, tres gancho de izquierda",
              "ids": ["esquiva_der", "directo", "gancho_izq"]},
             {"asalto": 2, "texto": "jab al cuerpo, dos recto, pivote", "ids": ["jab_cuerpo", "directo", "pivote"]},
             {"asalto": 3, "texto": "bloqueo, tres gancho de izquierda, dos recto, paso lateral izquierda",
              "ids": ["bloqueo", "gancho_izq", "directo", "paso_lateral_izq"]},
         ]},
        {"id": "vieja-zurda", "fecha": "2026-10-19T18:00:00", "asaltos": 1, "nivel": 1, "zurdo": True,
         "duracion_asalto": 180, "descanso": 60, "pausa": None, "ritmo": 3, "voz": "ambos", "modo_reaccion": False,
         "combinaciones": [{"asalto": 1, "texto": "uno jab, tres gancho de derecha", "ids": ["jab", "gancho_der"]}]},
    ],
    "valoraciones": {},
    "perfil": {"pesos": {"termina_en_gancho": 3, "bloquear_y_devolver": 1, "entrada_con_jab": 1.5}},
    "notas_entrenador": [],
    "revisiones": {},
}

SEMBRAR_V5 = f"""<!doctype html><meta charset="utf-8">
<script>localStorage.setItem("boxeo", {json.dumps(json.dumps(V5))}); window.listo = true;</script>"""


@pytest.fixture(scope="module")
def pagina_v5(sitio):
    with abrir(sitio, SEMBRAR_V5, 390, 844, barras=True) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        yield pagina
        assert not errores


@pytest.mark.parametrize("sesion, esperados", [
    ("vieja-ortodoxa", ["1 jab, 3 crochet de izquierda", "esquiva derecha, 2 recto, 3 crochet de izquierda",
                        "7 jab al cuerpo, 2 recto, pivote",  # el número nuevo del golpe al cuerpo, sin migrar
                        "bloqueo, 3 crochet de izquierda, 2 recto, paso lateral izquierda"]),
    ("vieja-zurda", ["1 jab, 3 crochet de derecha"]),
])
def test_las_sesiones_de_la_biblioteca_anterior_se_rehacen_desde_los_ids(pagina_v5, sesion, esperados):
    _abrir_historial(pagina_v5, 390, f"local%3A{sesion}", "#t-detalle")
    detalle = pagina_v5.locator("#historial-detalle ol li").all_inner_texts()
    assert [t.strip() for t in detalle] == esperados
