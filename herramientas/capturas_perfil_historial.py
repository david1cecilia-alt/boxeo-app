"""Capturas del Perfil (390 y 1440) y del Historial (390, 1024 y 1440, con Asaltos y con RPE).

Monta la web en una carpeta temporal (sin fotos del maniquí) y la abre en Chromium headless con datos
de prueba solo en su localStorage: unas respuestas de estilo y sesiones de las últimas semanas, con una semana sin sesiones y otra sin valorar. Guarda en
.playwright-mcp/capturas/ (no se versiona):
- perfil-<ancho>.png
- historial-asaltos-<ancho>.png y historial-rpe-<ancho>.png
Uso: python herramientas/capturas_perfil_historial.py
"""
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.capturas_practicar import entera  # noqa: E402
from herramientas.construir_sitio import construir  # noqa: E402
from herramientas.fotos_maniqui import ORIGEN, abrir  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / ".playwright-mcp" / "capturas"

# [días atrás, asaltos, RPE o null]. Hace 3 semanas, nada; hace 5, sin valorar.
SEMBRAR = """<!doctype html><meta charset="utf-8">
<script type="module">
import { crearAlmacen } from "./almacen.js";
import { crearHistorial } from "./historial.js";
localStorage.clear();
let n = 0;
const almacen = crearAlmacen({ crearId: () => `prueba-${++n}` });
const perfil = structuredClone(almacen.datos.perfil);
perfil.basicos = { ...perfil.basicos, altura_cm: 178, alcance_cm: 183 };
perfil.sesion = { ...perfil.sesion, nivel: 2, zurdo: false };
perfil.estilo = { ...perfil.estilo, distancia: "larga", presion: "contraatacar", golpe_favorito: "jab",
  volumen: "combos_largos", cardio: "bueno", defensa: "esquiva", iniciativa: "espero" };
almacen.guardarPerfil(perfil);
const historial = await crearHistorial(almacen);
const hace = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T18:00:00`;
};
const SESIONES = [[0, 4, 7], [2, 3, 6], [7, 5, 8], [9, 3, 5], [14, 6, 9], [28, 2, null], [35, 4, 6],
  [37, 3, 7], [42, 5, 8], [49, 2, 4]];
for (const [dias, asaltos, rpe] of SESIONES) {
  const id = await historial.guardar({ fecha: hace(dias), asaltos, duracion_asalto: 180, descanso: 60, nivel: 2,
    combinaciones: [] });
  if (rpe != null) almacen.guardarValoracion(`local:${id}`, { rpe, sensacion: 4 });
}
window.listo = true;
</script>"""


def capturar(sitio: Path) -> list[Path]:
    SALIDA.mkdir(parents=True, exist_ok=True)
    rutas = []
    with abrir(sitio, SEMBRAR, 390, 900) as (pagina, errores):
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        for ancho in (390, 1440):
            pagina.set_viewport_size({"width": ancho, "height": 900})
            pagina.goto(f"{ORIGEN}/index.html#perfil")
            pagina.reload()
            pagina.wait_for_function("!document.querySelector('#estilo-resumen')?.textContent.includes('Cargando')")
            rutas.append(SALIDA / f"perfil-{ancho}.png")
            # Página entera: al agrandar la ventana, el Perfil a 1440 crece y `entera` lo cortaría.
            pagina.wait_for_timeout(300)
            pagina.screenshot(path=rutas[-1], full_page=True)
        for ancho in (390, 1024, 1440):
            for modo in ("asaltos", "rpe"):
                pagina.set_viewport_size({"width": ancho, "height": 900})
                pagina.goto(f"{ORIGEN}/index.html#historial")
                pagina.reload()
                pagina.wait_for_selector(".grafico-semanas .barras")
                boton = pagina.locator(f'[data-modo="{modo}"]')
                if boton.get_attribute("aria-pressed") != "true":
                    boton.click()
                rutas.append(SALIDA / f"historial-{modo}-{ancho}.png")
                entera(pagina, rutas[-1])
        assert not errores, errores
    return rutas


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for ruta in capturar(construir(Path(tmp) / "_site", "capturas", fotos=False)):
            print(ruta.relative_to(RAIZ))
