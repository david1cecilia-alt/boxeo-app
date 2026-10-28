"""Crea el maniquí 3D de Aprende (static/maniqui/maniqui.glb) con MPFB (MakeHuman para Blender).

Cuerpo masculino de 1,86 m, atlético y en V, con el esqueleto «game engine» de MakeHuman,
convertido en maniquí de dibujo: blanco mate, cabeza de maniquí (mandíbula, mentón, nariz y orejas
lisos, sin ojos ni boca) sobre un cuello de maniquí, guantes gris oscuro, botas ajustadas de suela
fina, pantalón de boxeo ajustado (negro con cinturilla roja) y un punto rojo en hombros, codos y
rodillas. Brazos y piernas cuelgan rectos en el reposo, que es
el de data/posturas.json (ángulos a cero). Exporta un GLB comprimido con Draco y escribe en
data/posturas.json las medidas del esqueleto y el hueso del GLB que mueve cada articulación;
luego recalcula los ángulos (herramientas/ajustar_posturas.mjs, necesita node).

Uso: blender --background --python herramientas/blender/crear_maniqui.py
(con MPFB instalado y activado desde extensions.blender.org; sin --factory-startup, que lo apaga)
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

try:
    from bl_ext.blender_org.mpfb.entities.objectproperties import HumanObjectProperties
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.targetservice import TargetService
except ImportError:
    sys.exit("Falta MPFB: blender --online-mode --command extension install mpfb --enable")

RAIZ = Path(__file__).resolve().parents[2]
GLB = RAIZ / "static" / "maniqui" / "maniqui.glb"
POSTURAS = RAIZ / "data" / "posturas.json"
AJUSTAR = RAIZ / "herramientas" / "ajustar_posturas.mjs"

ALTURA = 1.86
# Macros de MakeHuman (0…1): hombre adulto joven, musculado y delgado, proporciones «ideales».
MACROS = {
    "gender": 1.0, "age": 0.5, "muscle": 1.0, "weight": 0.5, "proportions": 1.0, "height": 0.7,
    "cupsize": 0.5, "firmness": 0.5, "race": {"asian": 0.33, "caucasian": 0.34, "african": 0.33},
}
# Forma atlética en V, como el maniquí de la referencia: más masa muscular sin grasa, espalda y
# hombros anchos, cintura, cadera y glúteos estrechos, brazos y piernas algo más gruesos. Se carga
# después de colocar el esqueleto (que se ajusta al cuerpo de MACROS): así ninguna articulación se
# mueve y data/posturas.json sigue valiendo. {l} es cada lado (l, r).
FORMA_MACROS = {"weight": 0.62}
FORMA = {
    "torso-vshape-incr": 1.0, "torso-muscle-dorsi-incr": 0.8, "torso-muscle-pectoral-incr": 0.5,
    "measure-waist-circ-decr": 0.5, "hip-scale-horiz-decr": 0.5, "buttocks-volume-decr": 0.8,
    "{l}-upperarm-shoulder-muscle-incr": 0.8, "{l}-upperarm-muscle-incr": 0.6, "{l}-lowerarm-muscle-incr": 0.5,
    "{l}-upperleg-muscle-incr": 0.5, "{l}-lowerleg-muscle-incr": 0.4, "{l}-upperarm-fat-decr": 1.0,
    "{l}-lowerarm-fat-decr": 1.0, "{l}-upperleg-fat-decr": 1.0, "{l}-lowerleg-fat-decr": 1.0,
    "measure-upperarm-circ-incr": 0.3, "measure-thigh-circ-incr": 0.3, "measure-calf-circ-incr": 0.2,
    "measure-neck-circ-decr": 0.6,  # cuello de maniquí, más estrecho que la mandíbula
}
TRIANGULOS = 15_000  # objetivo del maniquí entero (cuerpo diezmado + piezas)

# Articulación de data/posturas.json → hueso del esqueleto game engine (lado izquierdo; el
# derecho cambia _l por _r). puno y punta son extremos: no mueven ningún hueso.
HUESOS = {
    "pelvis": "pelvis", "columna": "spine_01", "pecho": "spine_03", "cuello": "neck_01",
    "cabeza": "head", "hombro": "upperarm", "codo": "lowerarm", "muneca": "hand",
    "cadera": "thigh", "rodilla": "calf", "tobillo": "foot",
}
LADOS = {"izq": "l", "der": "r"}
DEDOS = ("thumb", "index", "middle", "ring", "pinky")
PUNO = 0.09  # del centro de la muñeca al centro del puño (como el maniquí anterior)

GRIS_GUANTE = (0.165, 0.165, 0.165)
GRIS_MUNEQUERA = (0.24, 0.24, 0.24)
BLANCO = (0.92, 0.91, 0.89)
ROJO = (1.0, 0.23, 0.19)
NEGRO_PANTALON = (0.0103, 0.0103, 0.0103)  # #1A1A1A (lineal)
ROJO_CINTURILLA = (0.680, 0.0097, 0.0232)  # #D7192A (lineal)
GRIS_SUELA = (0.069, 0.069, 0.069)  # #4A4A4A (lineal)

# Pantalón: de la cintura (sobre la cadera) a medio muslo, ajustado.
CINTURA = 0.1     # m por encima de la articulación de la cadera
BAJO = 0.23       # m por debajo
CINTURILLA = 0.045
CANA_BOTA = 0.16  # m por encima del tobillo
SUELA = 0.012


# ---------- Coordenadas ----------
# El maniquí (data/posturas.json, Three.js) usa Y arriba y el rival en +Z; Blender, Z arriba y
# el frente en −Y. La izquierda del maniquí es +X en los dos.
def a_three(v):
    return Vector((v.x, v.z, -v.y))


def a_blender(v):
    return Vector((v[0], -v[2], v[1]))


def hueso(articulacion: str) -> str | None:
    base, _, lado = articulacion.partition("_")
    if base not in HUESOS:
        return None
    return HUESOS[base] + (f"_{LADOS[lado]}" if lado else "")


# ---------- Utilidades de Blender ----------
def activar(objeto, modo="OBJECT"):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = objeto
    objeto.select_set(True)
    if modo != "OBJECT":
        bpy.ops.object.mode_set(mode=modo)


def vaciar_escena():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    for coleccion in (bpy.data.meshes, bpy.data.armatures, bpy.data.materials):
        for d in list(coleccion):
            coleccion.remove(d)


def puntos_cuerpo(malla):
    """Vértices evaluados (con macros y sin los ayudantes ocultos por el modificador MASK)."""
    evaluado = malla.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return [malla.matrix_world @ v.co for v in evaluado.to_mesh().vertices]


def dominante(vertice, capa, nombres):
    """Hueso con más peso en el vértice (o None)."""
    pesos = [(w, nombres[g]) for g, w in vertice[capa].items() if g in nombres]
    return max(pesos)[1] if pesos else None


# ---------- 1. Cuerpo ----------
def crear_cuerpo():
    # Una primera pasada mide la altura con las macros; la segunda la escala a ALTURA.
    prueba = HumanService.create_human(macro_detail_dict=MACROS)
    zs = [p.z for p in puntos_cuerpo(prueba)]
    escala = 0.1 * ALTURA / (max(zs) - min(zs))
    vaciar_escena()
    cuerpo = HumanService.create_human(macro_detail_dict=MACROS, scale=escala)
    esqueleto = HumanService.add_builtin_rig(cuerpo, "game_engine")
    # La forma, con el esqueleto ya puesto (sin reajustarlo).
    for nombre, valor in FORMA_MACROS.items():
        HumanObjectProperties.set_value(nombre, valor, entity_reference=cuerpo)
    TargetService.reapply_macro_details(cuerpo)
    for nombre, valor in FORMA.items():
        for lado in (LADOS.values() if "{l}" in nombre else ("",)):
            ruta = TargetService.target_full_path(nombre.format(l=lado))
            assert ruta, f"Falta el target {nombre}"
            TargetService.load_target(cuerpo, ruta, weight=valor)
    # Suelta la malla del esqueleto (se vuelve a emparentar al final): así se mueven por separado.
    mundo = cuerpo.matrix_world.copy()
    cuerpo.parent = None
    cuerpo.matrix_world = mundo
    # Hornea las macros (shape keys) y quita los ayudantes; el modificador de esqueleto se
    # pone de nuevo al colgar los brazos.
    activar(cuerpo)
    for m in list(cuerpo.modifiers):
        if m.type == "ARMATURE":
            cuerpo.modifiers.remove(m)
    bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    bpy.ops.object.modifier_apply(modifier="Hide helpers")
    return cuerpo, esqueleto


# ---------- 2. Reposo: brazos y piernas colgando ----------
def colgar(cuerpo, esqueleto):
    """Brazos y piernas rectos hacia abajo (palmas hacia el muslo, pulgar delante) y pies como
    estaban. Esa pose pasa a ser el reposo de malla y esqueleto."""
    abajo = Vector((0, 0, -1))
    activar(esqueleto, "POSE")
    huesos = esqueleto.pose.bones
    for lado in LADOS.values():
        planta = esqueleto.data.bones[f"foot_{lado}"].matrix_local.to_3x3()
        for nombre in (f"upperarm_{lado}", f"lowerarm_{lado}", f"hand_{lado}",
                       f"thigh_{lado}", f"calf_{lado}", f"foot_{lado}"):
            bpy.context.view_layer.update()
            pb = huesos[nombre]
            if nombre.startswith("foot"):
                giro = planta
            elif nombre.startswith("hand"):
                # La mano sigue al antebrazo: se queda con su giro respecto a él.
                continue
            else:
                giro = (pb.tail - pb.head).normalized().rotation_difference(abajo).to_matrix() @ pb.matrix.to_3x3()
            pb.matrix = Matrix.Translation(pb.head) @ giro.to_4x4()
    bpy.context.view_layer.update()

    activar(cuerpo)
    modificador = cuerpo.modifiers.new("Esqueleto", "ARMATURE")
    modificador.object = esqueleto
    bpy.ops.object.modifier_apply(modifier=modificador.name)
    activar(esqueleto, "POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    # Que las botas pisen el suelo: el pie bajó al estirar la pierna.
    suelo = min(v.co.z for v in cuerpo.data.vertices)
    for o in (cuerpo, esqueleto):
        o.location.z -= suelo
    for o in (esqueleto, cuerpo):
        activar(o)
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)


def medir(esqueleto):
    """Posición (Blender) de cada articulación de data/posturas.json en el reposo, simétrica."""
    cabezas = {b.name: esqueleto.matrix_world @ b.head_local for b in esqueleto.data.bones}
    pos = {}
    for articulacion in ("pelvis", "columna", "pecho", "cuello", "cabeza"):
        p = cabezas[hueso(articulacion)]
        pos[articulacion] = Vector((0, p.y, p.z))
    for base in ("hombro", "codo", "muneca", "cadera", "rodilla", "tobillo"):
        i, d = cabezas[hueso(f"{base}_izq")], cabezas[hueso(f"{base}_der")]
        medio = Vector(((i.x - d.x) / 2, (i.y + d.y) / 2, (i.z + d.z) / 2))
        pos[f"{base}_izq"] = medio
        pos[f"{base}_der"] = Vector((-medio.x, medio.y, medio.z))
    return pos


def fundir_bolas(cuerpo):
    """Los dedos del pie (ball_*) no van al GLB: su peso pasa al pie."""
    for lado in LADOS.values():
        bola, pie = cuerpo.vertex_groups[f"ball_{lado}"], cuerpo.vertex_groups[f"foot_{lado}"]
        pesos = [(v.index, g.weight) for v in cuerpo.data.vertices for g in v.groups
                 if g.group == bola.index and g.weight > 0]
        for indice, peso in pesos:
            pie.add([indice], peso, "ADD")
        cuerpo.vertex_groups.remove(bola)


# ---------- 3. Fundas: pantalón y botas ----------
def funda(cuerpo, esqueleto, nombre, elegir, separacion, pasadas, bordes):
    """Copia de la piel (los vértices que `elegir(co, hueso)` acepta) separada `separacion(co)` m
    hacia fuera y suavizada `pasadas` veces, sin meterse en el cuerpo: tapa sin marcar la
    anatomía. Lleva los pesos de la piel, así que se mueve con ella. Los bordes no se suavizan
    (encogerían y dejarían ver la piel): se llevan a la altura más cercana de `bordes`, para que
    el corte salga recto. Devuelve el objeto y la altura original de cada vértice."""
    arbol = BVHTree.FromObject(cuerpo, bpy.context.evaluated_depsgraph_get())
    nombres = {g.index: g.name for g in cuerpo.vertex_groups if g.name in esqueleto.data.bones}
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    capa = bm.verts.layers.deform.active
    fuera = [v for v in bm.verts if not elegir(v.co, dominante(v, capa, nombres) or "")]
    bmesh.ops.delete(bm, geom=fuera, context="VERTS")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    original = {v: v.co.copy() for v in bm.verts}
    bm.normal_update()
    for v in bm.verts:
        v.co = original[v] + v.normal * separacion(original[v])
        if v.is_boundary:
            v.co.z = min(bordes, key=lambda z: abs(z - original[v].z))

    interior = [v for v in bm.verts if not v.is_boundary]
    for _ in range(pasadas):
        bmesh.ops.smooth_vert(bm, verts=interior, factor=0.5,
                              use_axis_x=True, use_axis_y=True, use_axis_z=True)
        for v in interior:
            cerca, normal, _, _ = arbol.find_nearest(v.co)
            minimo = 0.7 * separacion(original[v])
            if (v.co - cerca).dot(normal) < minimo:
                v.co = cerca + normal * minimo
    bm.verts.index_update()
    alturas = {v.index: original[v].z for v in bm.verts}
    malla = bpy.data.meshes.new(nombre)
    bm.to_mesh(malla)
    bm.free()
    objeto = bpy.data.objects.new(nombre, malla)
    bpy.context.collection.objects.link(objeto)
    for g in cuerpo.vertex_groups:
        objeto.vertex_groups.new(name=g.name)
    for p in malla.polygons:
        p.use_smooth = True
    return objeto, alturas


def pantalon(cuerpo, esqueleto, pos, mats):
    """Pantalón corto ajustado a la cadera y los muslos: negro con cinturilla roja. Pocas pasadas
    de suavizado (no hace puente entre glúteo y muslo) y los pesos de la piel: la pernera sigue
    al muslo y no se abre al echar la pierna atrás."""
    cadera = pos["cadera_izq"].z
    arriba, abajo = cadera + CINTURA, cadera - BAJO
    zona = {"pelvis", "spine_01", "spine_02", "thigh_l", "thigh_r"}

    def holgura(co):
        t = min(1.0, max(0.0, (arriba - co.z) / (arriba - abajo)))
        return 0.008 + 0.004 * t * t

    objeto, alturas = funda(cuerpo, esqueleto, "pantalon",
                            lambda co, h: h in zona and abajo - 0.02 <= co.z <= arriba + 0.02, holgura, 4,
                            (arriba, abajo))
    objeto.data.materials.append(mats["pantalon"])
    objeto.data.materials.append(mats["cinturilla"])
    for f in objeto.data.polygons:
        f.material_index = int(sum(alturas[i] for i in f.vertices) / len(f.vertices) > arriba - CINTURILLA)
    return objeto


def seccion(y, cx, ancho, abajo, arriba, puntos, exponente):
    """Anillo de una sección del pie (plano XZ a la altura `y`): superelipse de `ancho` entre
    `abajo` y `arriba`, con la parte de abajo plana."""
    a, b = ancho / 2, (arriba - abajo) / 2
    cz = (arriba + abajo) / 2
    anillo = []
    for k in range(puntos):
        th = 2 * math.pi * k / puntos
        c, s = math.cos(th), math.sin(th)
        x = cx + a * math.copysign(abs(c) ** (2 / exponente), c)
        z = cz + b * math.copysign(abs(s) ** (2 / exponente), s)
        anillo.append(Vector((x, y, max(z, abajo))))
    return anillo


def tubo(bm, anillos):
    """Une anillos consecutivos y cierra los extremos con un vértice."""
    verts = [[bm.verts.new(p) for p in a] for a in anillos]
    n = len(verts[0])
    for a, b in zip(verts, verts[1:]):
        for k in range(n):
            bm.faces.new((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    for extremo, sentido in ((verts[0], -1), (verts[-1], 1)):
        centro = sum((v.co for v in extremo), Vector()) / n
        polo = bm.verts.new(centro)
        for k in range(n):
            par = (extremo[k], extremo[(k + 1) % n])
            bm.faces.new((polo, *par) if sentido > 0 else (polo, *reversed(par)))


def perfil_pie(cuerpo, esqueleto, lado, tobillo, y_tobillo):
    """Del pie del cuerpo, por cortes de talón a punta: [y, centro x, ancho, alto], suavizado.
    Detrás del tobillo el alto se queda en el tobillo: el talón no hace bulto."""
    nombres = {g.index: g.name for g in cuerpo.vertex_groups if g.name in esqueleto.data.bones}
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    capa = bm.verts.layers.deform.active
    pie = [v.co.copy() for v in bm.verts if dominante(v, capa, nombres) == f"foot_{lado}"]
    bm.free()
    talon, punta = max(p.y for p in pie), min(p.y for p in pie)
    cortes = 14
    perfil = []
    for k in range(cortes + 1):
        y = talon + (punta - talon) * k / cortes
        cerca = [p for p in pie if abs(p.y - y) < 0.6 * abs(punta - talon) / cortes] or perfil[-1][4]
        xs = [p.x for p in cerca]
        perfil.append([y, (max(xs) + min(xs)) / 2, max(xs) - min(xs),
                       min(max(p.z for p in cerca), tobillo + (0.0 if y > y_tobillo else 0.02)), cerca])
    for _ in range(5):  # media móvil: sin escalones
        perfil = [[f[0]] + [(a[i] + f[i] + b[i]) / 3 for i in (1, 2, 3)] + [f[4]]
                  for a, f, b in zip([perfil[0]] + perfil[:-1], perfil, perfil[1:] + [perfil[-1]])]
    return [f[:4] for f in perfil]


def botas(cuerpo, esqueleto, pos, mats):
    """Botas estilizadas: la caña pegada al tobillo (funda de la pierna) y un pie liso con la
    forma del pie del cuerpo (sin dedos ni arco) sobre una suela fina algo más ancha."""
    tobillo = pos["tobillo_izq"].z
    techo = tobillo + CANA_BOTA
    objeto, _ = funda(
        cuerpo, esqueleto, "botas",
        lambda co, h: h.startswith("calf_") and tobillo - 0.03 <= co.z <= techo + 0.02,
        lambda co: 0.004, 3, (techo, tobillo - 0.03))
    objeto.data.materials.append(mats["bota"])
    objeto.data.materials.append(mats["suela"])
    piezas = [objeto]
    for lado in LADOS.values():
        perfil = perfil_pie(cuerpo, esqueleto, lado, tobillo, pos["tobillo_izq"].y)
        bm = bmesh.new()
        # El pie: algo más ancho y alto que el del cuerpo; los extremos, redondeados.
        anillos = [seccion(y, cx, ancho + 0.012, SUELA, alto + 0.006, 20, 3.0) for y, cx, ancho, alto in perfil]
        tubo(bm, anillos)
        pie = pieza(f"pie_{lado}", bm, mats["bota"], {f"foot_{lado}": 1.0})
        # Suela: 1,2 cm, un poco más ancha y larga que el pie.
        bm = bmesh.new()
        largo = perfil[-1][0] - perfil[0][0]
        anillos = [seccion(y + math.copysign(0.004, largo) * (1 if i == len(perfil) - 1 else -1 if i == 0 else 0),
                           cx, ancho + 0.016, 0.0, SUELA, 20, 6.0)
                   for i, (y, cx, ancho, _) in enumerate(perfil)]
        tubo(bm, anillos)
        suela = pieza(f"suela_{lado}", bm, mats["suela"], {f"foot_{lado}": 1.0})
        piezas += [pie, suela]
    return piezas


# ---------- 4. Recorte: fuera manos, pies, cara y lo que tapan las fundas ----------
ESCALA_CABEZA = 0.92  # algo más pequeña que la de MakeHuman: unas 8 cabezas de alto

# Rasgos de la cara de maniquí, lisos, sin ojos ni boca: bultos (+) y huecos (−) a lo largo del
# radio del huevo. [acimut, elevación, ancho en acimut, ancho en elevación (grados), metros];
# acimut 0 = de frente y + hacia la izquierda del maniquí (se repiten en espejo), elevación 0 =
# el centro del huevo, a la altura de los ojos.
RASGOS = [
    (0, 90, 1000, 30, -0.012),   # coronilla redonda, no en punta
    (80, 28, 40, 30, 0.009),     # cráneo ancho por encima de las orejas
    (0, -64, 15, 11, 0.011),     # mentón
    (62, -44, 13, 11, 0.009),    # ángulo de la mandíbula
    (34, -56, 22, 8, 0.004),     # línea de la mandíbula
    (36, -14, 13, 9, 0.004),     # pómulo
    (17, 11, 17, 6, 0.005),      # arco de la ceja
    (19, -1, 10, 7, -0.008),     # cuenca del ojo
    (60, 18, 12, 14, -0.003),    # sien
    (42, -34, 11, 9, -0.004),    # bajo el pómulo
]
# Nariz: [altura respecto a los ojos, cuánto sale, ancho] de la raíz a la base, en metros.
NARIZ = [[0.004, 0.0, 0.016], [-0.002, 0.003, 0.017], [-0.011, 0.006, 0.019], [-0.021, 0.01, 0.021],
         [-0.03, 0.013, 0.025], [-0.036, 0.014, 0.03], [-0.041, 0.01, 0.034], [-0.045, 0.004, 0.03],
         [-0.047, 0.0, 0.02]]
OREJA = Vector((0.007, 0.017, 0.03))  # radios: grosor, fondo, alto


class Huevo:
    """La cabeza de maniquí: un elipsoide del tamaño del cráneo con la mandíbula más estrecha y
    los RASGOS de la cara."""

    def __init__(self, craneo):
        self.alto = craneo["arriba"] - craneo["barbilla"]
        self.centro = Vector((0, (craneo["atras"] + craneo["frente"]) / 2 + 0.006,
                              (craneo["arriba"] + craneo["barbilla"]) / 2))
        self.radios = Vector((craneo["ancho"] * 0.5, (craneo["atras"] - craneo["frente"]) / 2, self.alto / 2))
        self.estrechar = [0.3, 0.4, 0.1]  # x, y detrás, y delante, en la barbilla
        self.escala = 1.0

    def escalar(self, k, pivote):
        self.centro = pivote + (self.centro - pivote) * k
        self.radios *= k
        self.escala *= k

    def factores(self, z):
        """Estrechamiento [x, y detrás, y delante] a la altura `z` (relativa al centro)."""
        t = max(0.0, -z / self.radios.z) ** 2
        return tuple(1 - k * t for k in self.estrechar)

    def relieve(self, p):
        """Metros que sale (o entra) la cara en el punto `p` de la esfera de radios `radios`."""
        u = Vector((p.x / self.radios.x, p.y / self.radios.y, p.z / self.radios.z))
        acimut = math.degrees(math.atan2(u.x, -u.y))
        elevacion = math.degrees(math.asin(max(-1.0, min(1.0, u.z))))
        total = 0.0
        for az, el, ancho_az, ancho_el, metros in RASGOS:
            for s in ((1, -1) if az else (1,)):
                total += metros * math.exp(-((acimut - s * az) / ancho_az) ** 2 - ((elevacion - el) / ancho_el) ** 2)
        return total * self.escala

    def deformar(self, p):
        x, atras, delante = self.factores(p.z)
        q = Vector((p.x * x, p.y * (atras if p.y > 0 else delante), p.z))
        return q + q.normalized() * self.relieve(p)


# La piel del cuello se corta algo por encima de su articulación, perpendicular al cuello (que va
# hacia delante: el corte queda más bajo en la garganta que en la nuca); de ahí arriba va el
# cuello de maniquí (cuello_maniqui), que entra en la cabeza.
CORTE_CUELLO = 0.04


def recortar(cuerpo, esqueleto, pos):
    """Borra lo que tapan guantes, botas, pantalón y cabeza de maniquí (con un margen bajo los
    bordes de las fundas). Devuelve las medidas del pie, el huevo de la cabeza y el corte del
    cuello (centro, eje y radios)."""
    nombres = {g.index: g.name for g in cuerpo.vertex_groups if g.name in esqueleto.data.bones}
    orejas = cuerpo.vertex_groups["ears"].index
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    capa = bm.verts.layers.deform.active
    grupo = {v: dominante(v, capa, nombres) or "" for v in bm.verts}

    # Medidas del cráneo (sin orejas) antes de borrar nada.
    cabeza = [v.co.copy() for v in bm.verts if grupo[v] == "head" and orejas not in v[capa]]
    arriba = max(p.z for p in cabeza)
    barbilla = min(p.z for p in cabeza if abs(p.x) < 0.02 and p.y < -0.06)
    huevo = Huevo({
        "arriba": arriba, "barbilla": barbilla,
        "ancho": 2 * max(abs(p.x) for p in cabeza),
        "atras": max(p.y for p in cabeza),
        "frente": min(p.y for p in cabeza if arriba - 0.09 < p.z < arriba - 0.05),
    })
    huevo.escalar(ESCALA_CABEZA, pos["cabeza"])
    pies = [v.co.y for v in bm.verts if grupo[v].startswith("foot_l")]
    pie = {"talon": max(pies), "punta": min(pies)}

    cadera = pos["cadera_izq"].z
    tapado = {"pelvis", "spine_01", "spine_02", "thigh_l", "thigh_r"}
    eje = (pos["cabeza"] - pos["cuello"]).normalized()
    corte = pos["cuello"] + eje * CORTE_CUELLO

    def sobre_el_corte(co):
        return (co - corte).dot(eje)

    def sobra(v):
        g = grupo[v]
        if g.startswith(("hand_", "foot_") + DEDOS):
            return True
        if g.startswith("lowerarm_"):
            # Lo que pasa de la muñeca: asomaría entre la muñequera y el guante.
            return v.co.z < pos["muneca_izq"].z + 0.005
        if g.startswith("calf_"):
            # Lo que queda dentro de la caña de la bota.
            return v.co.z < pos["tobillo_izq"].z + CANA_BOTA - 0.07
        if g in tapado:
            # Pantalón ajustado: la piel, hasta casi el borde de la cinturilla (si no, asoma al
            # doblarse, sobre todo en la curva de los riñones).
            return cadera - BAJO + 0.04 < v.co.z < cadera + CINTURA - 0.004
        if g == "neck_01":
            return sobre_el_corte(v.co) > 0
        if g == "head":
            # La garganta se queda (pesa a la cabeza); la barbilla de MakeHuman, no.
            return sobre_el_corte(v.co) > 0 or v.co.y < pos["cuello"].y - 0.085
        return False

    bmesh.ops.delete(bm, geom=[v for v in bm.verts if sobra(v)], context="VERTS")
    borde = [v.co for v in bm.verts if v.is_boundary and abs(sobre_el_corte(v.co)) < 0.008 and abs(v.co.x) < 0.1]
    centro = sum(borde, Vector()) / len(borde)
    centro = corte + (centro - corte) - eje * sobre_el_corte(centro)  # en el plano del corte
    lateral = Vector((1, 0, 0))
    fondo = lateral.cross(eje)
    radios = (max(abs((p - centro).dot(lateral)) for p in borde) + 0.003,
              max(abs((p - centro).dot(fondo)) for p in borde) + 0.003)
    print(f"Corte del cuello: {len(borde)} vértices, {radios[0] * 200:.1f} × {radios[1] * 200:.1f} cm")
    cuello = {"centro": centro, "eje": eje, "lateral": lateral, "fondo": fondo, "radios": radios}
    # Restos sueltos (uñas, islas pequeñas).
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(cuerpo.data)
    bm.free()
    return pie, huevo, cuello


def diezmar(cuerpo, triangulos):
    activar(cuerpo)
    actuales = sum(len(p.vertices) - 2 for p in cuerpo.data.polygons)
    m = cuerpo.modifiers.new("Diezmar", "DECIMATE")
    m.ratio = min(1.0, triangulos / actuales)
    m.use_symmetry = True
    m.symmetry_axis = "X"
    # El diezmado se queda algo corto: se corrige la proporción con lo que sale de verdad.
    for _ in range(3):
        bpy.context.view_layer.update()
        evaluado = cuerpo.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
        salen = sum(len(p.vertices) - 2 for p in evaluado.polygons)
        m.ratio = min(1.0, m.ratio * triangulos / salen)
    bpy.ops.object.modifier_apply(modifier=m.name)


# ---------- 5. Piezas ----------
def catmull_rom(puntos, divisiones):
    """Como THREE.SplineCurve.getPoints(): Catmull-Rom uniforme por los puntos."""
    n = len(puntos) - 1
    salida = []
    for k in range(divisiones + 1):
        p = n * k / divisiones
        i = min(int(p), n - 1)
        t = p - i
        p0, p1, p2, p3 = (Vector(puntos[max(0, min(n, j))]) for j in (i - 1, i, i + 1, i + 2))
        v0, v1 = (p2 - p0) * 0.5, (p3 - p1) * 0.5
        salida.append((2 * p1 - 2 * p2 + v0 + v1) * t ** 3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t ** 2 + v0 * t + p1)
    return salida


def torneado(bm, perfil, segmentos, divisiones, transformar):
    """Pieza de revolución alrededor de Y (coordenadas del maniquí) con el perfil [radio, y]
    suavizado; `transformar` lleva cada punto a Blender. Cierra los polos."""
    anillos = []
    for p in catmull_rom(perfil, divisiones):
        r = max(0.0, p.x)
        anillo = [bm.verts.new(transformar(Vector((r * math.cos(a), p.y, r * math.sin(a)))))
                  for a in (2 * math.pi * s / segmentos for s in range(segmentos))]
        anillos.append(anillo)
    for a, b in zip(anillos, anillos[1:]):
        for s in range(segmentos):
            bm.faces.new((a[s], a[(s + 1) % segmentos], b[(s + 1) % segmentos], b[s]))
    bmesh.ops.remove_doubles(bm, verts=[v for anillo in anillos for v in anillo], dist=1e-5)


def esfera(bm, centro, radios, segmentos, anillos, deformar=None):
    nuevos = bmesh.ops.create_uvsphere(bm, u_segments=segmentos, v_segments=anillos, radius=1.0)["verts"]
    for v in nuevos:
        p = Vector((v.co.x * radios[0], v.co.y * radios[1], v.co.z * radios[2]))
        v.co = centro + (deformar(p) if deformar else p)
    return nuevos


def pieza(nombre, bm, material, pesos):
    """Objeto de malla con `pesos` {hueso: peso} en todos sus vértices (normales hacia fuera)."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    malla = bpy.data.meshes.new(nombre)
    bm.to_mesh(malla)
    bm.free()
    objeto = bpy.data.objects.new(nombre, malla)
    bpy.context.collection.objects.link(objeto)
    malla.materials.append(material)
    for p in malla.polygons:
        p.use_smooth = True
    indices = [v.index for v in malla.vertices]
    for nombre_hueso, peso in pesos.items():
        objeto.vertex_groups.new(name=nombre_hueso).add(indices, peso, "REPLACE")
    return objeto


