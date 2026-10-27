"""Las fichas de técnica (data/tecnica.json) están bien formadas y casan con acciones.json."""
import json

import pytest

from motor.acciones import RUTA_DATOS, catalogo

CATEGORIAS = {"golpes", "defensas", "pies", "estrategia"}


@pytest.fixture(scope="module")
def tecnica():
    with open(RUTA_DATOS / "tecnica.json", encoding="utf-8") as f:
        return json.load(f)


def test_categorias(tecnica):
    assert {c["id"] for c in tecnica["categorias"]} == CATEGORIAS
    assert {f["categoria"] for f in tecnica["fichas"]} <= CATEGORIAS


def test_ids_unicos(tecnica):
    ids = [f["id"] for f in tecnica["fichas"]]
    assert len(ids) == len(set(ids))


def test_cada_ficha_tiene_su_contenido(tecnica):
    for f in tecnica["fichas"]:
        assert f["titulo"] and f["frase"] and f["cuando"], f["id"]
        assert f["nivel"] in (1, 2, 3), f["id"]
        assert 3 <= len(f["pasos"]) <= 6, f["id"]
        assert all(p["texto"] for p in f["pasos"]), f["id"]
        assert 2 <= len(f["errores"]) <= 5, f["id"]
        assert all(e["error"] and e["correccion"] for e in f["errores"]), f["id"]
        assert isinstance(f["revisar"], bool), f["id"]
        assert f["fuentes"], f["id"]
        assert f["palabras_clave"], f["id"]


def test_lo_pendiente_dice_que_hay_que_revisar(tecnica):
    for f in tecnica["fichas"]:
        if f["revisar"]:
            assert f["pendiente"].startswith("REVISAR CON ENTRENADOR:"), f["id"]
        else:
            assert "pendiente" not in f, f["id"]


def test_las_acciones_de_las_fichas_existen(tecnica):
    for f in tecnica["fichas"]:
        assert set(f["acciones"]) <= set(catalogo()), f["id"]
        if f["categoria"] == "estrategia":
            assert f["acciones"] == [], f["id"]


def test_si_la_ficha_se_llama_como_una_accion_la_incluye(tecnica):
    for f in tecnica["fichas"]:
        if f["id"] in catalogo():
            assert f["id"] in f["acciones"], f["id"]


@pytest.mark.xfail(strict=True, reason="Faltan fichas: se completan tras validar la del jab")
def test_toda_accion_tiene_exactamente_una_ficha(tecnica):
    cubiertas = [a for f in tecnica["fichas"] for a in f["acciones"]]
    assert sorted(cubiertas) == sorted(catalogo())
