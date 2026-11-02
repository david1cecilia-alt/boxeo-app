"""Biblioteca nueva de combinaciones: los datos de la propuesta, sus comprobaciones y el documento para revisar.

Escribe docs/revision/biblioteca-propuesta.md. Antes comprueba con el motor que todo cuadra (nivel con
motor.reglas.nivel_de, reparto de defensas exacto, clásicos, balance de golpes, defensas, lados y salidas) y,
si algo falla, no escribe nada y dice qué.
Uso: python herramientas/biblioteca.py
"""
import random
import re
import statistics
import sys
from collections import Counter
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from motor.acciones import acciones_por_ids, biblioteca, catalogo, palabra_hablada  # noqa: E402
from motor.reglas import nivel_de, validar  # noqa: E402
from motor.sorteo import Combinacion  # noqa: E402
from motor.temporizador import ConfigSesion, construir_guion  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "docs" / "revision" / "biblioteca-propuesta.md"

# Notación corta de la propuesta: golpes por número ("3c" = 3 al cuerpo), defensas y salidas por sus siglas.
FICHA = {
    "1": "jab", "2": "directo", "3": "gancho_izq", "4": "gancho_der", "5": "uppercut_izq", "6": "uppercut_der",
    "1c": "jab_cuerpo", "2c": "directo_cuerpo", "3c": "gancho_izq_cuerpo", "4c": "gancho_der_cuerpo",
    "5c": "uppercut_izq_cuerpo", "6c": "uppercut_der_cuerpo",
    "ED": "esquiva_der", "EI": "esquiva_izq", "AD": "rodar_der", "AI": "rodar_izq",
    "B": "bloqueo", "P": "parada", "PA": "paso_atras", "BA": "ballesteo", "F": "flexion",
    "PI": "pivote", "LD": "paso_lateral_der", "LI": "paso_lateral_izq", "CA": "salir",
}
NIVEL = {1: "básico", 2: "medio", 3: "avanzado"}
POR_NIVEL = 50
# Combinaciones por número de defensas en cada nivel (el reparto del entrenador con 50 por nivel).
REPARTO = {1: {0: 20, 1: 15, 2: 15}, 2: {1: 20, 2: 20, 3: 10}, 3: {1: 5, 2: 15, 3: 20, "4-5": 10}}
CLASICOS = ["1-2-3-2", "1-3-2", "1-2-5-2", "1-2-1-2", "3-2-3"]  # básico, sin defensa
CARA = (12, 22)          # % de cada golpe 1-6 sobre los golpes a la cara, en total y en cada nivel
MIN_CUERPO = 6           # veces de cada golpe al cuerpo, en total
MIN_DEFENSA = 12         # veces de cada tipo de defensa, en total
MAX_DIFERENCIA_LADO = 20  # % entre derecha e izquierda de cada defensa con lado
MIN_SALIDA = 6           # veces de cada salida, en total
DEFENSAS = ["esquiva", "rodar", "ballesteo", "flexion", "bloqueo", "parada", "paso_atras"]
SALIDAS = ["pivote", "paso_lateral_izq", "paso_lateral_der", "salir"]

