"""El maniquí 3D (static/maniqui/maniqui.glb, de herramientas/blender/crear_maniqui_quaternius.py)
encaja con data/posturas.json: cada articulación mueve un hueso que existe y el esqueleto mide lo
mismo."""
import json
import math
import struct

import pytest

from herramientas.construir_sitio import RAIZ

GLB = RAIZ / "static" / "maniqui" / "maniqui.glb"
MATERIALES = {"piel", "espalda", "guante", "munequera", "bota", "suela", "pantalon", "cinturilla", "rojo"}  # escena.js


@pytest.fixture(scope="module")
def gltf():
    datos = GLB.read_bytes()
    magia, version, _ = struct.unpack_from("<4sII", datos, 0)
    assert magia == b"glTF" and version == 2
    largo, tipo = struct.unpack_from("<I4s", datos, 12)
    assert tipo == b"JSON"
    return json.loads(datos[20:20 + largo])


@pytest.fixture(scope="module")
def esqueleto():
    return json.loads((RAIZ / "data" / "posturas.json").read_text(encoding="utf-8"))["esqueleto"]


def test_es_un_glb_comprimido_con_draco_y_pequeno(gltf):
    assert "KHR_draco_mesh_compression" in gltf.get("extensionsRequired", [])
    assert GLB.stat().st_size < 150_000, GLB.stat().st_size


def test_la_piel_lleva_el_mapa_de_normales_del_musculo(gltf):
    # escena.js lo pasa a su material de piel y espalda.
    materiales = {m["name"]: m for m in gltf["materials"]}
    assert "normalTexture" in materiales["piel"]
    assert "normalTexture" in materiales["espalda"]


def test_tiene_unos_15000_triangulos(gltf):
    triangulos = sum(gltf["accessors"][p["indices"]]["count"] // 3
                     for m in gltf["meshes"] for p in m["primitives"])
    assert 12_000 < triangulos < 18_000, triangulos


def test_usa_los_materiales_que_cambia_la_escena(gltf):
    assert {m["name"] for m in gltf["materials"]} <= MATERIALES


def test_lleva_pantalon_con_cinturilla(gltf):
    # La app es pública: el maniquí va siempre con pantalón de boxeo.
    assert {"pantalon", "cinturilla"} <= {m["name"] for m in gltf["materials"]}


def _cuaternion(q, v):
    x, y, z, w = q
    tx, ty, tz = 2 * (y * v[2] - z * v[1]), 2 * (z * v[0] - x * v[2]), 2 * (x * v[1] - y * v[0])
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]


def _producto(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz]


def _posiciones(gltf):
    """Posición en el mundo de cada nodo en el reposo (sin escalas: el GLB no las lleva)."""
    mundo = {}

    def bajar(indice, pos, giro):
        nodo = gltf["nodes"][indice]
        assert nodo.get("scale", [1, 1, 1]) == pytest.approx([1, 1, 1])
        t = _cuaternion(giro, nodo.get("translation", [0, 0, 0]))
        pos = [p + d for p, d in zip(pos, t)]
        giro = _producto(giro, nodo.get("rotation", [0, 0, 0, 1]))
        mundo[nodo.get("name")] = pos
        for hijo in nodo.get("children", []):
            bajar(hijo, pos, giro)

    for raiz in gltf["scenes"][gltf.get("scene", 0)]["nodes"]:
        bajar(raiz, [0, 0, 0], [0, 0, 0, 1])
    return mundo


def test_cada_articulacion_mueve_un_hueso_del_glb(gltf, esqueleto):
    huesos = {gltf["nodes"][j]["name"] for s in gltf["skins"] for j in s["joints"]}
    pedidos = {a["hueso"] for a in esqueleto.values() if "hueso" in a}
    assert pedidos <= huesos, pedidos - huesos
    # Las que no mueven hueso son los extremos: puño, punta de la bota y ojos (para medir la guardia).
    assert {n.split("_")[0] for n, a in esqueleto.items() if "hueso" not in a} == {"puno", "punta", "ojos"}


def test_el_esqueleto_de_las_posturas_mide_lo_mismo_que_el_glb(gltf, esqueleto):
    # Si se regenera el GLB sin reescribir data/posturas.json, los puños no llegan a su sitio.
    mundo = _posiciones(gltf)
    for nombre, a in esqueleto.items():
        padre = a["padre"]
        if padre is None or "hueso" not in a:
            continue
        medido = [h - p for h, p in zip(mundo[a["hueso"]], mundo[esqueleto[padre]["hueso"]])]
        assert math.dist(medido, a["desde"]) < 0.002, f"{nombre}: {medido} ≠ {a['desde']}"
