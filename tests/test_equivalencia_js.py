"""Equivalencia entre el motor JS (static/motor/) y el de Python (la referencia).

tests/js/exportar.mjs genera con el motor JS combinaciones, guiones y el espejo del
catálogo, y aquí se validan con motor/. No se exige la misma secuencia aleatoria
(cada motor tiene su PRNG), sino las mismas reglas, invariantes y proporciones.
"""
import json
import os
import random
import shutil
import subprocess
from dataclasses import asdict
from pathlib import Path

import pytest

from motor.acciones import (Accion, acciones_por_ids, biblioteca, catalogo, espejo, espejo_combo,
                            texto_hablado)
from motor.generador import GeneradorCombos, cargar_perfil
from motor.sorteo import NUMEROS, SIN_REPETIR, SorteoBiblioteca
from motor.reglas import ultimo_golpe, validar
from motor.ritmo import duracion_estimada, pausa_entre_combos
from motor.temporizador import (AVISO_ANTES_FIN, DURACION_AVISO, DURACION_REACCION, MARGEN,
                                PREPARACION, ConfigSesion, cargar_presets, construir_guion,
                                guion_a_dict)

RAIZ = Path(__file__).resolve().parent.parent
SCRIPT = RAIZ / "tests" / "js" / "exportar.mjs"
NIVELES = [1, 2, 3]
MUESTRAS = 5000  # combinaciones por nivel (y por guardia) en cada motor
# Con 5.000 muestras el ruido de la diferencia es de ~1 punto (σ): 5 puntos solo se
# superan si el port genera de verdad otra distribución.
TOLERANCIA_PROPORCION = 0.05
REDONDEO = 0.011  # los tiempos se redondean a centésimas

NODE = shutil.which("node")
# En local sin Node se saltan; en CI (GitHub pone CI=true) tienen que ejecutarse siempre.
pytestmark = pytest.mark.skipif(NODE is None and not os.environ.get("CI"), reason="node no está instalado")


def _exportar(destino: Path) -> Path:
    assert NODE, "Los tests de equivalencia necesitan node en el PATH"
    subprocess.run([NODE, str(SCRIPT), str(destino), str(MUESTRAS)], check=True, cwd=RAIZ)
    return destino


@pytest.fixture(scope="module")
def ruta_js(tmp_path_factory):
    return _exportar(tmp_path_factory.mktemp("js") / "exportado.json")


@pytest.fixture(scope="module")
def js(ruta_js):
    return json.loads(ruta_js.read_text(encoding="utf-8"))


def _acciones(lista: list[dict]) -> list[Accion]:
    return [Accion(**a) for a in lista]


# ---------- Combinaciones ----------

@pytest.mark.parametrize("nivel", NIVELES)
@pytest.mark.parametrize("guardia", ["ortodoxo", "zurdo"])
def test_combinaciones_js_pasan_las_reglas_de_python(js, nivel, guardia):
    combos = js["combos"][str(nivel)][guardia]
    assert len(combos) == MUESTRAS
    for c in combos:
        acciones = _acciones(c["acciones"])
        errores = validar(acciones, nivel, zurdo=guardia == "zurdo")
        assert errores == [], f"nivel {nivel} {guardia}: '{c['texto']}' -> {errores}"
        assert c["texto"] == texto_hablado(acciones)


@pytest.mark.parametrize("nivel", NIVELES)
def test_combinaciones_js_ortodoxas_son_acciones_del_catalogo(js, nivel):
    cat = catalogo()
    for c in js["combos"][str(nivel)]["ortodoxo"]:
        assert _acciones(c["acciones"]) == [cat[a["id"]] for a in c["acciones"]]


@pytest.mark.parametrize("nivel", NIVELES)
def test_zurdo_js_es_el_espejo_python_del_ortodoxo_js(js, nivel):
    combos = js["combos"][str(nivel)]
    for o, z in zip(combos["ortodoxo"], combos["zurdo"], strict=True):
        assert _acciones(z["acciones"]) == espejo_combo(_acciones(o["acciones"]))


@pytest.mark.parametrize("nivel", NIVELES)
def test_js_usa_reglas_y_clasicos_y_no_repite_seguido(js, nivel):
    combos = js["combos"][str(nivel)]["ortodoxo"]
    assert {c["origen"] for c in combos} == {"reglas", "clasico"}
    ids = [[a["id"] for a in c["acciones"]] for c in combos]
    for a, b in zip(ids, ids[1:]):
        assert a != b


# ---------- Sorteo de la biblioteca ----------

