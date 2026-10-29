"""Crea el maniquí 3D de Aprende (static/maniqui/maniqui.glb) a partir del hombre Superhero de
Quaternius (Universal Base Characters, CC0).

El glTF original no va en git: se lee de fuera del repo (primer argumento, o la variable de entorno
MANIQUI_QUATERNIUS, o ~/Downloads/quaternius-superhero-male/Superhero_Male_FullBody.gltf).
Sin cejas ni ojos (las cuencas, cerradas y alisadas), blanco mate con su mapa de normales (512 px)
para el músculo, pantalón negro con cinturilla roja, botas, guantes de 14 oz y puntos rojos en las
juntas: las piezas son las de crear_maniqui.py (MPFB), que sigue sirviendo. Brazos y piernas cuelgan
rectos en el reposo, que es el de data/posturas.json (ángulos a cero). Exporta un GLB comprimido
con Draco y escribe en data/posturas.json las medidas del esqueleto y el hueso del GLB que mueve
cada articulación; luego recalcula los ángulos (herramientas/ajustar_posturas.mjs, necesita node).

Uso: blender --background --factory-startup --python herramientas/blender/crear_maniqui_quaternius.py -- [ruta.gltf]
"""
import os
import subprocess
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import crear_maniqui as cm  # noqa: E402

ORIGEN = Path.home() / "Downloads" / "quaternius-superhero-male" / "Superhero_Male_FullBody.gltf"
CUERPO = "SuperHero_Male"
NORMALES = 512  # lado de la textura de normales (JPEG)
# Los huesos del personaje de Quaternius se llaman como los de MakeHuman salvo la cabeza.
cm.HUESOS = {**cm.HUESOS, "cabeza": "Head"}
OJO = 0.03  # radio de la zona que se alisa alrededor de cada ojo


def ruta_modelo():
    argumentos = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ruta = Path(argumentos[0] if argumentos else os.environ.get("MANIQUI_QUATERNIUS", ORIGEN))
    if not ruta.is_file():
        sys.exit(f"No está el glTF de Quaternius en {ruta} (pásalo como argumento tras --)")
    return ruta


# ---------- 1. Cuerpo ----------
def importar(ruta):
    """El cuerpo (sin cejas ni ojos) y su esqueleto, escalados a ALTURA y sin transformaciones.
    Devuelve también el centro de cada ojo (para alisar las cuencas y medir `ojos`)."""
    cm.vaciar_escena()
    bpy.ops.import_scene.gltf(filepath=str(ruta))
    esqueleto = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    cuerpo = bpy.data.objects[CUERPO]
    ojos = bpy.data.objects["Eyes"]
    puntos = [ojos.matrix_world @ v.co for v in ojos.data.vertices]
    centros = [sum((p for p in puntos if (p.x > 0) == izq), Vector()) / sum((p.x > 0) == izq for p in puntos)
               for izq in (True, False)]
    for o in list(bpy.data.objects):
        if o not in (cuerpo, esqueleto):
            bpy.data.objects.remove(o)
    # Escala a ALTURA y deja malla y esqueleto sin transformaciones (como los de MPFB).
    zs = [(cuerpo.matrix_world @ v.co).z for v in cuerpo.data.vertices]
    k = cm.ALTURA / (max(zs) - min(zs))
    for o in (esqueleto, cuerpo):
        o.select_set(True)
    esqueleto.scale *= k
    bpy.context.view_layer.update()
    centros = [c * k for c in centros]
    mundo = cuerpo.matrix_world.copy()
    cuerpo.parent = None
    cuerpo.matrix_world = mundo
    for o in (esqueleto, cuerpo):
        cm.activar(o)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for m in list(cuerpo.modifiers):
        cuerpo.modifiers.remove(m)
    return cuerpo, esqueleto, centros