# Perfiles [radio, y] en metros en el marco de la articulación (el hueso sale hacia −Y), los
# mismos que tenía el maniquí hecho por código.
PERFIL_PUNO = [[0, -0.195], [0.06, -0.188], [0.086, -0.165], [0.097, -0.12], [0.095, -0.07],
               [0.083, -0.03], [0.064, -0.005], [0, 0]]
PERFIL_MUNEQUERA = [[0, -0.005], [0.058, 0], [0.057, 0.05], [0.053, 0.09], [0.04, 0.095], [0, 0.095]]


# Guante de 14 oz algo generoso: 13 cm de grosor (de la palma al dorso, X en el reposo: la palma
# mira al muslo), 15 de ancho (de nudillo a nudillo, Z) y 18 de la muñeca a la punta. La mano de
# MakeHuman mide 9 cm de grueso con los dedos estirados: cabe con relleno.
GUANTE = Vector((0.67, 0.92, 0.77))  # escala de PERFIL_PUNO en X, largo y Z


def guante(lado, muneca, materiales):
    """Puño (del ancho de la cara), muñequera y pulgar, todo en el hueso de la mano."""
    s = 1 if lado == "l" else -1
    origen = a_three(muneca)
    bm = bmesh.new()
    # Junto a la muñeca, casi del grosor de la muñequera: el guante no se estrecha ahí.
    def forma(p):
        cerca = min(1.0, max(0.0, (p.y + 0.05) / 0.045))
        return Vector((p.x * (GUANTE.x + (0.95 - GUANTE.x) * cerca), p.y * GUANTE.y, p.z * GUANTE.z))
    torneado(bm, PERFIL_PUNO, 24, 18, lambda p: a_blender(origen + forma(p)))
    puno = pieza(f"guante_{lado}", bm, materiales["guante"], {f"hand_{lado}": 1.0})
    bm = bmesh.new()
    torneado(bm, PERFIL_MUNEQUERA, 24, 8, lambda p: a_blender(origen + p))
    munequera = pieza(f"munequera_{lado}", bm, materiales["munequera"], {f"hand_{lado}": 1.0})
    # Pulgar: cápsula pegada al puño, por el lado de la palma y hacia delante.
    giro = Matrix.Rotation(0.4, 3, "X") @ Matrix.Rotation(s * 0.25, 3, "Z")
    centro = origen + Vector((-s * 0.07, -0.066, 0.03))
    bm = bmesh.new()

    def capsula(p):
        q = Vector((p.x, p.y + math.copysign(0.025, p.y), p.z))
        return a_blender(giro @ q)
    esfera(bm, a_blender(centro), (0.021, 0.021, 0.021), 12, 8, capsula)
    pulgar = pieza(f"pulgar_{lado}", bm, materiales["guante"], {f"hand_{lado}": 1.0})
    return [puno, munequera, pulgar]


