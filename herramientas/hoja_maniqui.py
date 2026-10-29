"""Hoja de revisión del maniquí 3D: cada postura desde cinco vistas y recortes ampliados de la
cabeza y los guantes, junto a la referencia (docs/referencias/guardia.png, si está).

Se pinta con la propia escena (static/maniqui/escena.js) en Chromium headless, igual que las fotos
sin WebGL (fotos_maniqui.py), pero sin montar el sitio: lee static/, data/ y docs/ del repo.
«Frente real» mira a la cara en la guardia; el resto de vistas se miden desde ahí.

Uso: python herramientas/hoja_maniqui.py   -> docs/referencias/hoja-maniqui-glb.png (no se versiona)
"""
import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.fotos_maniqui import abrir  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
SALIDA = RAIZ / "docs" / "referencias" / "hoja-maniqui-glb.png"
REFERENCIA = "docs/referencias/guardia.png"
ANCHO, ALTO = 2160, 1400

PAGINA = """<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="estilos.css">
<style>
  body { margin: 0; padding: 16px; background: var(--fondo); color: var(--texto, #eee);
         font: 14px/1.3 system-ui, sans-serif; display: flex; gap: 16px; width: max-content; }
  h2 { font-size: 15px; margin: 0 0 8px; }
  .fila { display: flex; gap: 8px; margin-bottom: 10px; }
  figure { margin: 0; }
  figcaption { margin-top: 4px; color: var(--suave, #aaa); font-size: 13px; }
  .referencia img { width: 520px; display: block; }
  #trabajo { position: fixed; left: -5000px; top: 0; width: 1200px; height: 1600px; }
</style>
<canvas id="trabajo"></canvas>
<section class="referencia"><h2>Referencia: guardia.png</h2><img id="referencia" alt=""></section>
<section id="hoja"><h2>Maniquí GLB (Quaternius) · ortodoxa</h2></section>
<script type="module">
import * as THREE from "./vendor/three/three.module.min.js";
import { crearEscena } from "./maniqui/escena.js";
import { prepararPosturas, cinematica, resolver, rotar } from "./maniqui/posturas.js";

const referencia = document.getElementById("referencia");
referencia.src = "REFERENCIA";
referencia.onerror = () => referencia.parentElement.remove();
const datos = await (await fetch("data/posturas.json")).json();
const posturas = prepararPosturas(datos);
const trabajo = document.getElementById("trabajo");
const escena = await crearEscena(trabajo, datos);
const hoja = document.getElementById("hoja");

// Rumbo de la cara en la guardia (acimut de la cámara que la ve de frente).
const mundoGuardia = cinematica(datos.esqueleto, posturas.guardia);
const [fx, , fz] = rotar(mundoGuardia.cabeza.rot, [0, 0, 1]);
const cara = Math.round(THREE.MathUtils.radToDeg(Math.atan2(fx, fz)));
const VISTAS = [
  ["Frente real", { acimut: cara, elevacion: 6 }],
  ["3/4 delantero", { acimut: cara - 45, elevacion: 4 }],
  ["Lado (brazo adelantado)", { acimut: 90, elevacion: 6 }],
  ["Espalda", { acimut: 180, elevacion: 6 }],
  ["Cenital (rival arriba)", { acimut: 0, elevacion: 89 }],
];

function pintar(postura, vista) {
  Object.assign(escena.orbita, vista);
  escena.mostrar(posturas[postura]);
  return cinematica(datos.esqueleto, posturas[postura]);
}

// Lienzo 2D con un trozo [x, y, lado x alto] del lienzo de trabajo (en píxeles), sobre el fondo.
function figura(fila, texto, ancho, alto, recorte = [0, 0, trabajo.width, trabajo.height]) {
  const caja = document.createElement("figure");
  const fondo = document.createElement("div");
  fondo.className = "maniqui-fondo";
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  lienzo.style.display = "block";
  lienzo.getContext("2d").drawImage(trabajo, ...recorte, 0, 0, ancho, alto);
  fondo.append(lienzo);
  const pie = document.createElement("figcaption");
  pie.textContent = texto;
  caja.append(fondo, pie);
  fila.append(caja);
}

function nuevaFila() {
  const fila = document.createElement("div");
  fila.className = "fila";
  hoja.append(fila);
  return fila;
}

// Cuadrado (en píxeles del lienzo de trabajo) que abarca unos puntos del mundo con un margen.
function encuadre(puntos, margen) {
  const xs = [], ys = [];
  for (const p of puntos) {
    for (const d of [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]]) {
      const v = new THREE.Vector3(...p).add(new THREE.Vector3(...d).multiplyScalar(margen)).project(escena.camara);
      xs.push((v.x + 1) / 2 * trabajo.width);
      ys.push((1 - v.y) / 2 * trabajo.height);
    }
  }
  const lado = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return [cx - lado / 2, cy - lado / 2, lado, lado];
}

const centroCabeza = (m) => {
  const d = rotar(m.cabeza.rot, [0, 0.03, 0]);
  return m.cabeza.pos.map((v, i) => v + d[i]);
};

// Reposo (de pie, todo a cero) para ver la silueta: la pelvis a la altura de las piernas.
const e = datos.esqueleto;
const alturaPelvis = -["cadera_izq", "rodilla_izq", "tobillo_izq", "punta_izq"].reduce((s, n) => s + e[n].desde[1], 0);
posturas.reposo = resolver(e, { pos: [0, alturaPelvis, 0] });
const VISTAS_REPOSO = [["Frente", { acimut: 0, elevacion: 6 }], ["3/4", { acimut: -40, elevacion: 4 }],
  ["Lado", { acimut: 90, elevacion: 6 }], ["Espalda", { acimut: 180, elevacion: 6 }]];
const fila = nuevaFila();
for (const [nombre, vista] of VISTAS_REPOSO) {
  pintar("reposo", vista);
  figura(fila, `reposo · ${nombre}`, 300, 400);
}

for (const postura of ["guardia", "jab_salida", "jab_impacto"]) {
  const fila = nuevaFila();
  for (const [nombre, vista] of VISTAS) {
    pintar(postura, vista);
    figura(fila, `${postura} · ${nombre}`, 300, 400);
  }
}

hoja.insertAdjacentHTML("beforeend", "<h2>Recortes ampliados</h2>");
{
  // La cara sin guantes delante.
  const fila = nuevaFila();
  for (const [nombre, vista] of VISTAS_REPOSO) {
    const m = pintar("reposo", vista);
    figura(fila, `reposo · cabeza · ${nombre}`, 300, 300, encuadre([centroCabeza(m)], 0.19));
  }
}
for (const postura of ["guardia", "jab_impacto"]) {
  const fila = nuevaFila();
  for (const [nombre, vista] of VISTAS.slice(0, 3)) {
    const m = pintar(postura, vista);
    figura(fila, `${postura} · cabeza · ${nombre}`, 300, 300, encuadre([centroCabeza(m)], 0.19));
  }
  for (const [nombre, vista] of [VISTAS[0], VISTAS[2]]) {
    const m = pintar(postura, vista);
    figura(fila, `${postura} · guantes · ${nombre}`, 300, 300,
      encuadre([m.puno_izq.pos, m.puno_der.pos, centroCabeza(m)], 0.12));
  }
}
document.title = `cara ${cara}°`;
window.listo = true;
</script>"""


def buscar(relativa: str) -> Path:
    if relativa.startswith(("data/", "docs/")):
        return RAIZ / relativa
    return RAIZ / "static" / relativa


def generar() -> Path:
    html = PAGINA.replace("REFERENCIA", REFERENCIA)
    with abrir(RAIZ, html, ANCHO, ALTO, buscar=buscar) as (pagina, errores):
        pagina.goto("http://boxeo.local/__pagina__.html")
        try:
            pagina.wait_for_function("window.listo === true", timeout=60_000)
        except Exception as e:
            raise RuntimeError(f"No se pudo pintar la hoja: {errores}") from e
        SALIDA.parent.mkdir(parents=True, exist_ok=True)
        pagina.screenshot(path=str(SALIDA), full_page=True)
        print(f"{SALIDA.relative_to(RAIZ).as_posix()} ({pagina.title()})")
    return SALIDA


if __name__ == "__main__":
    generar()
