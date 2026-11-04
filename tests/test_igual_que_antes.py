"""Con la mezcla «Ninguna» la sesión sale exactamente igual que antes del creador de combinaciones.

`tests/fijos/igual_que_antes.json` guarda la huella (sha256) de sorteos, coletillas y guiones con
semilla tal como salían en 8ac5c72, antes del sorteo mezclado. Si cambia a propósito (nuevas
combinaciones en la biblioteca, otro ritmo…), se regenera con:

    .venv\\Scripts\\python -m tests.test_igual_que_antes
"""
import hashlib
import json
import random
from pathlib import Path

import pytest

from motor.sorteo import SorteoBiblioteca, cargar_perfil
from motor.temporizador import ConfigSesion, construir_guion, guion_a_dict

FIJOS = Path(__file__).resolve().parent / "fijos" / "igual_que_antes.json"
PRACTICAR = [[], [{"movimiento": "6", "cuanto": "bastante"}, {"movimiento": "esquiva", "cuanto": "poco"}]]
CONFIGS = [
    {"nivel": 1},
    {"nivel": 2, "modo_reaccion": True, "ritmo": 5, "voz": "ambos"},
    {"nivel": 3, "zurdo": True, "voz": "numeros", "ritmo": 1},
    {"asaltos": 2, "duracion_asalto": 30, "descanso": 10, "nivel": 1, "modo_reaccion": True},
]


def huella(valor) -> str:
    return hashlib.sha256(json.dumps(valor, ensure_ascii=False, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def _perfil(practicar):
    return {**cargar_perfil(), "practicar": practicar}


def sorteo_biblioteca(nivel, zurdo, rng, practicar):
    return SorteoBiblioteca(nivel, perfil=_perfil(practicar), zurdo=zurdo, rng=rng)


def casos(crear_sorteo=sorteo_biblioteca) -> dict[str, str]:
    """Huella de cada caso. `crear_sorteo(nivel, zurdo, rng, practicar)` da el sorteo."""
    resultado = {}
    for nivel in (1, 2, 3):
        for zurdo in (False, True):
            for i, practicar in enumerate(PRACTICAR):
                s = crear_sorteo(nivel, zurdo, random.Random(10 * nivel + i), practicar)
                sacadas = [[a.id for a in s.siguiente().acciones] for _ in range(60)]
                coletillas = [[a.id for a in c.acciones] for c in s.coletillas()]
                resultado[f"sorteo-{nivel}-{zurdo}-{i}"] = huella([sacadas, coletillas])
    for i, extra in enumerate(CONFIGS):
        config = ConfigSesion(**extra)
        for semilla in range(3):
            rng = random.Random(semilla)  # el guion y el sorteo comparten azar, como en la app
            s = crear_sorteo(config.nivel, config.zurdo, rng, [])
            resultado[f"guion-{i}-{semilla}"] = huella(guion_a_dict(construir_guion(config, rng, s)))
    return resultado


@pytest.fixture(scope="module")
def fijos():
    return json.loads(FIJOS.read_text(encoding="utf-8"))["python"]


def test_la_biblioteca_sortea_igual_que_antes(fijos):
    assert casos() == fijos


if __name__ == "__main__":
    datos = json.loads(FIJOS.read_text(encoding="utf-8")) if FIJOS.exists() else {}
    datos["python"] = casos()
    FIJOS.parent.mkdir(exist_ok=True)
    FIJOS.write_text(json.dumps(datos, indent=1, sort_keys=True) + "\n", encoding="utf-8")