# Familias: (id, nombre, idea, miembros). Cada miembro: (clave, papel, origen, notación, nombre).
# papel: base | crece (de origen, del nivel anterior) | variante (de origen, del mismo nivel).
# En la notación, {clave} es la combinación de esa clave: «{F1-B}-6-4» = la F1-B y luego 6-4.
FAMILIAS = [
    ("F1", "Crochet y esquiva abajo", "Jab, crochet, se esquiva abajo y se devuelve.", [
        ("F1-B", "base", None, "1-3-AD", "jab, crochet y esquiva abajo"),
        ("F1-Bb", "variante", "F1-B", "1-3-AI", "esquivando al otro lado"),
        ("F1-M", "crece", "F1-B", "{F1-B}-6-4", "y devuelve gancho y crochet"),
        ("F1-Mb", "variante", "F1-M", "1-3-AD-4-2", "devuelve 4-2 en vez de 6-4"),
        ("F1-A", "crece", "F1-M", "{F1-M}-CA-3", "cambio de ángulo y crochet"),
        ("F1-Ab", "variante", "F1-A", "{F1-M}-PI-3", "sale con pivote"),
    ]),
    ("F2", "Jab-recto", "La base de todo, a la que se le añaden esquivas y contras.", [
        ("F2-B", "base", None, "1-2", "jab-recto"),
        ("F2-Bb", "variante", "F2-B", "1-1-2", "doble jab y recto"),
        ("F2-M", "crece", "F2-B", "{F2-B}-EI-5-2", "esquiva y gancho-recto"),
        ("F2-Mb", "variante", "F2-M", "{F2-Bb}-ED-6", "doble jab, esquiva y gancho"),
        ("F2-A", "crece", "F2-M", "{F2-M}-AD-4-LI", "esquiva abajo, crochet y sale"),
        ("F2-Ab", "variante", "F2-A", "{F2-Mb}-3-B-4", "crochet, bloqueo y crochet"),
    ]),
    ("F3", "Ballesteo y contra", "Se saca la cara hacia atrás y se contesta.", [
        ("F3-B", "base", None, "BA-2", "ballesteo y recto"),
        ("F3-Bb", "variante", "F3-B", "BA-6-3", "ballesteo, gancho y crochet"),
        ("F3-M", "crece", "F3-B", "1-{F3-B}-3-4", "jab, ballesteo y tres golpes"),
        ("F3-Mb", "variante", "F3-M", "{F3-Bb}-AI-4", "con esquiva abajo y crochet"),
        ("F3-A", "crece", "F3-M", "{F3-M}-BA-5-PI", "otro ballesteo, gancho y pivote"),
        ("F3-Ab", "variante", "F3-A", "{F3-Mb}-F-4c-3-LD", "flexión, crochet abajo y arriba y sale"),
    ]),
    ("F4", "Parada y contra", "Se para el jab con la derecha y se contesta.", [
        ("F4-B", "base", None, "P-1-2", "parada y jab-recto"),
        ("F4-Bb", "variante", "F4-B", "P-2-3-B", "parada, recto-crochet y bloqueo"),
        ("F4-M", "crece", "F4-B", "{F4-B}-ED-6-3", "esquiva y gancho-crochet"),
        ("F4-Mb", "variante", "F4-M", "{F4-Bb}-4-5", "bloqueo, crochet y gancho"),
        ("F4-A", "crece", "F4-M", "{F4-M}-B-5-2", "bloqueo y gancho-recto"),
        ("F4-Ab", "variante", "F4-A", "{F4-M}-PA-1-2-LI", "paso atrás, jab-recto y sale"),
    ]),
    ("F5", "Abajo y arriba", "Golpes al cuerpo para bajar la guardia del rival y subir a la cara.", [
        ("F5-B", "base", None, "1c-2", "jab al cuerpo y recto"),
        ("F5-Bb", "variante", "F5-B", "6-3c-3", "gancho y crochet abajo y arriba"),
        ("F5-M", "crece", "F5-B", "{F5-B}-F-3c-3", "flexión y crochet abajo y arriba"),
        ("F5-Mb", "variante", "F5-M", "{F5-Bb}-F-6c-5", "flexión y ganchos abajo y arriba"),
        ("F5-A", "crece", "F5-M", "{F5-M}-AD-4c-4", "esquiva abajo y crochet abajo y arriba"),
        ("F5-Ab", "variante", "F5-A", "{F5-Mb}-B-4", "bloqueo y crochet"),
    ]),
    ("F6", "Esquiva a los dos lados", "Esquiva lateral, se suelta y se vuelve a esquivar.", [
        ("F6-B", "base", None, "ED-6-3-EI", "esquiva, gancho-crochet y esquiva"),
        ("F6-Bb", "variante", "F6-B", "EI-5-2-ED", "empezando por la izquierda, con gancho-recto"),
        ("F6-M", "crece", "F6-B", "{F6-B}-5-4", "y devuelve gancho-crochet"),
        ("F6-Mb", "variante", "F6-M", "{F6-Bb}-6-B", "gancho y bloqueo"),
        ("F6-A", "crece", "F6-M", "{F6-M}-AD-6-4", "esquiva abajo y gancho-crochet"),
        ("F6-Ab", "variante", "F6-A", "{F6-Mb}-5-2-PI", "gancho-recto y pivote"),
    ]),
    ("F7", "Bloqueo", "Bloquear, devolver y, si toca, volver a bloquear.", [
        ("F7-B", "base", None, "B-3-2", "bloqueo, crochet y recto"),
        ("F7-Bb", "variante", "F7-B", "B-3-2-B", "y vuelve a bloquear"),
        ("F7-Bc", "variante", "F7-B", "5-2-B", "gancho-recto y bloqueo"),
        ("F7-M", "crece", "F7-B", "1-{F7-B}-PA-6", "paso atrás y gancho"),
        ("F7-Mb", "variante", "F7-M", "{F7-Bb}-6-3", "doble bloqueo y gancho-crochet"),
        ("F7-A", "crece", "F7-M", "{F7-M}-ED-4-LD", "esquiva, crochet y paso lateral"),
        ("F7-Ab", "variante", "F7-A", "{F7-Mb}-EI-5-BA-2", "esquiva, gancho, ballesteo y recto"),
    ]),
    ("F8", "Paso atrás y contra", "Se rompe la distancia y se contesta.", [
        ("F8-B", "base", None, "PA-2", "paso atrás y recto"),
        ("F8-Bb", "variante", "F8-B", "PA-1-2-PA", "paso atrás, jab-recto y paso atrás"),
        ("F8-M", "crece", "F8-B", "1-4-{F8-B}-3", "jab-crochet, paso atrás y recto-crochet"),
        ("F8-Mb", "variante", "F8-M", "{F8-M}-PI", "y pivota"),
        ("F8-A", "crece", "F8-M", "{F8-M}-F-3c-6-LD", "flexión, crochet al cuerpo, gancho y sale"),
        ("F8-Ab", "variante", "F8-A", "{F8-Mb}-ED-5-4", "pivota, esquiva y gancho-crochet"),
    ]),
    ("F9", "Gancho y crochet", "Ganchos (5 y 6) en la corta, rematados con crochet.", [
        ("F9-B", "base", None, "6-3", "gancho de derecha y crochet"),
        ("F9-Bb", "variante", "F9-B", "5-4", "gancho de izquierda y crochet de derecha"),
        ("F9-M", "crece", "F9-B", "1-2-{F9-B}-AI", "jab-recto, gancho-crochet y esquiva abajo"),
        ("F9-Mb", "variante", "F9-M", "1-{F9-Bb}-AD-3", "esquiva abajo y crochet"),
        ("F9-A", "crece", "F9-M", "{F9-M}-3-6-5-EI", "devuelve crochet y dos ganchos y esquiva"),
        ("F9-Ab", "variante", "F9-A", "{F9-Mb}-5c-6-BA", "gancho al cuerpo, gancho y ballesteo"),
    ]),
    ("F10", "Doble jab", "Doble jab para entrar, y lo que venga.", [
        ("F10-B", "base", None, "1-1-4", "doble jab y crochet de derecha"),
        ("F10-Bb", "variante", "F10-B", "1-1-6-3", "doble jab, gancho y crochet"),
        ("F10-M", "crece", "F10-B", "{F10-B}-EI-3", "esquiva y crochet"),
        ("F10-Mb", "variante", "F10-M", "{F10-Bb}-BA-4", "ballesteo y crochet"),
        ("F10-A", "crece", "F10-M", "{F10-M}-2-AD-5-4", "esquiva abajo y gancho-crochet"),
        ("F10-Ab", "variante", "F10-A", "{F10-Mb}-B-5-2", "bloqueo y gancho-recto"),
    ]),
    ("F11", "Flexión y cuerpo", "Se baja con flexión y se ataca al cuerpo.", [
        ("F11-B", "base", None, "F-3c-4", "flexión y doble crochet, abajo y arriba"),
        ("F11-Bb", "variante", "F11-B", "F-6c-5", "flexión y ganchos abajo y arriba"),
        ("F11-M", "crece", "F11-B", "{F11-B}-2-B", "recto y bloqueo"),
        ("F11-Mb", "variante", "F11-M", "{F11-Bb}-AD-4-3", "esquiva abajo y doble crochet"),
        ("F11-A", "crece", "F11-M", "{F11-M}-6c-3-EI", "gancho al cuerpo, crochet y esquiva"),
        ("F11-Ab", "variante", "F11-A", "{F11-Mb}-F-1c-6", "otra flexión, jab al cuerpo y gancho"),
    ]),
    ("F12", "Esquiva abajo a los dos lados", "Esquivar abajo, soltar el crochet del lado y cambiar.", [
        ("F12-B", "base", None, "AI-3-AD-4", "esquiva abajo y crochet a los dos lados"),
        ("F12-Bb", "variante", "F12-B", "AD-4-AI-3", "empezando por la derecha"),
        ("F12-M", "crece", "F12-B", "{F12-B}-5-2", "y gancho-recto"),
        ("F12-Mb", "variante", "F12-M", "{F12-Bb}-6-F", "gancho y flexión"),
        ("F12-A", "crece", "F12-M", "{F12-M}-ED-6-4c", "esquiva, gancho y crochet al cuerpo"),
        ("F12-Ab", "variante", "F12-A", "{F12-Mb}-5c-5-PA-2", "ganchos abajo y arriba, paso atrás y recto"),
    ]),
    ("F13", "Jab arriba y abajo", "El jab cambia de altura para abrir hueco.", [
        ("F13-B", "base", None, "1-1c-2", "jab arriba, jab abajo y recto"),
        ("F13-Bb", "variante", "F13-B", "1c-1-4", "jab abajo, jab arriba y crochet"),
        ("F13-M", "crece", "F13-B", "{F13-B}-ED-6", "esquiva y gancho"),
        ("F13-Mb", "variante", "F13-M", "{F13-Bb}-PA-2", "paso atrás y recto"),
        ("F13-A", "crece", "F13-M", "{F13-M}-3-B-4c-4", "crochet, bloqueo y crochet abajo y arriba"),
        ("F13-Ab", "variante", "F13-A", "{F13-Mb}-F-5c-6-LI", "flexión, ganchos abajo y arriba y sale"),
    ]),
    ("F14", "Parada y al cuerpo", "Se para el jab y se contesta abajo.", [
        ("F14-B", "base", None, "P-2c-3", "parada, recto al cuerpo y crochet"),
        ("F14-Bb", "variante", "F14-B", "P-1-2c", "parada, jab y recto al cuerpo"),
        ("F14-M", "crece", "F14-B", "{F14-B}-AI-6-5", "esquiva abajo y dos ganchos"),
        ("F14-Mb", "variante", "F14-M", "{F14-Bb}-BA-4", "ballesteo y crochet"),
        ("F14-A", "crece", "F14-M", "{F14-M}-ED-4-CA", "esquiva, crochet y cambio de ángulo"),
        ("F14-Ab", "variante", "F14-A", "{F14-Mb}-B-6-3-PI", "bloqueo, gancho-crochet y pivote"),
    ]),
    ("F15", "Cambio de ángulo", "Se suelta, se cambia de ángulo y se ataca desde el nuevo sitio.", [
        ("F15-B", "base", None, "6-5-CA", "dos ganchos y cambio de ángulo"),
        ("F15-Bb", "variante", "F15-B", "6-3-CA", "gancho-crochet y cambio de ángulo"),
        ("F15-M", "crece", "F15-B", "{F15-B}-3-4-EI", "doble crochet y esquiva"),
        ("F15-Mb", "variante", "F15-M", "{F15-Bb}-5-PA", "gancho y paso atrás"),
        ("F15-A", "crece", "F15-M", "{F15-M}-5-B-6", "gancho, bloqueo y gancho"),
        ("F15-Ab", "variante", "F15-A", "{F15-Mb}-4-AD-3-LI", "crochet, esquiva abajo, crochet y sale"),
    ]),
    ("F16", "Pivote", "Se suelta y se pivota para no quedarse delante.", [
        ("F16-B", "base", None, "3-4-PI", "doble crochet y pivote"),
        ("F16-Bb", "variante", "F16-B", "4-5-PI", "crochet-gancho y pivote"),
        ("F16-M", "crece", "F16-B", "B-{F16-B}-2", "bloqueo, doble crochet, pivote y recto"),
        ("F16-Mb", "variante", "F16-M", "{F16-Bb}-AD-4", "esquiva abajo y crochet"),
        ("F16-A", "crece", "F16-M", "{F16-M}-EI-5-BA-6", "esquiva, gancho, ballesteo y gancho"),
        ("F16-Ab", "variante", "F16-A", "{F16-Mb}-3-F-6c-ED", "crochet, flexión, gancho al cuerpo y esquiva"),
    ]),
]

