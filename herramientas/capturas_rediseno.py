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
- r6 (intro y pista del asa): intro-encendida, intro-mitad (9 de 18 letras apagadas), intro-zoom,
  entrenar-tras-intro, pista-asomando, pista-reducida (solo el globo). Cada una en una página nueva con el
  reloj de Playwright parado; el momento de cada animación se fija con getAnimations() (pause + currentTime).
- r7 (cierre, con el gris neutro): entrenar-general, entrenar-personalizada, entrenar-prueba (con ?prueba),
  menu-personalizar, menu-combinaciones, menu-ajustes, menu-desplazado (el título fijo), mis-combinaciones,
  mis-combinaciones-editor, perfil, aprende, aprende-ficha, historial, historial-sesion, historial-borrar (el
  diálogo de la app), sesion-en-marcha y sesion-descanso (una Prueba de 2 × 30 s con el reloj parado), intro,
  pista (asomando) y pista-3s (la lengüeta ya recogida y el globo aún a la vista).

Las demás fases usan prefers-reduced-motion y la ayuda sin intro ni pista (tests/sin_intro.py).
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
from tests.sin_intro import preparar  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / ".playwright-mcp" / "capturas" / "rediseno"
TAMANOS = ((390, 844), (1440, 900))
VACIA = """<!doctype html><meta charset="utf-8"><script>window.listo = true;</script>"""

# Deja en el localStorage un almacén v9 con esta identidad, «Mi estilo» y guardia (y la pista del asa ya vista).
# `sesion`: más campos de perfil.sesion; `sesiones` y `propias`: el Historial y Mis combinaciones.
# `respuestas`: las del cuestionario (perfil.estilo sin mi_estilo).
SEMBRAR = """async ({ identidad, estilo, respuestas = {}, zurdo, foto, pista, sesion = {}, sesiones = [], propias = [] }) => {
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
  localStorage.setItem('boxeo', JSON.stringify({ version: 9, sesiones, combinacionesPropias: propias, valoraciones: {}, perfil: {
    identidad: { ...identidad, foto: datosFoto }, estilo: { ...respuestas, mi_estilo: estilo }, sesion: { zurdo, ...sesion },
    pistas: { asa: !pista },
  } }));
}"""
# Las animaciones de la página, acabadas (una cancelada también cuenta). Las infinitas (las luces de la
# intro) no acaban nunca: se dejan.
ANIMACIONES_ACABADAS = """() => Promise.all(document.getAnimations()
  .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity).map((a) => a.finished.catch(() => {})))"""
# Para todas las animaciones en el ms `t` desde que se cargó la página. Las que empezaron más tarde, en su
# momento: el acercamiento de la vista empieza a 1,5 s (intro.js) y la pista, al acabar la intro (o al cargar).
FIJAR_ANIMACIONES = """(t) => {
  const empiezan = { 'intro-acercar': 1500 };
  for (const a of document.getAnimations()) {
    a.pause();
    a.currentTime = Math.max(0, t - (empiezan[a.animationName] ?? 0));
  }
}"""
INICIO = 1_800_000_000_000  # ms: la hora del reloj parado (da igual cuál)


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


# Las 7 preguntas del cuestionario contestadas, apuntando a Boxer: así un Perfil con «Mi estilo» no sale con
# «0 de 7 preguntas», que no se da si se ha hecho el cuestionario.
RESPUESTAS_BOXER = {"distancia": "larga", "presion": "salir", "volumen": "pocos_fuertes", "iniciativa": "segun_rival",
                    "defensa": "pies", "cardio": "bueno", "golpe_favorito": "jab"}


def almacen(identidad, estilo="no_se", zurdo=False, foto=False, pista=False, sesion=None, sesiones=(), propias=(),
            respuestas=None):
    return {"identidad": identidad, "estilo": estilo, "respuestas": respuestas or {}, "zurdo": zurdo, "foto": foto,
            "pista": pista, "sesion": sesion or {}, "sesiones": list(sesiones), "propias": list(propias)}


# ---------- R6: la intro y la pista, con el reloj parado ----------

def en_el_ms(t, avanzar=None):
    """Llega a Entrenar con el reloj parado, lo adelanta `avanzar` ms (por defecto, `t`) y fija las
    animaciones en el ms `t`."""
    def llegar(pagina):
        entrenar(pagina)
        pagina.evaluate("document.fonts.ready")
        pagina.clock.run_for(t if avanzar is None else avanzar)
        pagina.evaluate(FIJAR_ANIMACIONES, t)
    return llegar


def tras_la_intro(pagina):
    entrenar(pagina)
    pagina.clock.run_for(2000)
    assert pagina.evaluate("document.getElementById('intro') === null")
    pagina.evaluate(ANIMACIONES_ACABADAS)


def pista_asomando(pagina):
    entrenar(pagina)
    pagina.wait_for_function("!document.getElementById('pista-asa').hidden")
    pagina.evaluate(FIJAR_ANIMACIONES, 700)  # de 0,26 a 1,45 s está fuera del todo


