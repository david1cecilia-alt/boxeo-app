"""Las fichas de técnica (data/tecnica.json) están bien formadas y casan con acciones.json."""
import json

import pytest

from motor.acciones import RUTA_DATOS, catalogo

CATEGORIAS = {"golpes", "defensas", "salidas", "estrategia"}
# Las defensas y las salidas, con todo lo de docs/revision/fichas-defensas.md.
FICHAS_DEFENSA = {"esquiva", "rodar", "ballesteo", "flexion", "bloqueo", "parada", "paso_atras"}
FICHAS_SALIDA = {"pivote", "paso_lateral", "salir"}


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
        assert f["titulo"] and (f.get("que_es") or f.get("frase")) and f["cuando"], f["id"]
        assert f.get("nivel", 1) in (1, 2, 3), f["id"]
        assert 3 <= len(f["pasos"]) <= 6, f["id"]
        assert all(p["texto"] for p in f["pasos"]), f["id"]
        assert 2 <= len(f["errores"]) <= 5, f["id"]
        assert all(e["error"] and e.get("correccion", "x") for e in f["errores"]), f["id"]
        assert all(n["titulo"] and n["texto"] for n in f.get("notas", [])), f["id"]
        assert isinstance(f["revisar"], bool), f["id"]
        assert f["fuentes"] and all(x["titulo"] for x in f["fuentes"]), f["id"]


def test_estan_las_siete_defensas_y_las_tres_salidas_con_todos_sus_campos(tecnica):
    por_categoria = {c: {f["id"] for f in tecnica["fichas"] if f["categoria"] == c} for c in ("defensas", "salidas")}
    assert por_categoria == {"defensas": FICHAS_DEFENSA, "salidas": FICHAS_SALIDA}
    for f in tecnica["fichas"]:
        if f["categoria"] in ("defensas", "salidas"):
            for campo in ("en_ingles", "que_es", "cuando", "ventajas", "inconvenientes"):
                assert isinstance(f[campo], str) and f[campo].strip(), (f["id"], campo)
            assert any("url" in x for x in f["fuentes"]), f["id"]


def test_las_fuentes_enlazan_por_https(tecnica):
    for f in tecnica["fichas"]:
        for x in f["fuentes"]:
            if "url" in x:
                assert x["url"].startswith("https://") and " " not in x["url"], (f["id"], x["url"])


def test_al_usuario_no_le_sale_la_marca_en_mayusculas(tecnica):
    # La marca solo va en `pendiente` (para revisar.json); la vista dice «Pendiente de revisar con el entrenador».
    for f in tecnica["fichas"]:
        visible = {k: v for k, v in f.items() if k != "pendiente"}
        assert "REVISAR" not in json.dumps(visible, ensure_ascii=False), f["id"]


def test_la_ficha_se_titula_como_lo_dice_la_app(tecnica):
    # Las defensas y salidas: el título es el nombre de la familia sin lado («Rueda», «Cambio de ángulo»).
    textos = {a.familia: a.nombre_hablado for a in catalogo().values()}
    for f in tecnica["fichas"]:
        if f["categoria"] in ("defensas", "salidas"):
            familia = catalogo()[f["acciones"][0]].familia
            nombre = textos[familia].removesuffix(" derecha").removesuffix(" izquierda")
            assert f["titulo"].lower() == nombre, (f["id"], nombre)


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