# Sueltas: (notación, nombre). El nivel sale de nivel_de.
SUELTAS = [
    # Básico: los clásicos y otras sin defensa
    ("1-2-3-2", "jab-recto-crochet-recto"),
    ("1-3-2", "jab-crochet-recto"),
    ("1-2-5-2", "jab-recto-gancho-recto"),
    ("1-2-1-2", "jab-recto-jab-recto"),
    ("3-2-3", "crochet-recto-crochet"),
    ("5-6-3", "dos ganchos y crochet"),
    # Básico con defensa
    ("EI-5-4", "esquiva, gancho y crochet"),
    ("5c-6-B", "gancho al cuerpo, gancho y bloqueo"),
    ("ED-6-4", "esquiva, gancho y crochet"),
    ("1-ED-6-BA", "esquiva, gancho y ballesteo"),
    ("PA-6-B", "paso atrás, gancho y bloqueo"),
    ("ED-4-EI-5", "esquiva, crochet, esquiva y gancho"),
    ("F-5c-6-B", "flexión, ganchos abajo y arriba y bloqueo"),
    ("P-5-AD", "parada, gancho y esquiva abajo"),
    ("AI-4c-4-PA", "esquiva abajo, crochet abajo y arriba y paso atrás"),
    ("1-BA-5-F", "jab, ballesteo, gancho y flexión"),
    ("EI-6c-6-ED", "esquiva, ganchos abajo y arriba y esquiva"),
    # Medio
    ("1-6-5-4-EI", "jab, dos ganchos, crochet y esquiva"),
    ("ED-6-5-AI-4-PI", "esquiva, dos ganchos, esquiva abajo, crochet y pivote"),
    ("1-2-B-6-3-EI", "bloqueo, gancho-crochet y esquiva"),
    ("F-2c-5-6-PA", "flexión, recto al cuerpo, dos ganchos y paso atrás"),
    ("P-4-AI-5-2", "parada, crochet, esquiva abajo y gancho-recto"),
    ("BA-4-5-AI-6", "ballesteo, crochet-gancho, esquiva abajo y gancho"),
    ("1c-6-B-4-ED", "jab al cuerpo, gancho, bloqueo, crochet y esquiva"),
    ("PA-5-4-F-3c", "paso atrás, gancho-crochet, flexión y crochet al cuerpo"),
    ("EI-5c-6-BA-4", "esquiva, ganchos abajo y arriba, ballesteo y crochet"),
    ("1-AI-6-5-B-LD", "esquiva abajo, dos ganchos, bloqueo y paso lateral"),
    ("B-5-B-4-ED-6", "dos bloqueos, esquiva y gancho"),
    ("EI-3-AD-4-BA-6", "esquiva, esquiva abajo, ballesteo y gancho"),
    ("1-ED-5-EI-4-AI", "jab, esquivas a los dos lados y esquiva abajo"),
    ("F-6-4-AI-5-B", "flexión, gancho-crochet, esquiva abajo, gancho y bloqueo"),
    ("P-6-PA-5-F-4c", "parada, paso atrás y flexión con contras"),
    ("AI-6c-6-ED-B-4", "esquiva abajo, ganchos abajo y arriba, esquiva y bloqueo"),
    ("BA-6-F-2c-AI-5", "ballesteo, flexión, recto al cuerpo y esquiva abajo"),
    ("PA-1-ED-4-B-6", "paso atrás, jab, esquiva, crochet y bloqueo"),
    # Avanzado
    ("1-6-5-4-ED-6-3-LI", "dos ganchos, esquiva, gancho-crochet y sale"),
    ("1-4c-4-5-6-3-B", "crochet abajo y arriba, dos ganchos y bloqueo"),
    ("2-5-4-AI-5c-6-3-CA", "esquiva abajo, ganchos abajo y arriba y cambio de ángulo"),
    ("1-2-ED-6-3-AI-5-PA-4", "esquiva, esquiva abajo y paso atrás con contra"),
    ("B-4-5-F-3c-6-EI-6", "bloqueo, flexión, esquiva y ganchos"),
    ("P-1-6-3-BA-4-AD-5-LD", "parada, ballesteo, esquiva abajo y sale"),
    ("1-6c-5-AI-4-B-2-EI-LI", "gancho al cuerpo, esquiva abajo, bloqueo, esquiva y sale"),
    ("ED-5-4-F-1c-6-PA-3-LD", "esquiva, flexión, paso atrás y paso lateral"),
    ("1c-5-B-6-AI-4-3-BA", "bloqueo, esquiva abajo, doble crochet y ballesteo"),
    ("4-5-EI-6-4-B-5c-6-AD", "esquiva, bloqueo, ganchos abajo y arriba y esquiva abajo"),
    ("ED-2-EI-3-AD-4-AI-5-CA", "esquivas y esquivas abajo a los dos lados y cambio de ángulo"),
    ("1-B-2-F-2c-BA-6-PA", "bloqueo, flexión, ballesteo y paso atrás"),
    ("P-2-ED-6-AI-5-AD-4-BA-6", "cinco defensas, cada una con su contra"),
    ("B-6-B-5-EI-4-F-3c", "dos bloqueos, esquiva y flexión con contras"),
    ("AI-6-ED-5-PA-1c-6-BA", "esquiva abajo, esquiva, paso atrás y ballesteo"),
    ("1-EI-4c-5-AD-6-F-4-B", "esquiva, esquiva abajo, flexión y bloqueo"),
    ("BA-5-ED-6c-6-AI-4-PA-1", "ballesteo, esquiva, esquiva abajo y paso atrás"),
    ("F-5c-B-6-EI-3-AD-4-CA", "flexión, bloqueo, esquiva, esquiva abajo y cambio de ángulo"),
]


