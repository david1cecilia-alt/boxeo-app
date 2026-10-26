"""data/revisar.json refleja los puntos «REVISAR CON ENTRENADOR» del código y los datos."""
import json

from herramientas.extraer_revisar import SALIDA, contenido, extraer


def test_revisar_json_esta_al_dia():
    assert SALIDA.read_text(encoding="utf-8") == contenido(), \
        "Ejecuta: python herramientas/extraer_revisar.py"


def test_incluye_los_puntos_del_motor_y_de_los_datos():
    puntos = extraer()
    origenes = {p["origen"] for p in puntos}
    assert {"motor/reglas.py", "data/acciones.json"} <= origenes
    assert any("parada" in p["texto"] for p in puntos)
    assert len({p["id"] for p in puntos}) == len(puntos), "ids repetidos"


def test_cada_punto_tiene_texto():
    for p in json.loads(SALIDA.read_text(encoding="utf-8"))["puntos"]:
        assert p["texto"] and "REVISAR" not in p["texto"]
