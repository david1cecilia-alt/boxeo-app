"""API FastAPI. Solo traduce HTTP ⇄ motor y guarda en SQLite."""
import random
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from app import db
from app.esquemas import PeticionGuion, SesionNueva
from motor.generador import cargar_perfil
from motor.ritmo import PAUSA_POR_NIVEL
from motor.temporizador import ConfigSesion, cargar_presets, construir_guion, guion_a_dict

RAIZ = Path(__file__).resolve().parent.parent
RUTA_DB = RAIZ / "boxeo.db"


def crear_app(ruta_db: Path = RUTA_DB) -> FastAPI:
    app = FastAPI(title="Boxeo")
    db.crear_tablas(ruta_db)

    @app.get("/api/config")
    def config():
        presets = cargar_presets()
        perfil = cargar_perfil()
        return {"presets": presets["presets"], "niveles": [1, 2, 3],
                "pausa_por_nivel": PAUSA_POR_NIVEL, "perfil": perfil}

    @app.post("/api/sesion/guion")
    def guion(peticion: PeticionGuion):
        config = ConfigSesion(**peticion.model_dump())
        eventos = construir_guion(config, random.Random())
        return {"config": peticion.model_dump(), "eventos": guion_a_dict(eventos)}

    @app.post("/api/sesiones", status_code=201)
    def guardar(sesion: SesionNueva):
        datos = sesion.model_dump()
        datos["fecha"] = datos["fecha"] or datetime.now().isoformat(timespec="seconds")
        return {"id": db.guardar_sesion(ruta_db, datos)}

    @app.get("/api/sesiones")
    def listar():
        return db.listar_sesiones(ruta_db)

    @app.get("/api/sesiones/{sesion_id}/combinaciones")
    def combinaciones(sesion_id: int):
        combos = db.combinaciones_de(ruta_db, sesion_id)
        if not combos and not any(s["id"] == sesion_id for s in db.listar_sesiones(ruta_db)):
            raise HTTPException(404, "Sesión no encontrada")
        return combos

    # Se monta al final para que no tape las rutas /api.
    app.mount("/", StaticFiles(directory=RAIZ / "static", html=True), name="static")
    return app
# Sin "app = crear_app()" a nivel de módulo: importar no crea la base de datos.
# Se arranca con: uvicorn app.main:crear_app --factory