def ids(notacion):
    return [FICHA[t] for t in notacion.split("-")]


def expandir(notacion, por_clave):
    return re.sub(r"\{([^}]+)\}", lambda m: por_clave[m.group(1)], notacion)


def texto(acciones):
    """Para el entrenador: números para los golpes, «3 al cuerpo» y las defensas y salidas como se dicen."""
    partes = []
    for a in acciones:
        token = next(t for t, i in FICHA.items() if i == a.id)
        if a.tipo == "golpe":
            partes.append(f"{token[:-1]} al cuerpo" if token.endswith("c") else token)
        else:
            partes.append(palabra_hablada(a))
    return " · ".join(partes)


def donde(acciones):
    """Dónde van las defensas: inicio (antes del primer golpe), entre golpes o final (tras el último)."""
    golpes = [i for i, a in enumerate(acciones) if a.tipo == "golpe"]
    lugares = []
    for i, a in enumerate(acciones):
        if a.tipo != "defensa":
            continue
        lugar = ("inicio" if not any(g < i for g in golpes)
                 else "final" if not any(g > i for g in golpes) else "entre golpes")
        if lugar not in lugares:
            lugares.append(lugar)
    return ", ".join(lugares) or "—"


def en_orden(corta, larga):
    resto = iter(larga)
    return all(x in resto for x in corta)