def alisar_ojos(cuerpo, centros):
    """Cierra los huecos de los ojos y alisa la zona: una cuenca suave de maniquí, sin párpados.
    Devuelve los triángulos UV de la zona (sus párpados también están en el mapa de normales)."""
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    cerca = lambda co, r: min((co - c).length for c in centros) < r  # noqa: E731
    bordes = [e for e in bm.edges if e.is_boundary and all(cerca(v.co, OJO) for v in e.verts)]
    bmesh.ops.holes_fill(bm, edges=bordes, sides=0)
    zona = [v for v in bm.verts if cerca(v.co, OJO)]
    for _ in range(40):
        bmesh.ops.smooth_vert(bm, verts=zona, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    uv = bm.loops.layers.uv.active
    triangulos = [[l[uv].uv.copy() for l in f.loops] for f in bm.faces
                  if any(cerca(v.co, OJO * 1.2) for v in f.verts)]
    bm.to_mesh(cuerpo.data)
    bm.free()
    return triangulos


def aplanar_normales(imagen, poligonos):
    """Normal plana (sin relieve) dentro de los `poligonos` UV del mapa de normales."""
    lado = imagen.size[0]
    pixeles = list(imagen.pixels)
    for poligono in poligonos:
        puntos = [(p.x * lado, p.y * lado) for p in poligono]
        xs, ys = [p[0] for p in puntos], [p[1] for p in puntos]
        for y in range(max(0, int(min(ys)) - 1), min(lado, int(max(ys)) + 2)):
            for x in range(max(0, int(min(xs)) - 1), min(lado, int(max(xs)) + 2)):
                if dentro_poligono(x + 0.5, y + 0.5, puntos, margen=1.5):
                    i = 4 * (y * lado + x)
                    pixeles[i:i + 3] = [0.5, 0.5, 1.0]
    imagen.pixels = pixeles


def dentro_poligono(x, y, puntos, margen=0.0):
    """Punto en polígono convexo (con `margen` en píxeles hacia fuera)."""
    signo = 0
    for (ax, ay), (bx, by) in zip(puntos, puntos[1:] + puntos[:1]):
        largo = max(1e-9, ((bx - ax) ** 2 + (by - ay) ** 2) ** 0.5)
        lado = ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / largo
        if abs(lado) <= margen:
            continue
        if signo == 0:
            signo = 1 if lado > 0 else -1
        elif (lado > 0) != (signo > 0):
            return False
    return True


def cortes_rectos(cuerpo, alturas):
    """Corta la malla en horizontal a esas alturas: así los bordes de pantalón y botas salen rectos
    (la malla de Quaternius no tiene anillos horizontales)."""
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    for z in alturas:
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                               plane_co=Vector((0, 0, z)), plane_no=Vector((0, 0, 1)))
    bm.to_mesh(cuerpo.data)
    bm.free()


def ojos_cara(cuerpo, centros):
    """El centro de la cara a la altura de los ojos (para medir la guardia)."""
    z = sum(c.z for c in centros) / 2
    frente = min(v.co.y for v in cuerpo.data.vertices if abs(v.co.x) < 0.012 and abs(v.co.z - z) < 0.01)
    return Vector((0, frente, z))


# ---------- 2. Recorte: fuera manos, pies y lo que tapan las fundas ----------
def recortar(cuerpo, esqueleto, pos):
    nombres = {g.index: g.name for g in cuerpo.vertex_groups if g.name in esqueleto.data.bones}
    bm = bmesh.new()
    bm.from_mesh(cuerpo.data)
    capa = bm.verts.layers.deform.active
    grupo = {v: cm.dominante(v, capa, nombres) or "" for v in bm.verts}
    pies = [v.co.y for v in bm.verts if grupo[v].startswith("foot_l")]
    pie = {"talon": max(pies), "punta": min(pies)}
    cadera = pos["cadera_izq"].z
    tapado = {"pelvis", "spine_01", "spine_02", "thigh_l", "thigh_r"}

    def sobra(v):
        g = grupo[v]
        if g.startswith(("hand_", "foot_") + cm.DEDOS):
            return True
        if g.startswith("lowerarm_"):
            return v.co.z < pos["muneca_izq"].z + 0.005
        if g.startswith("calf_"):
            return v.co.z < pos["tobillo_izq"].z + cm.CANA_BOTA - 0.07
        if g in tapado:
            # Casi hasta los bordes: con el pantalón ajustado, la piel asomaría al doblarse.
            return cadera - cm.BAJO + 0.012 < v.co.z < cadera + cm.CINTURA - 0.004
        return False

    bmesh.ops.delete(bm, geom=[v for v in bm.verts if sobra(v)], context="VERTS")
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.to_mesh(cuerpo.data)
    bm.free()
    return pie


