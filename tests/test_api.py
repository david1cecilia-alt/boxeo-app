from contextlib import closing

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import crear_app


@pytest.fixture
def cliente(tmp_path):
    # Base de datos temporal: los tests nunca tocan boxeo.db
    return TestClient(crear_app(tmp_path / "test.db"))


def test_config_incluye_preset_amateur(cliente):
    datos = cliente.get("/api/config").json()
    amateur = next(p for p in datos["presets"] if p["id"] == "amateur")
    assert (amateur["asaltos"], amateur["duracion_asalto"], amateur["descanso"]) == (3, 180, 60)
    assert datos["perfil"]["guardia"] == "ortodoxa"


def test_sirve_los_datos_para_el_motor_js(cliente):
    for nombre in ("acciones", "combos", "perfil", "presets"):
        assert cliente.get(f"/data/{nombre}.json").status_code == 200
    assert cliente.get("/motor/temporizador.js").status_code == 200


def test_guion_devuelve_eventos(cliente):
    r = cliente.post("/api/sesion/guion", json={"asaltos": 2, "duracion_asalto": 60, "descanso": 30,
                                                 "nivel": 2, "modo_reaccion": True})
    assert r.status_code == 200
    tipos = {e["tipo"] for e in r.json()["eventos"]}
    assert {"inicio_asalto", "combo", "aviso", "fin_asalto", "descanso", "fin_sesion"} <= tipos


def test_guion_rechaza_configuracion_invalida(cliente):
    assert cliente.post("/api/sesion/guion", json={"nivel": 7}).status_code == 422


def test_guardar_y_listar_sesion(cliente):
    sesion = {"asaltos": 3, "nivel": 1, "zurdo": False, "duracion_asalto": 180, "descanso": 60,
              "combinaciones": [{"asalto": 1, "texto": "jab, directo", "ids": ["jab", "directo"]},
                                {"asalto": 2, "texto": "cúbrete, gancho de izquierda",
                                 "ids": ["bloqueo", "gancho_izq"]}]}
    r = cliente.post("/api/sesiones", json=sesion)
    assert r.status_code == 201
    sesion_id = r.json()["id"]

    lista = cliente.get("/api/sesiones").json()
    assert lista[0]["id"] == sesion_id
    assert lista[0]["num_combinaciones"] == 2
    assert lista[0]["fecha"]  # la pone el servidor

    combos = cliente.get(f"/api/sesiones/{sesion_id}/combinaciones").json()
    assert combos[1]["ids"] == ["bloqueo", "gancho_izq"]


def test_borrar_sesion_borra_tambien_sus_combinaciones(cliente, tmp_path):
    sesion = {"asaltos": 1, "nivel": 1, "duracion_asalto": 60, "descanso": 30,
              "combinaciones": [{"asalto": 1, "texto": "jab, directo", "ids": ["jab", "directo"]}]}
    otra = cliente.post("/api/sesiones", json=sesion).json()["id"]
    borrar = cliente.post("/api/sesiones", json=sesion).json()["id"]

    assert cliente.delete(f"/api/sesiones/{borrar}").status_code == 204
    assert [s["id"] for s in cliente.get("/api/sesiones").json()] == [otra]
    with closing(db.conectar(tmp_path / "test.db")) as c:
        assert c.execute("SELECT COUNT(*) FROM combinaciones WHERE sesion_id = ?", (borrar,)).fetchone()[0] == 0
    assert cliente.delete(f"/api/sesiones/{borrar}").status_code == 404


def test_sesion_inexistente_da_404(cliente):
    assert cliente.get("/api/sesiones/999/combinaciones").status_code == 404