def contiguo(corta, larga):
    return any(larga[i:i + len(corta)] == corta for i in range(len(larga) - len(corta) + 1))


ACTUAL = {tuple(a.id for a in c.acciones): c for c in biblioteca()}


def respecto(ids_):
    if tuple(ids_) in ACTUAL:
        return f"se queda (antes {NIVEL[ACTUAL[tuple(ids_)].nivel]})"
    dentro = [c for k, c in ACTUAL.items() if len(k) >= 3 and contiguo(list(k), ids_)]
    if dentro:
        return f"cambia: amplía «{max(dentro, key=lambda c: len(c.acciones)).notacion}»"
    return "nueva"


def cubo(nivel, defensas):
    return "4-5" if nivel == 3 and defensas >= 4 else defensas


def preparar():
    """Todas las combinaciones, numeradas (familias primero, luego sueltas por nivel), y los problemas."""
    combos, por_clave = [], {}
    for fid, _, _, miembros in FAMILIAS:
        for clave, papel, origen, notacion, nombre in miembros:
            por_clave[clave] = expandir(notacion, por_clave)
            combos.append({"clave": clave, "familia": fid, "papel_crudo": (papel, origen),
                           "notacion": por_clave[clave], "nombre": nombre})
    sueltas = [{"clave": None, "familia": None, "papel_crudo": None, "notacion": n, "nombre": nombre}
               for n, nombre in SUELTAS]
    for c in combos + sueltas:
        c["ids"] = ids(c["notacion"])
        c["acciones"] = acciones_por_ids(c["ids"])
        c["nivel"] = nivel_de(c["acciones"])
        c["golpes"] = sum(a.tipo == "golpe" for a in c["acciones"])
        c["defensas"] = sum(a.tipo == "defensa" for a in c["acciones"])
        c["respecto"] = respecto(c["ids"])
    combos += sorted(sueltas, key=lambda c: c["nivel"] or 0)
    for n, c in enumerate(combos, 1):
        c["n"] = n
    return combos, problemas(combos)