def pista_reducida(pagina):
    entrenar(pagina)
    pagina.wait_for_function("!document.getElementById('pista-asa').hidden")
    assert pagina.evaluate("document.querySelector('.pista-panel').hidden")


def pista_a_los_3_s(pagina):
    entrenar(pagina)
    pagina.wait_for_function("!document.getElementById('pista-asa').hidden")
    pagina.clock.run_for(3000)
    assert pagina.evaluate("document.querySelector('.pista-panel').hidden")
    assert pagina.evaluate("!document.getElementById('pista-asa').hidden")
    pagina.evaluate(FIJAR_ANIMACIONES, 3000)


# ---------- R7: el cierre ----------

def ir(ruta, selector, menu=False):
    def llegar(pagina):
        pagina.goto(f"{ORIGEN}/index.html{ruta}")
        pagina.wait_for_selector(selector, state="visible")
        if menu:
            esperar_menu_quieto(pagina)
    return llegar


def entrenar_prueba(pagina):
    pagina.goto(f"{ORIGEN}/index.html?prueba#entrenar")
    pagina.wait_for_selector("#ir-perfil", state="visible")
    pagina.click('#tipo-sesion label:has(input[value="prueba"])')


def menu_desplazado(pagina):
    ir("#entrenar/menu/personalizar", "#t-menu", menu=True)(pagina)
    pagina.evaluate("document.querySelector('.menu-contenido').scrollTop = 600")


def historial_borrar(pagina):
    ir("#historial/local%3As-1", "#borrar")(pagina)
    pagina.click("#borrar")
    pagina.wait_for_selector("#d-confirmar[open]")


def en_sesion(segundos, fase):
    """Una Prueba (2 × 30 s) empezada con el reloj parado y adelantada `segundos`, en la fase `fase`."""
    def llegar(pagina):
        entrenar_prueba(pagina)
        pagina.click("#empezar")
        pagina.click("#empezar-ya")  # sin los 10 s de preparación
        pagina.clock.run_for(segundos * 1000)
        actual = pagina.evaluate("document.getElementById('pantalla').dataset.fase")
        assert actual == fase, f"a los {segundos} s la sesión está en «{actual}», no en «{fase}»"
        pagina.evaluate(ANIMACIONES_ACABADAS)
    return llegar


# Unas sesiones de noviembre y dos combinaciones propias, para que Historial y Mis combinaciones no salgan vacíos.
SESIONES = [{"id": f"s-{i}", "fecha": f"2026-11-{d:02d}T18:00:00", "asaltos": a, "nivel": 2, "zurdo": False,
             "duracion_asalto": 180, "descanso": 60, "tipo": "personalizada", "num_combinaciones": 2,
             "combinaciones": [{"asalto": 1, "texto": "uno jab, dos recto", "ids": ["jab", "directo"]},
                               {"asalto": 2, "texto": "esquiva derecha, tres crochet de izquierda",
                                "ids": ["esquiva_der", "gancho_izq"]}]}
            for i, (d, a) in enumerate([(3, 3), (5, 4), (8, 3), (10, 5), (12, 3)], start=1)]
PROPIAS = [{"id": "p-0", "ids": ["jab", "directo", "esquiva_izq", "gancho_izq"], "creada": "2026-11-04T10:00:00Z"},
           {"id": "p-1", "ids": ["bloqueo", "directo", "uppercut_izq"], "creada": "2026-11-05T10:00:00Z"}]
PERSONALIZADA = {"tipo": "personalizada", "nivel": 2, "ritmo": 4, "mezcla": "algunas",
                 "personalizada": {"asaltos": 4, "duracion_asalto": 120, "descanso": 45}}
R7 = almacen(GORRA, "boxer", sesion=PERSONALIZADA, sesiones=SESIONES, propias=PROPIAS, respuestas=RESPUESTAS_BOXER)
R7_GENERAL = almacen(GORRA, "boxer", sesion={"tipo": "general"}, sesiones=SESIONES, propias=PROPIAS,
                     respuestas=RESPUESTAS_BOXER)