def _biblioteca_hasta(nivel):
    return {tuple(a.id for a in c.acciones) for c in biblioteca() if c.nivel <= nivel}


@pytest.mark.parametrize("nivel", NIVELES)
def test_sorteo_js_cumple_las_mismas_reglas_que_el_de_python(js, nivel):
    sorteo = js["sorteos"][str(nivel)]
    ortodoxas = [tuple(ids) for ids in sorteo["ortodoxo"]]
    assert len(ortodoxas) == MUESTRAS
    assert set(ortodoxas) <= _biblioteca_hasta(nivel)
    for i, c in enumerate(ortodoxas):
        assert c not in ortodoxas[max(0, i - SIN_REPETIR):i], f"repetida en {i}"
    primeras = {a.numero for ids in ortodoxas[:6] for a in acciones_por_ids(list(ids)) if a.numero}
    assert primeras == NUMEROS
    for o, z in zip(sorteo["ortodoxo"], sorteo["zurdo"], strict=True):
        assert z == [a.id for a in espejo_combo(acciones_por_ids(o))]


@pytest.mark.parametrize("nivel", NIVELES)
def test_sorteo_js_saca_lo_mismo_que_el_de_python(js, nivel):
    sorteo = SorteoBiblioteca(nivel, rng=random.Random(nivel))
    python = [list(sorteo.siguiente().acciones) for _ in range(MUESTRAS)]
    javascript = [acciones_por_ids(ids) for ids in js["sorteos"][str(nivel)]["ortodoxo"]]
    condiciones = {"defensa": lambda c: any(a.tipo == "defensa" for a in c), **CONDICIONES}
    for numero_ in sorted(NUMEROS):
        condiciones[f"golpe {numero_}"] = lambda c, n=numero_: any(a.numero == n for a in c)
    for nombre, condicion in condiciones.items():
        p_py, p_js = _proporcion(python, condicion), _proporcion(javascript, condicion)
        assert abs(p_js - p_py) <= TOLERANCIA_PROPORCION, f"nivel {nivel}, {nombre}: JS {p_js:.1%} vs Python {p_py:.1%}"


# ---------- Proporciones del perfil ----------

CONDICIONES = {
    "termina_en_gancho": lambda acciones: (g := ultimo_golpe(acciones)) is not None and g.familia == "gancho",
    "bloquear_y_devolver": lambda acciones: any(a.familia == "bloqueo" for a in acciones),
    "entrada_con_jab": lambda acciones: acciones[0].id == "jab",
}


def _proporcion(muestra: list[list[Accion]], condicion) -> float:
    return sum(1 for acciones in muestra if condicion(acciones)) / len(muestra)


@pytest.mark.parametrize("nivel", NIVELES)
@pytest.mark.parametrize("condicion", CONDICIONES, ids=str)
def test_proporciones_del_perfil_iguales_en_js_y_python(js, nivel, condicion):
    gen = GeneradorCombos(nivel, rng=random.Random(nivel))  # perfil de data/perfil.json
    python = [list(gen.siguiente().acciones) for _ in range(MUESTRAS)]
    javascript = [_acciones(c["acciones"]) for c in js["combos"][str(nivel)]["ortodoxo"]]
    p_py = _proporcion(python, CONDICIONES[condicion])
    p_js = _proporcion(javascript, CONDICIONES[condicion])
    assert abs(p_js - p_py) <= TOLERANCIA_PROPORCION, \
        f"nivel {nivel}, {condicion}: JS {p_js:.1%} vs Python {p_py:.1%}"


@pytest.mark.parametrize("i", range(5))
def test_refuerzo_de_practicar_igual_en_js_y_python(js, i):
    caso = js["refuerzos"][i]
    perfil = {**cargar_perfil(), "refuerzo": {"acciones": caso["ids"], "factor": 3.0}}
    gen = GeneradorCombos(2, perfil=perfil, rng=random.Random(200))
    python = [list(gen.siguiente().acciones) for _ in range(MUESTRAS)]
    javascript = [_acciones(c["acciones"]) for c in caso["combos"]]
    for acciones in javascript:
        assert validar(acciones, 2) == [], acciones
    def lleva(acciones): return any(a.id in caso["ids"] for a in acciones)
    p_py, p_js = _proporcion(python, lleva), _proporcion(javascript, lleva)
    assert abs(p_js - p_py) <= TOLERANCIA_PROPORCION, f"{caso['ids']}: JS {p_js:.1%} vs Python {p_py:.1%}"


# ---------- Espejo ----------