def problemas(combos):
    """Todo lo que no cuadra; si la lista no está vacía, no se genera nada."""
    malos = []
    por_clave = {c["clave"]: c for c in combos if c["clave"]}
    for c in combos:
        if c["nivel"] is None:
            malos.append(f"{c['notacion']}: {len(c['ids'])} acciones, fuera de 2-10")
        if validar(c["acciones"]):
            malos.append(f"{c['notacion']}: {validar(c['acciones'])}")
        if c["papel_crudo"]:
            papel, origen = c["papel_crudo"]
            c["papel"] = "base"
            if papel != "base":
                o = por_clave[origen]
                c["papel"] = f"{'crece de' if papel == 'crece' else 'variante de'} #{o['n']}"
                if papel == "crece" and not (en_orden(o["ids"], c["ids"]) and o["nivel"] == (c["nivel"] or 0) - 1):
                    malos.append(f"{c['clave']} no crece de {origen} (mismo orden y nivel anterior)")
                if papel == "variante" and o["nivel"] != c["nivel"]:
                    malos.append(f"{c['clave']} no es del mismo nivel que {origen}")
    malos += [f"repetida: {'-'.join(k)}" for k, v in Counter(tuple(c["ids"]) for c in combos).items() if v > 1]
    for nivel, reparto in REPARTO.items():
        del_nivel = [c for c in combos if c["nivel"] == nivel]
        cuenta = Counter(cubo(nivel, c["defensas"]) for c in del_nivel)
        if len(del_nivel) != POR_NIVEL or dict(cuenta) != reparto:
            malos.append(f"{NIVEL[nivel]}: {len(del_nivel)} combinaciones y reparto {dict(cuenta)}; "
                         f"hace falta {POR_NIVEL} con {reparto}")
    basicas_sin_defensa = {c["notacion"] for c in combos if c["nivel"] == 1 and c["defensas"] == 0}
    malos += [f"falta el clásico {n} en básico sin defensa" for n in CLASICOS if n not in basicas_sin_defensa]
    for nivel in (None, 1, 2, 3):
        for numero_, pct in porcentajes_cara(combos, nivel).items():
            if not CARA[0] <= pct <= CARA[1]:
                malos.append(f"golpe {numero_} a la cara en {NIVEL.get(nivel, 'total')}: {pct:.1f} % "
                             f"(entre {CARA[0]} y {CARA[1]} %)")
    usos = usos_por_id(combos)
    for i in ("jab_cuerpo", "directo_cuerpo", "gancho_izq_cuerpo", "gancho_der_cuerpo",
              "uppercut_izq_cuerpo", "uppercut_der_cuerpo"):
        if usos[i] < MIN_CUERPO:
            malos.append(f"{texto(acciones_por_ids([i]))}: {usos[i]} veces (mínimo {MIN_CUERPO})")
    por_familia = Counter(a.familia for c in combos for a in c["acciones"])
    malos += [f"defensa {f}: {por_familia[f]} veces (mínimo {MIN_DEFENSA})"
              for f in DEFENSAS if por_familia[f] < MIN_DEFENSA]
    for f, (der, izq) in lados(combos).items():
        if diferencia(der, izq) > MAX_DIFERENCIA_LADO:
            malos.append(f"{f}: {der} a la derecha y {izq} a la izquierda ({diferencia(der, izq):.0f} %)")
    malos += [f"salida {s}: {usos[s]} veces (mínimo {MIN_SALIDA})" for s in SALIDAS if usos[s] < MIN_SALIDA]
    avanzadas_1 = [c for c in combos if c["nivel"] == 3 and c["defensas"] == 1]
    if avanzadas_1 and all(c["familia"] == "F1" for c in avanzadas_1):
        malos.append("todas las de avanzado con 1 defensa son de la F1")
    return malos


def usos_por_id(combos):
    return Counter(a.id for c in combos for a in c["acciones"])


def porcentajes_cara(combos, nivel=None):
    numeros = Counter(a.numero for c in combos if nivel in (None, c["nivel"]) for a in c["acciones"] if a.numero)
    total = sum(numeros.values())
    return {n: 100 * numeros[n] / total for n in range(1, 7)}


def lados(combos):
    usos = usos_por_id(combos)
    return {"esquiva": (usos["esquiva_der"], usos["esquiva_izq"]), "esquiva abajo": (usos["rodar_der"], usos["rodar_izq"])}


def diferencia(a, b):
    return 100 * abs(a - b) / max(a, b, 1)


class Uniforme:
    """Sorteo uniforme de un nivel sin repetir en 5: para estimar cuántas se dicen por sesión."""

    def __init__(self, combos, rng):
        self.combos, self.rng, self.recientes = combos, rng, []

    def siguiente(self):
        c = self.rng.choice([c for c in self.combos if c not in self.recientes])
        self.recientes = (self.recientes + [c])[-5:]
        return Combinacion(tuple(c["acciones"]), "biblioteca", c["notacion"])