FASES = {
    "r5": {
        "entrenar-cabecera-inicial": (almacen(ALEX, "boxer"), entrenar),
        "entrenar-cabecera-avatar": (almacen(GORRA, "boxer"), entrenar),
        "entrenar-cabecera-foto": (almacen(CON_FOTO, "fajador", zurdo=True, foto=True), entrenar),
        "entrenar-nombre-largo": (almacen(LARGO, "contragolpeador"), entrenar),
        "menu-ajustes-identidad": (almacen(CON_FOTO, "boxer", foto=True), menu_ajustes_identidad),
        # «Mi estilo» Boxer-puncher con respuestas que apuntan a Boxer: sale «Según tus respuestas: Boxer».
        "perfil": (almacen(GORRA, "boxer_puncher", zurdo=True, respuestas=RESPUESTAS_BOXER), perfil),
        "perfil-cuestionario-abierto": (almacen(GORRA, "boxer_puncher", zurdo=True, respuestas=RESPUESTAS_BOXER),
                                        lambda p: perfil(p, abrir_cuestionario=True)),
        "perfil-sin-estilo": (almacen(ALEX), perfil),
    },
    # Tercer elemento: cómo se abre la página (intro, pista, movimiento). Siempre una página nueva.
    "r6": {
        "intro-encendida": (almacen(ALEX, "boxer"), en_el_ms(200), {"intro": True}),
        "intro-mitad": (almacen(ALEX, "boxer"), en_el_ms(930), {"intro": True}),
        "intro-zoom": (almacen(ALEX, "boxer"), en_el_ms(1700, avanzar=1500), {"intro": True}),
        "entrenar-tras-intro": (almacen(ALEX, "boxer"), tras_la_intro, {"intro": True}),
        "pista-asomando": (almacen(ALEX, "boxer", pista=True), pista_asomando, {"pista": True}),
        "pista-reducida": (almacen(ALEX, "boxer", pista=True), pista_reducida, {"pista": True, "movimiento": False}),
    },
    "r7": {
        "entrenar-general": (R7_GENERAL, entrenar),
        "entrenar-personalizada": (R7, entrenar),
        "entrenar-prueba": (R7, entrenar_prueba),
        "menu-personalizar": (R7, ir("#entrenar/menu/personalizar", "#t-menu", menu=True)),
        "menu-combinaciones": (R7, ir("#entrenar/menu/combinaciones", "#t-menu", menu=True)),
        "menu-ajustes": (R7, ir("#entrenar/menu/ajustes", "#identidad #nombre", menu=True)),
        "menu-desplazado": (R7, menu_desplazado),
        "mis-combinaciones": (R7, ir("#entrenar/mis-combinaciones", "#t-creador")),
        "mis-combinaciones-editor": (R7, ir("#entrenar/mis-combinaciones/editar/p-0", "#t-creador")),
        "perfil": (R7, perfil),
        "aprende": (R7, ir("#aprende", ".lista-fichas")),
        "aprende-ficha": (R7, ir("#aprende/jab", ".aprende-ficha")),
        "historial": (R7, ir("#historial", ".grafico-semanas .barras")),
        "historial-sesion": (R7, ir("#historial/local%3As-1", "#t-detalle")),
        "historial-borrar": (R7, historial_borrar),
        "sesion-en-marcha": (R7, en_sesion(12, "asalto"), {"movimiento": False}),
        "sesion-descanso": (R7, en_sesion(32, "descanso"), {"movimiento": False}),
        "intro": (R7, en_el_ms(930), {"intro": True}),
        "pista": (almacen(GORRA, "boxer", pista=True, sesion=PERSONALIZADA), pista_asomando, {"pista": True}),
        "pista-3s": (almacen(GORRA, "boxer", pista=True, sesion=PERSONALIZADA), pista_a_los_3_s, {"pista": True}),
    },
}


def capturar_una(sitio, ancho, alto, estado, llegar, opciones, ruta):
    """Una captura en una página nueva (sessionStorage limpio) con el reloj parado antes de cargar."""
    with abrir(sitio, VACIA, ancho, alto, barras=ancho > 800) as (pagina, errores):
        preparar(pagina, intro=opciones.get("intro", False), pista=opciones.get("pista", False))
        pagina.emulate_media(reduced_motion="no-preference" if opciones.get("movimiento", True) else "reduce")
        pagina.clock.install(time=INICIO)
        pagina.clock.pause_at(INICIO)
        pagina.goto(f"{ORIGEN}/__pagina__.html")
        pagina.wait_for_function("window.listo === true")
        pagina.evaluate(SEMBRAR, estado)
        llegar(pagina)
        pagina.evaluate("document.fonts.ready")
        pagina.screenshot(path=ruta)
        assert not errores, errores


def capturar(sitio: Path, fase: str, nombres=None) -> list[Path]:
    capturas = FASES[fase]
    nombres = list(nombres or capturas)
    salida = SALIDA / fase
    salida.mkdir(parents=True, exist_ok=True)
    rutas = []
    for ancho, alto in TAMANOS:
        sueltas = [n for n in nombres if len(capturas[n]) == 3]
        for nombre in sueltas:
            rutas.append(salida / f"{nombre}-{ancho}.png")
            capturar_una(sitio, ancho, alto, *capturas[nombre], rutas[-1])
        nombres_juntos = [n for n in nombres if n not in sueltas]
        if not nombres_juntos:
            continue
        with abrir(sitio, VACIA, ancho, alto, barras=ancho > 800) as (pagina, errores):
            preparar(pagina)  # sin la intro ni la pista del asa
            pagina.emulate_media(reduced_motion="reduce")
            for nombre in nombres_juntos:
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
