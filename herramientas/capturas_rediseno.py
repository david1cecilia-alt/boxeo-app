"""Capturas de una fase del rediseño, de pantalla visible (no la página entera), a 390 y 1440.

Monta la web en una carpeta temporal (sin fotos del maniquí) y la abre en Chromium headless, con
prefers-reduced-motion y un almacén v9 escrito para cada captura (completar() rellena lo demás). Guarda en
.playwright-mcp/capturas/rediseno/<fase>/<nombre>-<ancho>.png (no se versiona).

La foto de prueba del avatar es un degradado dibujado en la página: nunca la foto de una persona.

Uso (desde la raíz del repo):
  python herramientas/capturas_rediseno.py --fase r5            todas las de la R5
  python herramientas/capturas_rediseno.py --fase r5 perfil     solo esas
  python herramientas/capturas_rediseno.py --fase r5 --listar   qué capturas tiene

Fases:
- r5 (perfil, nombre y avatar): entrenar-cabecera-inicial, entrenar-cabecera-avatar, entrenar-cabecera-foto,
  entrenar-nombre-largo (puntos suspensivos a 390), menu-ajustes-identidad, perfil (con avatar),
  perfil-cuestionario-abierto, perfil-sin-estilo («Hacer el cuestionario»).
"""
import argparse
import sys
import tempfile
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from herramientas.construir_sitio import construir  # noqa: E402
from herramientas.fotos_maniqui import ORIGEN, abrir  # noqa: E402
from tests.menu_quieto import esperar_menu_quieto  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / ".playwright-mcp" / "capturas" / "rediseno"
TAMANOS = ((390, 844), (1440, 900))
VACIA = """<!doctype html><meta charset="utf-8"><script>window.listo = true;</script>"""

# Deja en el localStorage un almacén v9 con esta identidad, «Mi estilo» y guardia (y la pista del asa ya vista).
SEMBRAR = """async ({ identidad, estilo, zurdo, foto }) => {
  localStorage.clear();
  let datosFoto = null;
  if (foto) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#e67e22'); g.addColorStop(1, '#8e44ad');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.beginPath(); x.arc(128, 110, 48, 0, Math.PI * 2); x.fill();
    x.fillRect(58, 180, 140, 80);
    datosFoto = c.toDataURL('image/jpeg', 0.85);
  }
  localStorage.setItem('boxeo', JSON.stringify({ version: 9, perfil: {
    identidad: { ...identidad, foto: datosFoto }, estilo: { mi_estilo: estilo }, sesion: { zurdo }, pistas: { asa: true },
  } }));
}"""
# Las animaciones de la página, acabadas (una cancelada también cuenta).
ANIMACIONES_ACABADAS = "() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {})))"


# ---------- Cómo se llega a cada pantalla ----------

def entrenar(pagina):
    pagina.goto(f"{ORIGEN}/index.html#entrenar")
    pagina.wait_for_selector("#ir-perfil", state="visible")


def menu_ajustes_identidad(pagina):
    pagina.goto(f"{ORIGEN}/index.html#entrenar/menu/ajustes")
    pagina.wait_for_selector("#identidad #nombre", state="visible")
    esperar_menu_quieto(pagina)
    pagina.locator("#identidad").evaluate("(el) => el.scrollIntoView({ block: 'start' })")


def perfil(pagina, abrir_cuestionario=False):
    pagina.goto(f"{ORIGEN}/index.html#perfil")
    pagina.wait_for_function("""() => { const r = document.querySelector('#perfil-contenido #estilo-resumen');
      return r !== null && !r.textContent.includes('Cargando'); }""")
    if abrir_cuestionario:
        resumen = pagina.locator("#d-cuestionario > summary")
        resumen.click()
        resumen.evaluate("(el) => el.scrollIntoView({ block: 'start' })")


# ---------- Fases: { nombre: (almacén, cómo llegar) } ----------

ALEX = {"nombre": "Alex", "avatar": {"tipo": "inicial"}}
GORRA = {"nombre": "Alex", "avatar": {"tipo": "predefinido", "id": "chica-gorra"}}
CON_FOTO = {"nombre": "Alex", "avatar": {"tipo": "foto"}}
LARGO = {"nombre": "Maximiliano Fernández-Castillo", "avatar": {"tipo": "predefinido", "id": "chico-barba"}}


def almacen(identidad, estilo="no_se", zurdo=False, foto=False):
    return {"identidad": identidad, "estilo": estilo, "zurdo": zurdo, "foto": foto}


FASES = {
    "r5": {
        "entrenar-cabecera-inicial": (almacen(ALEX, "boxer"), entrenar),
        "entrenar-cabecera-avatar": (almacen(GORRA, "boxer"), entrenar),
        "entrenar-cabecera-foto": (almacen(CON_FOTO, "fajador", zurdo=True, foto=True), entrenar),
        "entrenar-nombre-largo": (almacen(LARGO, "contragolpeador"), entrenar),
        "menu-ajustes-identidad": (almacen(CON_FOTO, "boxer", foto=True), menu_ajustes_identidad),
        "perfil": (almacen(GORRA, "boxer_puncher", zurdo=True), perfil),
        "perfil-cuestionario-abierto": (almacen(GORRA, "boxer_puncher", zurdo=True),
                                        lambda p: perfil(p, abrir_cuestionario=True)),
        "perfil-sin-estilo": (almacen(ALEX), perfil),
    },
}


def capturar(sitio: Path, fase: str, nombres=None) -> list[Path]:
    capturas = FASES[fase]
    nombres = list(nombres or capturas)
    salida = SALIDA / fase
    salida.mkdir(parents=True, exist_ok=True)
    rutas = []
    for ancho, alto in TAMANOS:
        with abrir(sitio, VACIA, ancho, alto, barras=ancho > 800) as (pagina, errores):
            pagina.emulate_media(reduced_motion="reduce")
            for nombre in nombres:
                estado, llegar = capturas[nombre]
                pagina.goto(f"{ORIGEN}/__pagina__.html")
                pagina.wait_for_function("window.listo === true")
                pagina.evaluate(SEMBRAR, estado)
                llegar(pagina)
                pagina.evaluate(ANIMACIONES_ACABADAS)
                pagina.evaluate("document.fonts.ready")
                rutas.append(salida / f"{nombre}-{ancho}.png")
                pagina.screenshot(path=rutas[-1])
            assert not errores, errores
    return rutas


def main(argv=None):
    parser = argparse.ArgumentParser(description="Capturas de una fase del rediseño (390 y 1440).")
    parser.add_argument("--fase", required=True, choices=sorted(FASES), help="la fase: guarda en rediseno/<fase>/")
    parser.add_argument("--listar", action="store_true", help="solo dice qué capturas tiene la fase")
    parser.add_argument("nombres", nargs="*", help="solo estas capturas (por defecto, todas)")
    args = parser.parse_args(argv)
    capturas = FASES[args.fase]
    if args.listar:
        print("\n".join(capturas))
        return
    desconocidas = [n for n in args.nombres if n not in capturas]
    if desconocidas:
        parser.error(f"la fase {args.fase} no tiene: {', '.join(desconocidas)} (mira --listar)")
    with tempfile.TemporaryDirectory() as tmp:
        for ruta in capturar(construir(Path(tmp) / "_site", "capturas", fotos=False), args.fase, args.nombres):
            print(ruta.relative_to(RAIZ))


if __name__ == "__main__":
    main()