def cabeza_maniqui(huevo, materiales):
    """El huevo con los rasgos, la nariz (una pieza de anillos horizontales hundida en la cara) y
    las orejas (elipsoides planos con el lado de fuera algo hundido), todo en el hueso de la
    cabeza. Nariz y orejas se colocan sobre la superficie del huevo con rayos."""
    bm = bmesh.new()
    esfera(bm, huevo.centro, huevo.radios, 40, 28, huevo.deformar)
    arbol = BVHTree.FromBMesh(bm)
    piezas = [pieza("cabeza", bm, materiales["piel"], {"head": 1.0})]
    k = huevo.escala
    c = huevo.centro

    hundir = 0.006 * k
    anillos = []
    for dz, sale, ancho in catmull_rom(NARIZ, 16):
        z = c.z + dz * k
        cara, _, _, _ = arbol.ray_cast(Vector((0, c.y - 1, z)), Vector((0, 1, 0)))
        a, b = max(ancho, 0.004) * k / 2, max(sale, 0.0) * k / 2 + hundir
        centro_y = cara.y - max(sale, 0.0) * k + b  # el frente sale `sale`; el resto, dentro de la cara
        anillo = []
        for i in range(14):
            t = 2 * math.pi * i / 14
            delante = max(0.0, -math.sin(t))  # el lomo de la nariz, algo más estrecho
            anillo.append(Vector((a * math.cos(t) * (1 - 0.25 * delante), centro_y + b * math.sin(t), z)))
        anillos.append(anillo)
    bm = bmesh.new()
    tubo(bm, anillos)
    piezas.append(pieza("nariz", bm, materiales["piel"], {"head": 1.0}))

    for lado, s in (("l", 1), ("r", -1)):
        y, z = c.y + 0.004 * k, c.z - 0.02 * k
        costado, _, _, _ = arbol.ray_cast(Vector((s, y, z)), Vector((-s, 0, 0)))
        giro = Matrix.Rotation(math.radians(-s * 15), 3, "Z") @ Matrix.Rotation(math.radians(-12), 3, "X")
        r = OREJA * k

        def oreja(p, s=s, r=r, giro=giro):
            hueco = math.exp(-((p.y / r.y) ** 2 + (p.z / r.z) ** 2) / 0.3)
            if p.x * s > 0:
                p = Vector((p.x * (1 - 0.6 * hueco), p.y, p.z))
            return giro @ p
        bm = bmesh.new()
        esfera(bm, costado + Vector((s * 0.003 * k, 0, 0)), r, 14, 10, oreja)
        piezas.append(pieza(f"oreja_{lado}", bm, materiales["piel"], {"head": 1.0}))
    return piezas


