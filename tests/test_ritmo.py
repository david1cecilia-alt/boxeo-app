"""Ritmo 1-5: hueco al azar en su rango desde que la voz termina; se golpea mientras se oye, así que
no hay tiempo de ejecución ni extra por longitud."""
import random

import pytest

from motor.acciones import acciones_por_ids, texto_hablado
from motor.ritmo import (PAUSA_POR_RITMO, VELOCIDAD_MEDIDA, VELOCIDAD_POR_DEFECTO, VELOCIDADES, duracion_estimada,
                         pausa_entre_combos, rango_pausa, segundos_habla)
from motor.temporizador import ConfigSesion, construir_guion

CORTA = acciones_por_ids(["jab", "directo"])
LARGA = acciones_por_ids(["jab", "directo", "gancho_izq", "directo", "gancho_izq", "directo"])


def test_huecos_de_cada_ritmo():
    assert PAUSA_POR_RITMO == {1: (5.0, 7.0), 2: (4.0, 5.0), 3: (2.0, 4.0), 4: (1.0, 3.0), 5: (1.0, 1.0)}


def test_de_calmado_a_intenso():
    minimos = [PAUSA_POR_RITMO[r][0] for r in range(1, 6)]
    maximos = [PAUSA_POR_RITMO[r][1] for r in range(1, 6)]
    assert minimos == sorted(minimos, reverse=True) and maximos == sorted(maximos, reverse=True)


@pytest.mark.parametrize("ritmo", range(1, 5))
def test_la_pausa_varia_dentro_de_su_rango(ritmo):
    rng = random.Random(ritmo)
    pausas = [pausa_entre_combos(ritmo, rng) for _ in range(500)]
    minimo, maximo = PAUSA_POR_RITMO[ritmo]
    assert all(minimo <= p <= maximo for p in pausas)
    assert len(set(pausas)) > 50, "debe variar"


def test_intenso_deja_siempre_un_segundo():
    rng = random.Random(5)
    assert {pausa_entre_combos(5, rng) for _ in range(100)} == {1.0}


def test_la_duracion_es_solo_lo_que_se_tarda_en_decirla():
    for combo in (CORTA, LARGA):
        for modo in ("numeros", "nombres", "ambos"):
            texto = texto_hablado(combo, modo)
            assert duracion_estimada(combo, texto) == round(segundos_habla(texto), 2), "sin ejecución ni extra"


def test_la_pausa_fija_del_usuario_manda():
    assert pausa_entre_combos(1, random.Random(0), pausa=2.0) == 2.0
    assert rango_pausa(1, pausa=2.0) == (2.0, 2.0)


def test_con_ritmo_intenso_caben_muchas_mas_combinaciones():
    def cuantas(ritmo):
        config = ConfigSesion(asaltos=3, duracion_asalto=180, descanso=60, ritmo=ritmo)
        return sum(e.tipo == "combo" for e in construir_guion(config, random.Random(0)))
    assert cuantas(5) > 1.6 * cuantas(1)


@pytest.mark.parametrize("voz, esperado", [("nombres", "recto"), ("numeros", "dos"), ("ambos", "dos recto")])
def test_el_guion_dice_las_combinaciones_en_el_modo_elegido(voz, esperado):
    config = ConfigSesion(asaltos=1, duracion_asalto=180, descanso=0, voz=voz)
    textos = [e.texto for e in construir_guion(config, random.Random(0)) if e.tipo == "combo"]
    assert any(esperado in t.split(", ") for t in textos)


# Medidas de la voz del navegador (Microsoft Helena, es-ES, velocidad 1,1): de que empieza a
# hablar a que termina. La estimación no puede quedarse corta: la pausa cuenta desde el final.
MEDIDAS_VOZ = [
    ("uno, dos", 1.87),
    ("jab, recto", 2.07),
    ("uno jab, dos recto", 2.35),
    ("jab, gancho de izquierda", 2.61),
    ("cinco uppercut de izquierda, dos recto", 3.07),
    ("uno, dos, rueda, cuatro, rueda, tres, dos", 5.94),
    ("jab, recto, rueda, gancho de derecha, rueda, gancho de izquierda, recto", 7.27),
    ("uno jab, dos recto, rueda, cuatro gancho de derecha, rueda, tres gancho de izquierda, dos recto", 8.33),
]


@pytest.mark.parametrize("texto, medido", MEDIDAS_VOZ)
def test_la_estimacion_de_lo_que_se_habla_casa_con_la_voz_real(texto, medido):
    assert medido - 0.2 <= segundos_habla(texto) <= medido + 0.6


