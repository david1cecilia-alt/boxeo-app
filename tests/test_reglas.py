"""Las reglas son solo estructurales: al menos un golpe. El resto lo decide la situación."""
import pytest

from motor.acciones import acciones_por_ids, biblioteca, catalogo
from motor.reglas import MAX_ACCIONES, MAX_PROPIAS, avisos_creador, es_valida, nivel_de, ultimo_golpe, validar


def combo(*ids):
    return acciones_por_ids(list(ids))


def test_jab_recto_es_valida():
    assert validar(combo("jab", "directo")) == []


def test_sin_golpes_no_es_combinacion():
    assert validar(combo("esquiva_der", "pivote")) == ["no hay ningún golpe"]


def test_tras_una_defensa_puede_ir_cualquier_golpe():
    for defensa in [a.id for a in catalogo().values() if a.tipo == "defensa"]:
        for golpe in ("jab", "directo", "gancho_izq", "gancho_der", "uppercut_izq", "uppercut_der"):
            assert es_valida(combo(defensa, golpe)), (defensa, golpe)


def test_se_puede_acabar_bloqueando_y_repetir_mano():
    assert es_valida(combo("jab", "directo", "bloqueo"))
    assert es_valida(combo("bloqueo", "pivote", "jab"))
    assert es_valida(combo("directo", "directo"))
    assert es_valida(combo("jab", "uppercut_izq"))


def test_se_puede_acabar_en_golpe_de_poder_o_en_cualquier_defensa():
    assert es_valida(combo("jab", "directo", "gancho_izq"))
    assert es_valida(combo("jab", "directo", "gancho_izq", "paso_atras"))
    assert es_valida(combo("jab", "directo", "gancho_izq", "parada"))


def test_ninguna_accion_tiene_nivel_minimo():
    # Golpes al cuerpo y todas las defensas valen desde básico: el nivel lo da solo la longitud.
    assert es_valida(combo("jab", "directo_cuerpo"))
    assert es_valida(combo("rodar_izq", "gancho_izq"))
    assert not any(hasattr(a, "nivel_minimo") for a in catalogo().values())


def test_salir_se_dice_cambio_de_angulo():
    assert catalogo()["salir"].nombre_hablado == "cambio de ángulo"


def test_ultimo_golpe_ignora_la_salida():
    assert ultimo_golpe(combo("jab", "directo", "gancho_izq", "esquiva_der")).id == "gancho_izq"
    assert ultimo_golpe(combo("esquiva_der", "pivote")) is None


# --- Nivel por número de acciones ---

@pytest.mark.parametrize("n, nivel", [(0, None), (1, None), (2, 1), (4, 1), (5, 2), (6, 2), (7, 3), (10, 3), (11, None)])
def test_nivel_por_numero_de_acciones_en_los_bordes(n, nivel):
    assert nivel_de(combo(*["jab"] * n)) == nivel


def test_cuentan_golpes_defensas_y_salidas_por_igual():
    assert nivel_de(combo("jab", "gancho_izq", "rodar_der")) == 1
    assert nivel_de(combo("jab", "gancho_izq", "rodar_der", "uppercut_der", "gancho_der")) == 2
    assert nivel_de(combo("jab", "gancho_izq", "rodar_der", "uppercut_der", "gancho_der", "salir", "gancho_izq")) == 3
    assert nivel_de(combo("bloqueo", "paso_atras", "pivote", "salir")) == 1  # sin golpe no es válida, pero tiene nivel


def test_como_mucho_10_acciones():
    assert MAX_ACCIONES == 10
    assert nivel_de(combo(*["jab", "directo"] * 5)) == 3
    assert nivel_de(combo(*["jab", "directo"] * 5, "salir")) is None


# ---------- Avisos del creador ----------

def _propias(*listas):
    return [{"id": f"p-{i}", "ids": list(ids)} for i, ids in enumerate(listas)]


def _tipos(resultado):
    return [a["tipo"] for a in resultado["avisos"]]


def test_una_combinacion_nueva_no_da_avisos_y_dice_su_nivel():
    r = avisos_creador(["jab", "directo", "rodar_izq", "directo", "gancho_izq"])
    assert r == {"nivel": 2, "avisos": [], "puede_guardar": True, "motivo": None}


def test_sin_golpes_avisa_pero_deja_guardar():
    r = avisos_creador(["esquiva_der", "paso_atras", "pivote"])
    assert _tipos(r) == ["sin_golpes"] and r["avisos"][0]["texto"] == "No lleva ningún golpe."
    assert r["puede_guardar"] and r["nivel"] == 1


def test_igual_que_una_de_la_biblioteca_dice_su_nivel():
    for c in biblioteca():
        r = avisos_creador([a.id for a in c.acciones])
        assert r["avisos"][0]["tipo"] == "biblioteca" and r["avisos"][0]["nivel"] == c.nivel == r["nivel"]
    r = avisos_creador(["jab", "directo"])
    assert r["avisos"] == [{"tipo": "biblioteca", "nivel": 1, "texto": "Ya está en la biblioteca, en nivel básico."}]


def test_igual_que_otra_propia_dice_cual_y_no_se_compara_consigo():
    propias = _propias(["jab", "jab"], ["bloqueo", "gancho_izq", "jab"], ["bloqueo", "gancho_izq", "jab"])
    r = avisos_creador(["bloqueo", "gancho_izq", "jab"], propias)
    assert r["avisos"] == [{"tipo": "propia", "numero": 2, "texto": "Es igual que tu combinación 2."}]
    assert avisos_creador(["bloqueo", "gancho_izq", "jab"], propias, editando="p-1")["avisos"][0]["numero"] == 3
    assert avisos_creador(["jab", "jab"], propias, editando="p-0")["avisos"] == []


def test_varios_avisos_a_la_vez():
    propias = _propias(["esquiva_der", "esquiva_izq"])
    assert _tipos(avisos_creador(["esquiva_der", "esquiva_izq"], propias)) == ["sin_golpes", "propia"]


@pytest.mark.parametrize("n, motivo", [
    (0, "Añade al menos 2 acciones."), (1, "Añade al menos 2 acciones."), (2, None), (10, None),
    (11, "Como mucho 10 acciones."),
])
def test_se_guarda_de_2_a_10_acciones(n, motivo):
    r = avisos_creador(["jab"] * n)
    assert r["motivo"] == motivo and r["puede_guardar"] == (motivo is None)


def test_como_mucho_20_propias_salvo_al_editar_una():
    propias = _propias(*[["jab", "directo", "jab"]] * MAX_PROPIAS)
    assert MAX_PROPIAS == 20
    lleno = avisos_creador(["jab", "gancho_izq"], propias)
    assert not lleno["puede_guardar"] and lleno["motivo"] == "Ya tienes 20 combinaciones: borra alguna para guardar otra."
    assert avisos_creador(["jab", "gancho_izq"], propias, editando="p-4")["puede_guardar"]
    assert avisos_creador(["jab", "gancho_izq"], propias[:19])["puede_guardar"]


def test_una_accion_desconocida_no_se_guarda():
    r = avisos_creador(["jab", "patada"])
    assert r == {"nivel": None, "avisos": [], "puede_guardar": False, "motivo": "Lleva una acción que la app no conoce."}
