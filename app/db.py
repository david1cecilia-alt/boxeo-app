"""Acceso a SQLite con sqlite3 de la librería estándar."""
import json
import sqlite3
from contextlib import closing
from pathlib import Path

ESQUEMA = """
CREATE TABLE IF NOT EXISTS sesiones (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha           TEXT    NOT NULL,
    asaltos         INTEGER NOT NULL,   -- asaltos completados
    nivel           INTEGER NOT NULL,
    zurdo           INTEGER NOT NULL DEFAULT 0,
    duracion_asalto INTEGER NOT NULL,
    descanso        INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS combinaciones (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    sesion_id INTEGER NOT NULL REFERENCES sesiones(id) ON DELETE CASCADE,
    orden     INTEGER NOT NULL,
    asalto    INTEGER NOT NULL,
    texto     TEXT    NOT NULL,
    ids       TEXT    NOT NULL          -- lista JSON de ids de acciones
);
"""


def conectar(ruta: Path) -> sqlite3.Connection:
    conexion = sqlite3.connect(ruta)
    conexion.row_factory = sqlite3.Row  # filas accesibles por nombre de columna
    conexion.execute("PRAGMA foreign_keys = ON")
    return conexion


def crear_tablas(ruta: Path) -> None:
    with closing(conectar(ruta)) as c:
        c.executescript(ESQUEMA)


def guardar_sesion(ruta: Path, sesion: dict) -> int:
    with closing(conectar(ruta)) as c, c:  # el segundo "with c" hace commit o rollback
        cursor = c.execute(
            "INSERT INTO sesiones (fecha, asaltos, nivel, zurdo, duracion_asalto, descanso) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (sesion["fecha"], sesion["asaltos"], sesion["nivel"], int(sesion["zurdo"]),
             sesion["duracion_asalto"], sesion["descanso"]))
        sesion_id = cursor.lastrowid
        c.executemany(
            "INSERT INTO combinaciones (sesion_id, orden, asalto, texto, ids) VALUES (?, ?, ?, ?, ?)",
            [(sesion_id, i, combo["asalto"], combo["texto"], json.dumps(combo["ids"]))
             for i, combo in enumerate(sesion["combinaciones"])])
        return sesion_id


def listar_sesiones(ruta: Path) -> list[dict]:
    with closing(conectar(ruta)) as c:
        filas = c.execute(
            "SELECT s.*, COUNT(k.id) AS num_combinaciones FROM sesiones s "
            "LEFT JOIN combinaciones k ON k.sesion_id = s.id "
            "GROUP BY s.id ORDER BY s.fecha DESC, s.id DESC").fetchall()
        return [dict(f) for f in filas]


def borrar_sesion(ruta: Path, sesion_id: int) -> bool:
    """Borra la sesión y sus combinaciones (ON DELETE CASCADE). False si no existía."""
    with closing(conectar(ruta)) as c, c:
        return c.execute("DELETE FROM sesiones WHERE id = ?", (sesion_id,)).rowcount > 0


def combinaciones_de(ruta: Path, sesion_id: int) -> list[dict]:
    with closing(conectar(ruta)) as c:
        filas = c.execute("SELECT asalto, texto, ids FROM combinaciones WHERE sesion_id = ? ORDER BY orden",
                          (sesion_id,)).fetchall()
        return [{**dict(f), "ids": json.loads(f["ids"])} for f in filas]