def cuello_maniqui(cuello, huevo, materiales):
    """Cuello de maniquí: cilindro elíptico a lo largo del cuello, algo más ancho que el corte de
    la piel (lo tapa desde un poco más abajo) y metido en la cabeza. Abajo sigue al hueso del
    cuello y arriba al de la cabeza."""
    eje, c0 = cuello["eje"], cuello["centro"]
    abajo, arriba = -0.015, (huevo.centro.z - 0.02 - c0.z) / eje.z  # a lo largo del eje
    rx, ry = cuello["radios"]
    anillos = []
    for i in range(11):
        t = i / 10
        c = c0 + eje * (abajo + (arriba - abajo) * t)
        k = 1 - 0.1 * t  # algo más estrecho arriba
        anillos.append([c + cuello["lateral"] * (rx * k * math.cos(a)) + cuello["fondo"] * (ry * k * math.sin(a))
                        for a in (2 * math.pi * j / 20 for j in range(20))])
    bm = bmesh.new()
    tubo(bm, anillos)
    objeto = pieza("cuello", bm, materiales["piel"], {"neck_01": 1.0, "head": 0.0})
    grupos = objeto.vertex_groups
    for v in objeto.data.vertices:
        s = (v.co - c0).dot(eje)
        t = min(1.0, max(0.0, ((s - abajo) / (arriba - abajo) - 0.3) / 0.5))
        w = t * t * (3 - 2 * t)
        grupos["head"].add([v.index], w, "REPLACE")
        grupos["neck_01"].add([v.index], 1 - w, "REPLACE")
    return objeto


