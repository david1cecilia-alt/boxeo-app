import sqlite3
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
    for nombre in ("acciones", "combinaciones", "perfil", "presets"):
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


def test_guion_con_ritmo_y_modo_de_voz(cliente):
    r = cliente.post("/api/sesion/guion", json={"asaltos": 1, "duracion_asalto": 60, "ritmo": 5, "voz": "numeros"})
    assert r.status_code == 200
    textos = [e["texto"] for e in r.json()["eventos"] if e["tipo"] == "combo"]
    assert any("uno" in t.split(", ") for t in textos)
    assert cliente.post("/api/sesion/guion", json={"ritmo": 6}).status_code == 422
    assert cliente.post("/api/sesion/guion", json={"voz": "gritos"}).status_code == 422


def test_guion_con_velocidad_de_voz(cliente):
    r = cliente.post("/api/sesion/guion", json={"asaltos": 1, "duracion_asalto": 60, "velocidad": 1.3})
    assert r.status_code == 200
    assert r.json()["config"]["velocidad"] == 1.3
    assert cliente.post("/api/sesion/guion", json={"velocidad": 2.0}).status_code == 422


SESION = {"asaltos": 3, "nivel": 3, "zurdo": False, "duracion_asalto": 180, "descanso": 60,
          "combinaciones": [{"asalto": 1, "texto": "jab", "ids": ["jab"]}]}


@pytest.mark.parametrize("tipo", ["general", "personalizada", "prueba"])
def test_guardar_y_listar_el_tipo_de_sesion(cliente, tipo):
    assert cliente.post("/api/sesiones", json={**SESION, "tipo": tipo}).status_code == 201
    assert cliente.get("/api/sesiones").json()[0]["tipo"] == tipo


def test_sin_tipo_se_guarda_vacio_y_un_tipo_desconocido_se_rechaza(cliente):
    assert cliente.post("/api/sesiones", json=SESION).status_code == 201
    assert cliente.get("/api/sesiones").json()[0]["tipo"] is None
    assert cliente.post("/api/sesiones", json={**SESION, "tipo": "amateur"}).status_code == 422
    assert len(cliente.get("/api/sesiones").json()) == 1


def test_una_base_de_antes_recibe_la_columna_tipo_y_conserva_sus_sesiones(tmp_path):
    ruta = tmp_path / "vieja.db"
    with closing(sqlite3.connect(ruta)) as c, c:
        c.executescript("""
            CREATE TABLE sesiones (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL,
              asaltos INTEGER NOT NULL, nivel INTEGER NOT NULL, zurdo INTEGER NOT NULL DEFAULT 0,
              duracion_asalto INTEGER NOT NULL, descanso INTEGER NOT NULL);
            CREATE TABLE combinaciones (id INTEGER PRIMARY KEY AUTOINCREMENT,
              sesion_id INTEGER NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE, orden INTEGER NOT NULL,
              asalto INTEGER NOT NULL, texto TEXT NOT NULL, ids TEXT NOT NULL);
            INSERT INTO sesiones (fecha, asaltos, nivel, zurdo, duracion_asalto, descanso)
              VALUES ('2026-05-01T10:00:00', 3, 2, 0, 180, 60);""")
    cliente = TestClient(crear_app(ruta))
    lista = cliente.get("/api/sesiones").json()
    assert len(lista) == 1 and lista[0]["tipo"] is None and lista[0]["nivel"] == 2
    assert cliente.post("/api/sesiones", json={**SESION, "tipo": "general"}).status_code == 201
    assert [s["tipo"] for s in cliente.get("/api/sesiones").json()] == ["general", None]
    TestClient(crear_app(ruta))  # arrancar otra vez no vuelve a añadirla