def test_ambos_tarda_mas_que_nombres_y_nombres_mas_que_numeros():
    combo = acciones_por_ids(["jab", "directo", "gancho_izq", "uppercut_der"])
    numeros, nombres, ambos = (duracion_estimada(combo, texto_hablado(combo, m)) for m in ("numeros", "nombres", "ambos"))
    assert numeros < nombres < ambos


@pytest.mark.parametrize("voz", ["numeros", "nombres", "ambos"])
@pytest.mark.parametrize("zurdo", [False, True])
def test_la_pausa_cuenta_desde_que_termina_de_hablar(voz, zurdo):
    config = ConfigSesion(asaltos=2, duracion_asalto=180, descanso=30, nivel=3, ritmo=5, voz=voz, zurdo=zurdo)
    combos = [e for e in construir_guion(config, random.Random(1)) if e.tipo == "combo"]
    for a, b in zip(combos, combos[1:]):
        if a.asalto != b.asalto:
            continue
        termina_de_hablar = a.t + segundos_habla(a.texto)
        minima, _ = rango_pausa(config.ritmo)
        assert b.t >= termina_de_hablar + minima - 0.01, f"{a.texto!r} a los {a.t} s pisa la pausa"


@pytest.mark.parametrize("ritmo", range(1, 6))
@pytest.mark.parametrize("voz", ["numeros", "nombres"])
def test_el_guion_encadena_voz_y_hueco_como_el_dictado(ritmo, voz):
    """Cada combinación empieza a la voz estimada de la anterior más el hueco del ritmo (lo mismo
    que espera el dictado desde onend): el guion no deja segundos de más."""
    config = ConfigSesion(asaltos=2, duracion_asalto=180, descanso=30, nivel=3, ritmo=ritmo, voz=voz)
    guion = construir_guion(config, random.Random(ritmo))
    avisos = [e.t for e in guion if e.tipo == "aviso"]
    combos = [e for e in guion if e.tipo == "combo"]
    minimo, maximo = PAUSA_POR_RITMO[ritmo]
    for a, b in zip(combos, combos[1:]):
        if a.asalto != b.asalto or any(a.t < t < b.t for t in avisos):
            continue
        hueco = b.t - (a.t + segundos_habla(a.texto))
        assert minimo - 0.02 <= hueco <= maximo + 0.02, f"{a.texto!r}: hueco de {hueco:.2f} s"


def test_en_intenso_el_hueco_tras_hablar_es_menor_de_segundo_y_medio():
    config = ConfigSesion(asaltos=1, duracion_asalto=180, descanso=0, nivel=3, ritmo=5)
    combos = [e for e in construir_guion(config, random.Random(0)) if e.tipo == "combo"]
    huecos = [b.t - (a.t + segundos_habla(a.texto)) for a, b in zip(combos, combos[1:])
              if b.t < 180 - 10]  # antes del aviso de los 10 s
    assert huecos and max(huecos) < 1.5


# ---------- Velocidad de la voz ----------

def test_velocidades_que_se_pueden_elegir():
    assert VELOCIDADES == {"lenta": 0.9, "normal": 1.1, "rapida": 1.3}
    assert VELOCIDADES[VELOCIDAD_POR_DEFECTO] == VELOCIDAD_MEDIDA == 1.1


def test_la_estimacion_escala_en_proporcion_inversa_a_la_velocidad():
    texto = texto_hablado(LARGA)
    normal = segundos_habla(texto)
    assert segundos_habla(texto, 1.1) == normal
    assert segundos_habla(texto, 0.9) == pytest.approx(normal * 1.1 / 0.9)
    assert segundos_habla(texto, 1.3) == pytest.approx(normal * 1.1 / 1.3)
    assert segundos_habla(texto, 1.3) < normal < segundos_habla(texto, 0.9)


@pytest.mark.parametrize("velocidad", VELOCIDADES.values())
def test_el_guion_usa_la_estimacion_de_su_velocidad(velocidad):
    config = ConfigSesion(asaltos=1, duracion_asalto=180, descanso=0, nivel=3, velocidad=velocidad)
    combos = [e for e in construir_guion(config, random.Random(0)) if e.tipo == "combo"]
    assert combos
    for e in combos:
        assert e.duracion == round(segundos_habla(e.texto, velocidad), 2)


def test_a_mas_velocidad_caben_mas_combinaciones():
    def cuantas(velocidad):
        config = ConfigSesion(asaltos=3, duracion_asalto=180, descanso=60, ritmo=5, velocidad=velocidad)
        return sum(e.tipo == "combo" for e in construir_guion(config, random.Random(0)))
    assert cuantas(1.3) > cuantas(1.1) > cuantas(0.9)


def test_velocidad_desconocida_no_vale():
    with pytest.raises(AssertionError):
        ConfigSesion(velocidad=2.0)