# Juntas con punto rojo: [articulación, radio, huesos donde se apoya]. La cadera no lleva:
# la tapa el pantalón.
JUNTAS = [
    ("hombro", 0.014, ("upperarm", "clavicle")), ("codo", 0.011, ("upperarm", "lowerarm")),
    ("rodilla", 0.012, ("thigh", "calf")),
]


def puntos_rojos(cuerpo, esqueleto, pos, materiales):
    """Un punto en la cara exterior de cada junta, pegado a la piel (copia sus pesos)."""
    nombres = {g.index: g.name for g in cuerpo.vertex_groups}
    huesos = set(esqueleto.data.bones.keys())
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    capa = bm.verts.layers.deform.active
    objetos = []
    for base, radio, apoyos in JUNTAS:
        for lado, l in LADOS.items():
            s = 1 if l == "l" else -1
            validos = {f"{a}_{l}" for a in apoyos} | {"pelvis"}
            caras = [f for f in bm.faces
                     if all(dominante(v, capa, {i: n for i, n in nombres.items() if n in huesos}) in validos
                            for v in f.verts)]
            arbol = BVHTree.FromPolygons([v.co for v in bm.verts], [[v.index for v in f.verts] for f in caras])
            junta = pos[f"{base}_{lado}"]
            choque, normal, _, _ = arbol.ray_cast(junta + Vector((s * 0.6, 0, 0)), Vector((-s, 0, 0)))
            assert choque is not None, f"Sin piel en {base}_{lado}"
            # Pesos del vértice de piel más cercano: el punto se mueve con él.
            cercanos = KDTree(len(bm.verts))
            for v in bm.verts:
                cercanos.insert(v.co, v.index)
            cercanos.balance()
            _, indice, _ = cercanos.find(choque)
            bm.verts.ensure_lookup_table()
            pesos = {nombres[g]: w for g, w in bm.verts[indice][capa].items() if nombres[g] in huesos}

            def aplastar(p, n=normal.normalized()):
                return p - 0.55 * p.dot(n) * n
            nuevo = bmesh.new()
            esfera(nuevo, choque - normal * radio * 0.1, (radio,) * 3, 10, 6, aplastar)
            objetos.append(pieza(f"junta_{base}_{lado}", nuevo, materiales["rojo"], pesos))
    bm.free()
    return objetos


