"""Las fichas de técnica (data/tecnica.json) están bien formadas y casan con acciones.json."""
import json

import pytest

from motor.acciones import RUTA_DATOS, catalogo

CATEGORIAS = {"golpes", "defensas", "salidas", "estrategia"}
# Las defensas y las salidas, con todo lo de docs/revision/fichas-defensas.md.
FICHAS_DEFENSA = {"esquiva", "rodar", "ballesteo", "flexion", "bloqueo", "parada", "paso_atras"}
FICHAS_SALIDA = {"pivote", "paso_lateral", "salir"}
# Los seis golpes, con todo lo de docs/revision/fichas-golpes.md: cada ficha lleva el golpe a la cara y al cuerpo.
FICHAS_GOLPE = ["jab", "directo", "gancho_izq", "gancho_der", "uppercut_izq", "uppercut_der"]


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
        assert 3 <= len(f["pasos"]) <= 7, f["id"]
        assert all(p["texto"] for p in f["pasos"]), f["id"]
        assert 2 <= len(f["errores"]) <= 5, f["id"]
        assert all(e["error"] and e.get("correccion", "x") for e in f["errores"]), f["id"]
        assert all(n["titulo"] and n["texto"] for n in f.get("notas", [])), f["id"]
        assert all(v["nombre"] and v["texto"] for v in f.get("variantes", [])), f["id"]
        assert all(d["titulo"] and d["texto"] for d in f.get("detalles", [])), f["id"]
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


def test_estan_los_seis_golpes_con_su_version_al_cuerpo_y_todos_sus_campos(tecnica):
    golpes = [f for f in tecnica["fichas"] if f["categoria"] == "golpes"]
    assert [f["id"] for f in golpes] == FICHAS_GOLPE
    for f in golpes:
        assert f["acciones"] == [f["id"], f"{f['id']}_cuerpo"], f["id"]
        for campo in ("en_ingles", "que_es", "cuando", "ventajas", "inconvenientes", "al_cuerpo"):
            assert isinstance(f[campo], str) and f[campo].strip(), (f["id"], campo)
        assert len(f["variantes"]) >= 3, f["id"]
        titulos = [x["titulo"] for x in f["fuentes"]]
        assert titulos[0].startswith("England Boxing") and titulos[-1].startswith("Respuestas de Iván"), f["id"]


def test_lo_comun_al_cuerpo_esta_una_vez_en_la_categoria_golpes(tecnica):
    comun = next(c for c in tecnica["categorias"] if c["id"] == "golpes")["al_cuerpo"]
    assert all(p["titulo"] and p["texto"] for p in comun["puntos"])
    assert comun["fuentes"][0]["titulo"].startswith("World Boxing")
    assert [c["id"] for c in tecnica["categorias"] if "al_cuerpo" in c] == ["golpes"]


def test_el_jab_tiene_sus_posturas_y_sus_detalles_en_mostrar_mas(tecnica):
    jab = next(f for f in tecnica["fichas"] if f["id"] == "jab")
    assert [p["postura"] for p in jab["pasos"]] == ["guardia", "jab_salida"] + ["jab_impacto"] * 4 + ["guardia"]
    assert [d["titulo"] for d in jab["detalles"]] == ["Guardia según la distancia", "Altura"]


def test_lo_del_rival_no_se_invierte_en_zurdo(tecnica):
    # Lo que une tu lado con el cuerpo del rival va con la mano real y aclara el zurdo;
    # los contragolpes del rival se escriben sin mano.
    textos = json.dumps([f for f in tecnica["fichas"] if f["categoria"] == "golpes"], ensure_ascii=False)
    assert "de izquierda del rival" not in textos and "de derecha del rival" not in textos
    por_id = {f["id"]: f for f in tecnica["fichas"]}
    assert "En zurdo" in por_id["gancho_izq"]["al_cuerpo"] and "En zurdo" in por_id["gancho_der"]["al_cuerpo"]
    comun = next(c for c in tecnica["categorias"] if c["id"] == "golpes")["al_cuerpo"]
    objetivos = next(p["texto"] for p in comun["puntos"] if p["titulo"] == "Objetivos:")
    assert "el hígado está en el lado derecho del rival" in objetivos and "en zurdo, el de atrás" in objetivos


def test_las_fuentes_enlazan_por_https(tecnica):
    comun = next(c for c in tecnica["categorias"] if c["id"] == "golpes")["al_cuerpo"]
    for f in [*tecnica["fichas"], {"id": "al_cuerpo", "fuentes": comun["fuentes"]}]:
        for x in f["fuentes"]:
            if "url" in x:
                assert x["url"].startswith("https://") and " " not in x["url"], (f["id"], x["url"])


def test_al_usuario_no_le_sale_la_marca_en_mayusculas(tecnica):
    # La marca solo va en `pendiente` (para revisar.json); la vista dice «Pendiente de revisar con el entrenador».
    for f in [*tecnica["fichas"], *tecnica["categorias"]]:
        visible = {k: v for k, v in f.items() if k != "pendiente"}
        assert "REVISAR" not in json.dumps(visible, ensure_ascii=False), f["id"]


def test_la_ficha_se_titula_como_lo_dice_la_app(tecnica):
    # Las defensas y salidas: el título es el nombre de la familia sin lado («Rueda», «Cambio de ángulo»);
    # los golpes, el nombre del golpe a la cara («Crochet de izquierda»).
    textos = {a.familia: a.nombre_hablado for a in catalogo().values()}
    for f in tecnica["fichas"]:
        if f["categoria"] == "golpes":
            assert f["titulo"].lower() == catalogo()[f["id"]].nombre_hablado, f["id"]
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


def test_toda_accion_tiene_exactamente_una_ficha(tecnica):
    cubiertas = [a for f in tecnica["fichas"] for a in f["acciones"]]
    assert sorted(cubiertas) == sorted(catalogo())


def test_la_rueda_dice_contra_que_crochet_va_cada_lado_y_queda_por_revisar(tecnica):
    rueda = next(f for f in tecnica["fichas"] if f["id"] == "rodar")
    lados = next(n["texto"] for n in rueda["notas"] if n["titulo"] == "Derecha o izquierda")
    assert "La rueda derecha va contra el crochet de la mano izquierda del rival" in lados
    assert "La rueda izquierda va contra el crochet de la mano derecha del rival" in lados
    assert "contra qué crochet va cada lado" in rueda["pendiente"]