def test_espejo_js_identico_al_de_python_en_todo_el_catalogo(js):
    assert set(js["espejos"]) == set(catalogo())
    for id_, accion in catalogo().items():
        assert js["espejos"][id_] == asdict(espejo(accion)), id_


# ---------- Guiones ----------

def comprobar_guion(eventos: list[dict], c: ConfigSesion) -> None:
    """Invariantes que debe cumplir cualquier guion, lo genere Python o JS."""
    assert [e["t"] for e in eventos] == sorted(e["t"] for e in eventos)
    textos_reaccion = {r["texto"] for r in cargar_presets()["reacciones"]}
    pausa = pausa_entre_combos(c.nivel, c.pausa)
    final = c.asaltos * c.duracion_asalto + (c.asaltos - 1) * c.descanso
    assert eventos[-1]["tipo"] == "fin_sesion" and eventos[-1]["t"] == final
    assert [e for e in eventos if e["tipo"] == "fin_sesion"] == [eventos[-1]]

    for n in range(1, c.asaltos + 1):
        inicio = (n - 1) * (c.duracion_asalto + c.descanso)
        fin = inicio + c.duracion_asalto
        aviso = fin - AVISO_ANTES_FIN

        def de_tipo(tipo):
            return [e for e in eventos if e["asalto"] == n and e["tipo"] == tipo]

        assert [e["t"] for e in de_tipo("inicio_asalto")] == [inicio]
        assert [e["t"] for e in de_tipo("fin_asalto")] == [fin]
        assert [(e["t"], e["duracion"]) for e in de_tipo("aviso")] == [(aviso, DURACION_AVISO)]
        descansos = [(e["t"], e["duracion"]) for e in de_tipo("descanso")]
        assert descansos == ([(fin, c.descanso)] if n < c.asaltos else [])

        reacciones = de_tipo("reaccion")
        if not c.modo_reaccion:
            assert reacciones == []
        for r in reacciones:
            assert r["duracion"] == DURACION_REACCION and r["texto"] in textos_reaccion
            assert inicio + PREPARACION <= r["t"] and r["t"] + r["duracion"] <= aviso - MARGEN + REDONDEO

        combos = de_tipo("combo")
        assert combos, f"asalto {n} sin combinaciones"
        for k in combos:
            acciones = acciones_por_ids(k["ids"])
            ortodoxas = espejo_combo(acciones) if c.zurdo else acciones
            assert tuple(a.id for a in ortodoxas) in _biblioteca_hasta(c.nivel), "no es de la biblioteca"
            assert k["duracion"] == duracion_estimada(acciones)
            assert k["texto"] == texto_hablado(acciones)
            assert inicio + PREPARACION <= k["t"] and k["t"] + k["duracion"] <= fin
        for a, b in zip(combos, combos[1:]):
            assert b["t"] >= a["t"] + a["duracion"] + pausa - REDONDEO, "no respeta la pausa entre combos"

        # Combos, reacciones y aviso nunca se pisan (combos con un margen respecto a señales).
        senales = [(e["t"], e["t"] + e["duracion"]) for e in reacciones + de_tipo("aviso")]
        for k in combos:
            for ini, fin_senal in senales:
                assert (k["t"] + k["duracion"] + MARGEN <= ini + REDONDEO
                        or fin_senal + MARGEN <= k["t"] + REDONDEO), f"combo en {k['t']} pisa {ini}-{fin_senal}"
        for (_, fin_a), (ini_b, _) in zip(sorted(senales), sorted(senales)[1:]):
            assert fin_a <= ini_b


def test_hay_guiones_con_y_sin_modo_reaccion(js):
    modos = {bool(g["config"].get("modo_reaccion")) for g in js["guiones"]}
    assert modos == {True, False}


def test_guiones_js_cumplen_los_invariantes(js):
    for g in js["guiones"]:
        comprobar_guion(g["eventos"], ConfigSesion(**g["config"]))


def test_guiones_python_cumplen_los_mismos_invariantes(js):
    # Comprueba que los invariantes describen de verdad al motor de referencia.
    for g in js["guiones"]:
        config = ConfigSesion(**g["config"])
        comprobar_guion(guion_a_dict(construir_guion(config, random.Random(g["semilla"]))), config)


# ---------- Reproducibilidad ----------

def test_motor_js_es_reproducible_con_la_misma_semilla(ruta_js, tmp_path):
    otra = _exportar(tmp_path / "otra.json")
    assert otra.read_bytes() == ruta_js.read_bytes()