# ---------- 3. Materiales: piel y espalda con el mapa de normales ----------
def materiales(ojos_uv):
    mats = cm.materiales()
    imagen = bpy.data.images["T_Superhero_Male_Normal"]
    imagen.scale(NORMALES, NORMALES)
    aplanar_normales(imagen, ojos_uv)
    imagen.pack()
    imagen.colorspace_settings.name = "Non-Color"
    for nombre in ("piel", "espalda"):
        arbol = mats[nombre].node_tree
        textura = arbol.nodes.new("ShaderNodeTexImage")
        textura.image = imagen
        mapa = arbol.nodes.new("ShaderNodeNormalMap")
        arbol.links.new(textura.outputs["Color"], mapa.inputs["Color"])
        arbol.links.new(mapa.outputs["Normal"], arbol.nodes["Principled BSDF"].inputs["Normal"])
    return mats


def exportar(cuerpo, esqueleto):
    cm.activar(cuerpo)
    esqueleto.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(cm.GLB), export_format="GLB", use_selection=True, export_yup=True,
        export_apply=False, export_texcoords=True, export_normals=True, export_tangents=False,
        export_materials="EXPORT", export_image_format="JPEG", export_image_quality=80,
        export_vertex_color="NONE", export_skins=True, export_def_bones=True, export_influence_nb=4,
        export_animations=False, export_morph=False, export_cameras=False, export_lights=False,
        export_extras=False, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=10,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_draco_generic_quantization=12,
    )


def main():
    cuerpo, esqueleto, centros = importar(ruta_modelo())
    ojos_uv = alisar_ojos(cuerpo, centros)
    ojos = ojos_cara(cuerpo, centros)
    antes = esqueleto.data.bones["Head"].head_local.copy()
    cm.colgar(cuerpo, esqueleto)
    # colgar() apoya los pies en el suelo: los ojos se mueven lo mismo que la cabeza.
    ojos += esqueleto.data.bones["Head"].head_local - antes
    pos = cm.medir(esqueleto)
    cm.fundir_bolas(cuerpo)
    # Los bordes de las fundas de crear_maniqui.py (pantalón y caña de la bota).
    cadera, tobillo = pos["cadera_izq"].z, pos["tobillo_izq"].z
    cortes_rectos(cuerpo, (cadera + cm.CINTURA + 0.02, cadera + cm.CINTURA - cm.CINTURILLA, cadera - cm.BAJO - 0.02,
                           tobillo + cm.CANA_BOTA + 0.02, tobillo - 0.03))
    mats = materiales(ojos_uv)
    cuerpo.data.materials.clear()
    piezas = [cm.pantalon(cuerpo, esqueleto, pos, mats), *cm.botas(cuerpo, esqueleto, pos, mats)]
    pie = recortar(cuerpo, esqueleto, pos)
    for lado, l in cm.LADOS.items():
        piezas += cm.guante(l, pos[f"muneca_{lado}"], mats)
    extra = sum(len(f.vertices) - 2 for p in piezas for f in p.data.polygons) + 6 * 120
    actuales = sum(len(f.vertices) - 2 for f in cuerpo.data.polygons)
    if actuales + extra > cm.TRIANGULOS:
        cm.diezmar(cuerpo, cm.TRIANGULOS - extra)
    piezas += cm.puntos_rojos(cuerpo, esqueleto, pos, mats)
    cm.pintar_espalda(cuerpo, esqueleto, pos, mats)
    cm.limpiar(cuerpo, esqueleto, uvs=1)
    triangulos = cm.unir(cuerpo, piezas, esqueleto)
    cm.limpiar(cuerpo, esqueleto, uvs=1)
    exportar(cuerpo, esqueleto)
    cm.escribir_esqueleto(pos, pie, ojos)
    print(f"MANIQUI {cm.GLB.relative_to(cm.RAIZ).as_posix()}: {triangulos} triángulos, "
          f"{cm.GLB.stat().st_size / 1024:.0f} KB, {len(esqueleto.data.bones)} huesos")
    subprocess.run(["node", str(cm.AJUSTAR)], check=True, cwd=cm.RAIZ)


if __name__ == "__main__":
    main()