# ---------- 6. Materiales ----------
def material(nombre, color, rugosidad, emision=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = rugosidad
    if emision:
        bsdf.inputs["Emission Color"].default_value = (*color, 1)
        bsdf.inputs["Emission Strength"].default_value = emision
    return m


def materiales():
    # La escena (static/maniqui/escena.js) cambia cada uno por el suyo según el nombre.
    return {
        "piel": material("piel", BLANCO, 0.6),
        "espalda": material("espalda", BLANCO, 0.6),
        "guante": material("guante", GRIS_GUANTE, 0.42),
        "munequera": material("munequera", GRIS_MUNEQUERA, 0.8),
        "bota": material("bota", GRIS_GUANTE, 0.5),
        "suela": material("suela", GRIS_SUELA, 0.7),
        "pantalon": material("pantalon", NEGRO_PANTALON, 0.85),
        "cinturilla": material("cinturilla", ROJO_CINTURILLA, 0.6),
        "rojo": material("rojo", ROJO, 0.5, 0.35),
    }


def pintar_espalda(cuerpo, esqueleto, pos, mats):
    """Tronco y hombros con el material «espalda» (la escena le pone el borde de luz roja)."""
    cuerpo.data.materials.append(mats["piel"])
    cuerpo.data.materials.append(mats["espalda"])
    nombres = {g.index: g.name for g in cuerpo.vertex_groups if g.name in esqueleto.data.bones}
    tronco = {"spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r"}
    hombro = pos["hombro_izq"].z - 0.07
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    capa = bm.verts.layers.deform.active
    for f in bm.faces:
        huesos = [dominante(v, capa, nombres) for v in f.verts]
        arriba = f.calc_center_median().z > hombro
        f.material_index = int(all(h in tronco or (arriba and h and h.startswith("upperarm")) for h in huesos))
        f.smooth = True
    bm.to_mesh(cuerpo.data)
    bm.free()


# ---------- 7. Limpieza y exportación ----------
def limpiar(cuerpo, esqueleto):
    activar(esqueleto, "EDIT")
    sobran = [b for b in esqueleto.data.edit_bones if b.name.startswith(DEDOS + ("ball_",))]
    for b in sobran:
        esqueleto.data.edit_bones.remove(b)
    bpy.ops.object.mode_set(mode="OBJECT")
    for g in list(cuerpo.vertex_groups):
        if g.name not in esqueleto.data.bones:
            cuerpo.vertex_groups.remove(g)
    while cuerpo.data.uv_layers:
        cuerpo.data.uv_layers.remove(cuerpo.data.uv_layers[0])
    activar(cuerpo)
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)