def por_sesion(combos, nivel):
    cuantas = []
    for semilla in range(20):
        for ritmo in (1, 3, 5):
            rng = random.Random(semilla)
            guion = construir_guion(ConfigSesion(nivel=nivel, ritmo=ritmo), rng, Uniforme(combos, rng))
            cuantas.append(sum(e.tipo == "combo" for e in guion))
    return min(cuantas), statistics.mean(cuantas), max(cuantas)


def coma(x, decimales=1):
    return f"{x:.{decimales}f}".replace(".", ",")


def documento(combos):
    L = []
    w = L.append
    w("# Biblioteca nueva: propuesta para revisar")
    w("")
    w("> **REVISAR CON ENTRENADOR: toda esta propuesta.** Las combinaciones, sus familias y variantes, los nombres y el")
    w("> reparto. Es una propuesta: `data/combinaciones.json` y el sorteo no cambian hasta que esté revisada.")
    w("> Se genera con `python herramientas/biblioteca.py`: no editar a mano.")
    w("")
    w("## Cómo leerla")
    w("")
    w("- Todo en guardia **ortodoxa** (el zurdo lo hace en espejo). Los golpes van por número: 1 jab, 2 recto, 3 crochet")
    w("  adelantado, 4 crochet trasero, 5 gancho adelantado, 6 gancho trasero; «3 al cuerpo» es el crochet adelantado al")
    w("  cuerpo. Las defensas y salidas, como las dice la app («esquiva abajo derecha»).")
    w("- **Nivel** = número total de acciones (golpes + defensas + salidas), calculado con `motor.reglas.nivel_de`:")
    w("  básico 2-4, medio 5-6, avanzado 7-10.")
    w("- **Defensa** = esquiva, esquiva abajo, ballesteo, flexión, bloqueo, parada y paso atrás. Pivote, paso lateral y")
    w("  cambio de ángulo son **salidas**: no cuentan como defensa, pero sí como acción.")
    w("- **Defensa en**: inicio (antes del primer golpe), entre golpes, o final (después del último golpe).")
    w("- **Papel**: *base* de la familia; *crece de #n* (la del nivel anterior más acciones, en el mismo orden);")
    w("  *variante de #n* (mismo nivel, cambia un lado, un golpe o la salida).")
    w("- **Respecto a la actual**: *se queda* (ya está en la biblioteca de hoy, igual), *cambia* (amplía una de hoy")
    w("  de 3 o más acciones) o *nueva*.")
    w("")
    w("## Resumen")
    w("")
    resumen_reparto(w, combos)
    w("")
    resumen_sesion(w, combos)
    w("")
    resumen_vocabulario(w, combos)
    w("")
    w("## Familias")
    w("")
    for fid, fnombre, idea, _ in FAMILIAS:
        w(f"### {fid}. {fnombre}")
        w("")
        w(idea)
        w("")
        tabla(w, [c for c in combos if c["familia"] == fid])
        w("")
    w("## Sueltas")
    w("")
    for nivel in (1, 2, 3):
        w(f"### {NIVEL[nivel].capitalize()}")
        w("")
        tabla(w, [c for c in combos if c["familia"] is None and c["nivel"] == nivel])
        w("")
    salen(w, combos)
    return "\n".join(L) + "\n"


def tabla(w, combos):
    w("| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel "
      "| Respecto a la actual |")
    w("|---|---|---|---|---|---|---|---|---|---|---|")
    for c in combos:
        a = c["acciones"]
        salidas = ", ".join(palabra_hablada(x) for x in a if x.tipo == "movimiento") or "—"
        w(f"| {c['n']} | {c['nombre']} | {c.get('papel', '—')} | {texto(a)} | {len(a)} | {c['golpes']} "
          f"| {c['defensas']} | {salidas} | {donde(a)} | {NIVEL[c['nivel']]} | {c['respecto']} |")


def resumen_reparto(w, combos):
    w("### Reparto de defensas por nivel")
    w("")
    w("| Nivel | Combinaciones | Defensas | Hay | % real | % pedido | Desviación |")
    w("|---|---|---|---|---|---|---|")
    for nivel, reparto in REPARTO.items():
        del_nivel = [c for c in combos if c["nivel"] == nivel]
        cuenta = Counter(cubo(nivel, c["defensas"]) for c in del_nivel)
        for clave, pedido in reparto.items():
            real, objetivo = 100 * cuenta[clave] / len(del_nivel), 100 * pedido / POR_NIVEL
            w(f"| {NIVEL[nivel]} | {len(del_nivel)} | {clave} | {cuenta[clave]} | {real:.0f} % | {objetivo:.0f} % "
              f"| {real - objetivo:+.0f} |")
    w("")
    w(f"**Total: {len(combos)} combinaciones**, {POR_NIVEL} por nivel "
      f"({sum(c['familia'] is not None for c in combos)} en {len(FAMILIAS)} familias y "
      f"{sum(c['familia'] is None for c in combos)} sueltas). El reparto cuadra exacto: desviación 0 en todos.")
    w(f"Los clásicos {', '.join(CLASICOS)} están en básico sin defensa.")


