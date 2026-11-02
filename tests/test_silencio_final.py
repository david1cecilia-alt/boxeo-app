"""Silencio al final de cada asalto: desde que acaba la última combinación hasta la campana (el
aviso de «diez segundos» no lo rompe: es un instante y no da nada que hacer). Asaltos de 3 min en
nivel medio, velocidad normal, con y sin Reacción.

En Python solo hay guion (duraciones estimadas); la voz real la simula tests/js/silencio_final.test.mjs.
"""
import random

import pytest

from motor.ritmo import RITMO_POR_DEFECTO, VELOCIDADES, rango_pausa
from motor.temporizador import ConfigSesion, construir_guion

SILENCIO_MAXIMO = rango_pausa(RITMO_POR_DEFECTO)[0] + 3.0  # el hueco mínimo del ritmo más 3 s: 5 s
SEMILLAS = range(30)


def silencios_finales(guion) -> list[float]:
    """Por asalto: fin del asalto menos el final de su última combinación (o coletilla dicha;
    las que no se dicen van con t = fin)."""
    silencios = []
    for fin in (e for e in guion if e.tipo == "fin_asalto"):
        dichos = [e for e in guion if e.asalto == fin.asalto and e.tipo in ("combo", "coletilla") and e.t < fin.t]
        silencios.append(round(fin.t - max(e.t + e.duracion for e in dichos), 2))
    return silencios


@pytest.mark.parametrize("modo_reaccion", [False, True], ids=["sin_reaccion", "con_reaccion"])
def test_silencio_final_del_guion_es_corto(modo_reaccion):
    silencios = []
    for semilla in SEMILLAS:
        config = ConfigSesion(asaltos=3, duracion_asalto=180, nivel=2, modo_reaccion=modo_reaccion,
                              velocidad=VELOCIDADES["normal"])
        silencios += silencios_finales(construir_guion(config, random.Random(semilla)))
    media = sum(silencios) / len(silencios)
    print(f"silencio final del guion: media {media:.1f} s, máximo {max(silencios):.1f} s")
    assert max(silencios) <= SILENCIO_MAXIMO, (media, max(silencios))