def unir(cuerpo, piezas, esqueleto):
    activar(cuerpo)
    for p in piezas:
        p.select_set(True)
    bpy.ops.object.join()
    bmesh_ = bmesh.new()
    bmesh_.from_mesh(cuerpo.data)
    bmesh.ops.triangulate(bmesh_, faces=bmesh_.faces)
    bmesh_.to_mesh(cuerpo.data)
    bmesh_.free()
    cuerpo.name = cuerpo.data.name = "cuerpo"
    esqueleto.name = esqueleto.data.name = "maniqui"
    cuerpo.parent = esqueleto
    m = cuerpo.modifiers.new("Esqueleto", "ARMATURE")
    m.object = esqueleto
    return len(cuerpo.data.polygons)


def exportar(cuerpo, esqueleto):
    activar(cuerpo)
    esqueleto.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(GLB), export_format="GLB", use_selection=True, export_yup=True,
        export_apply=False, export_texcoords=False, export_normals=True, export_tangents=False,
        export_materials="EXPORT", export_vertex_color="NONE", export_skins=True,
        export_def_bones=True, export_influence_nb=4, export_animations=False, export_morph=False,
        export_cameras=False, export_lights=False, export_extras=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=10,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_generic_quantization=12,
    )


# ---------- 8. data/posturas.json ----------
def escribir_esqueleto(pos, pie, ojos):
    """Mide el esqueleto de data/posturas.json en el reposo del GLB: cada `desde` es la
    distancia (en coordenadas del maniquí) a su padre, y `hueso`, el hueso que mueve. `ojos` es
    un extremo de la cabeza (el centro de la cara a la altura de los ojos) para medir la guardia."""
    datos = json.loads(POSTURAS.read_text(encoding="utf-8"))
    esqueleto = {}
    for nombre, junta in datos["esqueleto"].items():
        if nombre != "ojos":
            esqueleto[nombre] = junta
        if nombre == "cabeza":
            esqueleto["ojos"] = {"padre": "cabeza"}
    datos["esqueleto"] = esqueleto
    for nombre, junta in esqueleto.items():
        padre = junta["padre"]
        if padre is None:
            desde = Vector((0, 0, 0))
        elif nombre.startswith("puno"):
            desde = Vector((0, -PUNO, 0))
        elif nombre == "ojos":
            desde = a_three(ojos - pos["cabeza"])
        elif nombre.startswith("punta"):
            # La punta de la bota, en el suelo.
            desde = Vector((0, -pos[padre].z, pos[padre].y - pie["punta"]))
        else:
            desde = a_three(pos[nombre] - pos[padre])
        if nombre.split("_")[0] in ("codo", "muneca", "rodilla", "tobillo"):
            # Brazos y piernas cuelgan rectos: el hueso sale justo hacia −Y.
            desde = Vector((0, -desde.length, 0))
        junta["desde"] = [round(v, 4) + 0 for v in desde]
        h = hueso(nombre)
        if h:
            junta["hueso"] = h
        else:
            junta.pop("hueso", None)
    POSTURAS.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    vaciar_escena()
    cuerpo, esqueleto = crear_cuerpo()
    colgar(cuerpo, esqueleto)
    pos = medir(esqueleto)
    fundir_bolas(cuerpo)
    mats = materiales()
    piezas = [pantalon(cuerpo, esqueleto, pos, mats), *botas(cuerpo, esqueleto, pos, mats)]
    pie, huevo, cuello = recortar(cuerpo, esqueleto, pos)

    piezas += cabeza_maniqui(huevo, mats)
    piezas.append(cuello_maniqui(cuello, huevo, mats))
    for lado, l in LADOS.items():
        piezas += guante(l, pos[f"muneca_{lado}"], mats)
    extra = sum(len(f.vertices) - 2 for p in piezas for f in p.data.polygons) + 6 * 120
    diezmar(cuerpo, TRIANGULOS - extra)
    piezas += puntos_rojos(cuerpo, esqueleto, pos, mats)
    pintar_espalda(cuerpo, esqueleto, pos, mats)
    limpiar(cuerpo, esqueleto)
    triangulos = unir(cuerpo, piezas, esqueleto)
    limpiar(cuerpo, esqueleto)
    exportar(cuerpo, esqueleto)
    escribir_esqueleto(pos, pie, Vector((0, huevo.centro.y - huevo.radios.y, huevo.centro.z)))
    print(f"MANIQUI {GLB.relative_to(RAIZ).as_posix()}: {triangulos} triángulos, "
          f"{GLB.stat().st_size / 1024:.0f} KB, {len(esqueleto.data.bones)} huesos")
    subprocess.run(["node", str(AJUSTAR)], check=True, cwd=RAIZ)


if __name__ == "__main__":
    main()