def resumen_sesion(w, combos):
    w("### Cuántas veces sale cada una")
    w("")
    w("| Nivel | Combinaciones | Se dicen por sesión Amateur 3×3 (mín · media · máx) | Veces que sale cada una "
      "(media) | Con 25 | Con 15 |")
    w("|---|---|---|---|---|---|")
    for nivel in (1, 2, 3):
        del_nivel = [c for c in combos if c["nivel"] == nivel]
        minimo, media, maximo = por_sesion(del_nivel, nivel)
        w(f"| {NIVEL[nivel]} | {len(del_nivel)} | {minimo} · {coma(media, 0)} · {maximo} "
          f"| {coma(media / len(del_nivel))} | {coma(media / 25)} | {coma(media / 15)} |")
    w("")
    w("Sale de simular 60 sesiones Amateur por nivel (ritmos 1, 3 y 5) con estas combinaciones, sorteando solo de su")
    w("nivel y sin repetir ninguna de las 5 últimas. Las columnas «Con 25» y «Con 15» dicen cuántas veces saldría cada")
    w("una si el nivel tuviera solo 25 o 15 combinaciones.")


def resumen_vocabulario(w, combos):
    w("### Balance de golpes, defensas y salidas")
    w("")
    w(f"Comprobado por el script: cada golpe a la cara entre el {CARA[0]} y el {CARA[1]} % de los golpes a la cara "
      f"(en total y en cada nivel); cada golpe al cuerpo, al menos {MIN_CUERPO} veces; cada defensa, al menos "
      f"{MIN_DEFENSA}; derecha e izquierda de cada defensa con lado, a menos de un {MAX_DIFERENCIA_LADO} % de "
      f"diferencia; cada salida, al menos {MIN_SALIDA}.")
    w("")
    w("**Golpes a la cara** (% sobre los golpes a la cara)")
    w("")
    w("| Golpe | Veces | Total | Básico | Medio | Avanzado |")
    w("|---|---|---|---|---|---|")
    numeros = Counter(a.numero for c in combos for a in c["acciones"] if a.numero)
    por_nivel = {n: porcentajes_cara(combos, n) for n in (None, 1, 2, 3)}
    nombres = {1: "1 jab", 2: "2 recto", 3: "3 crochet adelantado", 4: "4 crochet trasero",
               5: "5 gancho adelantado", 6: "6 gancho trasero"}
    for n in range(1, 7):
        w(f"| {nombres[n]} | {numeros[n]} | " + " | ".join(f"{coma(por_nivel[x][n])} %" for x in (None, 1, 2, 3)) + " |")
    w("")
    usos = usos_por_id(combos)
    w("**Golpes al cuerpo**")
    w("")
    w("| Golpe | Veces |")
    w("|---|---|")
    for token in ("1c", "2c", "3c", "4c", "5c", "6c"):
        w(f"| {token[0]} al cuerpo | {usos[FICHA[token]]} |")
    w("")
    w("**Defensas y salidas**")
    w("")
    w("| Acción | Veces | Derecha | Izquierda |")
    w("|---|---|---|---|")
    por_familia = Counter(a.familia for c in combos for a in c["acciones"])
    con_lado = lados(combos)
    nombres_def = {"esquiva": "esquiva", "rodar": "esquiva abajo", "ballesteo": "ballesteo", "flexion": "flexión",
                   "bloqueo": "bloqueo", "parada": "parada", "paso_atras": "paso atrás"}
    for f in DEFENSAS:
        der, izq = con_lado.get(nombres_def[f], ("—", "—"))
        w(f"| {nombres_def[f]} | {por_familia[f]} | {der} | {izq} |")
    w(f"| paso lateral | {usos['paso_lateral_der'] + usos['paso_lateral_izq']} | {usos['paso_lateral_der']} "
      f"| {usos['paso_lateral_izq']} |")
    w(f"| pivote | {usos['pivote']} | — | — |")
    w(f"| cambio de ángulo | {usos['salir']} | — | — |")


def salen(w, combos):
    nuevas = {tuple(c["ids"]) for c in combos}
    ampliadas = {c["respecto"].split("«")[1].rstrip("»") for c in combos if c["respecto"].startswith("cambia")}
    fuera = [c for k, c in ACTUAL.items() if k not in nuevas]
    w("## Las de la biblioteca actual que salen")
    w("")
    w(f"De las {len(ACTUAL)} de hoy se quedan {len(ACTUAL) - len(fuera)} y salen {len(fuera)}. "
      "Las que salen, con su nivel de hoy, el que les daría `nivel_de` y si alguna nueva las amplía:")
    w("")
    w("| Hoy | Nivel de hoy | Con nivel_de | Ampliada en la propuesta |")
    w("|---|---|---|---|")
    for c in fuera:
        w(f"| {texto(c.acciones)} | {NIVEL[c.nivel]} | {NIVEL.get(nivel_de(c.acciones), 'ninguno')} "
          f"| {'sí' if c.notacion in ampliadas else '—'} |")


def main():
    combos, malos = preparar()
    if malos:
        print("No se genera nada: hay que corregir esto.\n- " + "\n- ".join(malos))
        raise SystemExit(1)
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(documento(combos), encoding="utf-8")
    print(f"{len(combos)} combinaciones en {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
