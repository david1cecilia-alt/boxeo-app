"""Biblioteca de combinaciones: sus datos, sus comprobaciones y el documento para revisar.

Escribe data/combinaciones.json (lo que sortea la app) y docs/revision/biblioteca-propuesta.md. Las dudas de
técnica (las marcadas aquí con REVISAR CON ENTRENADOR y las de dos ganchos seguidos) pasan a los datos en
«revisar»: después hay que regenerar data/revisar.json con herramientas/extraer_revisar.py. Antes comprueba con el motor que todo cuadra (nivel con
motor.reglas.nivel_de, reparto de defensas exacto, clásicos, balance de golpes, defensas, lados y salidas, y las
reglas de los nombres de fallos_del_nombre) y, si algo falla, no escribe nada y dice qué.
Uso: python herramientas/biblioteca.py
"""
import json
import random
import re
import statistics
import sys
from collections import Counter
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from motor.acciones import ComboBiblioteca, acciones_por_ids, catalogo, notacion, palabra_hablada  # noqa: E402
from motor.reglas import nivel_de, validar  # noqa: E402
from motor.sorteo import Combinacion  # noqa: E402
from motor.temporizador import ConfigSesion, construir_guion  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "docs" / "revision" / "biblioteca-propuesta.md"
DATOS = RAIZ / "data" / "combinaciones.json"
# La biblioteca de antes (83 combinaciones), para decir qué se queda, qué cambia y qué sale.
ANTERIOR = RAIZ / "docs" / "revision" / "biblioteca-anterior.json"
MARCA = "REVISAR CON ENTRENADOR:"

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
CLASICOS = ["1-2-3-2", "1-3-2", "1-2-5-2", "1-2-1-2", "3-2-3", "1-2-3", "1-1-2"]  # básico, sin defensa
# % de cada golpe 1-6 sobre los golpes a la cara (mín, máx), en total y en cada nivel.
# Los golpes 1-6 valen lo mismo; solo el jab puede salir más.
CARA = {1: (20, 30), 2: (13, 17), 3: (13, 17), 4: (13, 17), 5: (13, 17), 6: (13, 17)}
MIN_EMPIEZAN_JAB = 50    # % de las que empiezan por golpe que empiezan con el jab (a la cara)
MIN_CUERPO = 6           # veces de cada golpe al cuerpo, en total
MIN_DEFENSA = 12         # veces de cada tipo de defensa, en total
MAX_DIFERENCIA_LADO = 20  # % entre derecha e izquierda de cada defensa con lado
MIN_SALIDA = 6           # veces de cada salida, en total
MAX_DOS_GANCHOS = 5      # combinaciones de cada nivel con 5-6 o 6-5 seguidos (a la cara o al cuerpo)
DEFENSAS = ["esquiva", "rodar", "ballesteo", "flexion", "bloqueo", "parada", "paso_atras"]
SALIDAS = ["pivote", "paso_lateral_izq", "paso_lateral_der", "salir"]

# Familias: (id, nombre, idea, miembros). Cada miembro: (clave, papel, origen, notación, nombre).
# papel: base | crece (de origen, del nivel anterior) | variante (de origen, del mismo nivel).
# En la notación, {clave} es la combinación de esa clave: «{F1-B}-6-4» = la F1-B y luego 6-4.
FAMILIAS = [
    ("F1", "Crochet y rueda", "Jab, crochet, se hace la rueda y se devuelve.", [
        ("F1-B", "base", None, "1-3-AD", "jab-crochet y rueda derecha"),
        ("F1-Bb", "variante", "F1-B", "1-3-AI", "jab-crochet y rueda izquierda"),
        ("F1-M", "crece", "F1-B", "{F1-B}-6-4", "jab-crochet, rueda y gancho-crochet"),
        ("F1-Mb", "variante", "F1-M", "1-3-AD-4-2", "jab-crochet, rueda y crochet-recto"),
        ("F1-A", "crece", "F1-M", "{F1-M}-CA-3", "jab-crochet, rueda, cambio de ángulo y crochet"),
        ("F1-Ab", "variante", "F1-A", "{F1-M}-PI-3", "jab-crochet, rueda, pivote y crochet"),
    ]),
    ("F2", "Jab-recto", "La base de todo, a la que se le añaden esquivas y contras.", [
        ("F2-B", "base", None, "1-2", "jab-recto"),
        ("F2-Bb", "variante", "F2-B", "1-1-2", "doble jab y recto"),
        ("F2-M", "crece", "F2-B", "{F2-B}-EI-5-4", "jab-recto, esquiva y gancho-crochet"),
        ("F2-Mb", "variante", "F2-M", "{F2-Bb}-ED-6", "doble jab-recto, esquiva y gancho"),
        ("F2-A", "crece", "F2-M", "{F2-M}-AD-1-LI", "jab-recto con esquiva, rueda, jab y paso lateral"),
        ("F2-Ab", "variante", "F2-A", "{F2-Mb}-3-B-6", "doble jab-recto, esquiva, gancho-crochet, bloqueo y gancho"),
    ]),
    ("F3", "Ballesteo y contra", "Se saca la cara hacia atrás y se contesta.", [
        ("F3-B", "base", None, "BA-2", "ballesteo y recto"),
        ("F3-Bb", "variante", "F3-B", "BA-1-4", "ballesteo y jab-crochet"),
        ("F3-M", "crece", "F3-B", "1-{F3-B}-3-4", "jab, ballesteo, recto y doble crochet"),
        ("F3-Mb", "variante", "F3-M", "{F3-Bb}-AI-3", "ballesteo, jab-crochet, rueda y crochet"),
        ("F3-A", "crece", "F3-M", "{F3-M}-BA-5-PI", "jab, dos ballesteos, gancho y pivote"),
        ("F3-Ab", "variante", "F3-A", "{F3-Mb}-F-4c-3-LD", "ballesteo, jab-crochet, rueda, flexión y paso lateral"),
    ]),
    ("F4", "Parada y contra", "Se para el jab con la derecha y se contesta.", [
        ("F4-B", "base", None, "P-1-2", "parada y jab-recto"),
        ("F4-Bb", "variante", "F4-B", "P-6-3-B", "parada, gancho-crochet y bloqueo"),
        ("F4-M", "crece", "F4-B", "{F4-B}-ED-4-3", "parada, jab-recto, esquiva y doble crochet"),
        ("F4-Mb", "variante", "F4-M", "{F4-Bb}-1-6", "parada, bloqueo, jab y gancho"),
        ("F4-A", "crece", "F4-M", "{F4-M}-5-B-6", "parada, esquiva, gancho, bloqueo y gancho"),
        ("F4-Ab", "variante", "F4-A", "{F4-M}-PA-1-2-LI", "parada, esquiva, paso atrás, jab-recto y paso lateral"),
    ]),
    ("F5", "Abajo y arriba", "Golpes al cuerpo para bajar la guardia del rival y subir a la cara.", [
        ("F5-B", "base", None, "1c-2", "jab al cuerpo y recto"),
        ("F5-Bb", "variante", "F5-B", "6-3c-3", "gancho y crochet abajo y arriba"),
        ("F5-M", "crece", "F5-B", "{F5-B}-F-3c-3", "jab al cuerpo, recto, flexión y crochet abajo y arriba"),
        ("F5-Mb", "variante", "F5-M", "{F5-Bb}-F-1-6", "gancho, crochet abajo y arriba, flexión y jab-gancho"),
        ("F5-A", "crece", "F5-M", "{F5-M}-AD-4c-6", "jab al cuerpo, flexión, crochet abajo y arriba, rueda y gancho"),
        ("F5-Ab", "variante", "F5-A", "{F5-Mb}-B-6", "gancho, crochet abajo y arriba, flexión, bloqueo y gancho"),
    ]),
    ("F6", "Esquiva a los dos lados", "Esquiva lateral, se suelta y se vuelve a esquivar.", [
        ("F6-B", "base", None, "ED-6-5-EI", "esquiva derecha, dos ganchos y esquiva izquierda"),
        ("F6-Bb", "variante", "F6-B", "EI-5-4-ED", "esquiva izquierda, gancho-crochet y esquiva derecha"),
        ("F6-M", "crece", "F6-B", "{F6-B}-1-2", "esquiva derecha, dos ganchos, esquiva izquierda y jab-recto"),
        ("F6-Mb", "variante", "F6-M", "{F6-Bb}-6-B", "esquivas a los dos lados, gancho y bloqueo"),
        ("F6-A", "crece", "F6-M", "{F6-M}-AD-4-5", "esquivas a los dos lados, rueda y crochet-gancho"),
        ("F6-Ab", "variante", "F6-A", "{F6-Mb}-5-2-PI", "esquivas, bloqueo, gancho-recto y pivote"),
    ]),
    ("F7", "Bloqueo", "Bloquear, devolver y, si toca, volver a bloquear.", [
        ("F7-B", "base", None, "B-3-2", "bloqueo y crochet-recto"),
        ("F7-Bb", "variante", "F7-B", "B-5-6-B", "bloqueo, dos ganchos y bloqueo"),  # REVISAR CON ENTRENADOR: dos ganchos seguidos
        ("F7-Bc", "variante", "F7-B", "1-6-B", "jab-gancho y bloqueo"),  # REVISAR CON ENTRENADOR: jab y gancho trasero
        ("F7-M", "crece", "F7-B", "1-{F7-B}-PA-2", "jab, bloqueo, crochet-recto, paso atrás y recto"),
        ("F7-Mb", "variante", "F7-M", "{F7-Bb}-1-4", "dos bloqueos, jab y crochet"),
        ("F7-A", "crece", "F7-M", "{F7-M}-ED-4-LD", "jab, bloqueo, paso atrás, esquiva, crochet y paso lateral"),
        ("F7-Ab", "variante", "F7-A", "{F7-Mb}-EI-5-BA-2", "dos bloqueos, esquiva, gancho, ballesteo y recto"),
    ]),
    ("F8", "Paso atrás y contra", "Se rompe la distancia y se contesta.", [
        ("F8-B", "base", None, "PA-2", "paso atrás y recto"),
        ("F8-Bb", "variante", "F8-B", "PA-1-4-PA", "paso atrás, jab-crochet y paso atrás"),
        ("F8-M", "crece", "F8-B", "1-1-{F8-B}-5", "doble jab, paso atrás y recto-gancho"),
        ("F8-Mb", "variante", "F8-M", "{F8-M}-PI", "doble jab, paso atrás, recto-gancho y pivote"),
        ("F8-A", "crece", "F8-M", "{F8-M}-F-3c-6-LD", "doble jab, paso atrás, flexión, gancho y paso lateral"),
        ("F8-Ab", "variante", "F8-A", "{F8-Mb}-ED-1-5", "doble jab, paso atrás, pivote, esquiva y jab-gancho"),
    ]),
    ("F9", "Gancho y crochet", "Ganchos (5 y 6) en la corta, rematados con crochet o recto.", [
        ("F9-B", "base", None, "6-3", "gancho-crochet"),
        ("F9-Bb", "variante", "F9-B", "4-5-6", "crochet y dos ganchos"),  # REVISAR CON ENTRENADOR: dos ganchos seguidos
        ("F9-M", "crece", "F9-B", "1-2-{F9-B}-AI", "jab-recto, gancho-crochet y rueda"),  # REVISAR CON ENTRENADOR: recto y gancho trasero seguidos (misma mano)
        ("F9-Mb", "variante", "F9-M", "1-{F9-Bb}-AD", "jab-crochet, dos ganchos y rueda"),
        ("F9-A", "crece", "F9-M", "{F9-M}-1-2-EI", "jab-recto, gancho-crochet, rueda, jab-recto y esquiva"),  # REVISAR CON ENTRENADOR: recto y gancho trasero seguidos (misma mano)
        ("F9-Ab", "variante", "F9-A", "{F9-Mb}-5c-3-BA", "jab-crochet, dos ganchos, rueda, gancho al cuerpo y ballesteo"),
    ]),
    ("F10", "Doble jab", "Doble jab para entrar, y lo que venga.", [
        ("F10-B", "base", None, "1-1-5", "doble jab y gancho"),
        ("F10-Bb", "variante", "F10-B", "1-1-6-5", "doble jab y dos ganchos"),  # REVISAR CON ENTRENADOR: dos ganchos seguidos
        ("F10-M", "crece", "F10-B", "{F10-B}-EI-4", "doble jab, gancho, esquiva y crochet"),
        ("F10-Mb", "variante", "F10-M", "{F10-Bb}-BA-2", "doble jab, dos ganchos, ballesteo y recto"),
        ("F10-A", "crece", "F10-M", "{F10-M}-1-AD-4-5", "doble jab, esquiva, jab, rueda y crochet-gancho"),
        ("F10-Ab", "variante", "F10-A", "{F10-Mb}-B-1-6", "doble jab, ballesteo, bloqueo y jab-gancho"),
    ]),
    ("F11", "Flexión y cuerpo", "Se baja con flexión y se ataca al cuerpo.", [
        ("F11-B", "base", None, "F-3c-5", "flexión, crochet al cuerpo y gancho"),
        ("F11-Bb", "variante", "F11-B", "F-6c-5", "flexión y gancho abajo y arriba"),
        ("F11-M", "crece", "F11-B", "{F11-B}-4-B", "flexión, crochet al cuerpo, gancho-crochet y bloqueo"),
        ("F11-Mb", "variante", "F11-M", "{F11-Bb}-AD-1-2", "flexión, gancho abajo y arriba, rueda y jab-recto"),
        ("F11-A", "crece", "F11-M", "{F11-M}-6c-3-EI", "flexión, bloqueo, gancho al cuerpo, crochet y esquiva"),
        ("F11-Ab", "variante", "F11-A", "{F11-Mb}-F-1c-2", "flexión, gancho abajo y arriba, rueda, flexión y recto"),
    ]),
    ("F12", "Esquiva abajo a los dos lados", "Esquivar abajo, soltar y cambiar de lado.", [
        ("F12-B", "base", None, "AI-3-AD-4", "rueda y crochet a los dos lados"),
        ("F12-Bb", "variante", "F12-B", "AD-4-AI-5", "rueda derecha, crochet, rueda izquierda y gancho"),
        ("F12-M", "crece", "F12-B", "{F12-B}-1-2", "ruedas con crochet y jab-recto"),
        ("F12-Mb", "variante", "F12-M", "{F12-Bb}-4-F",
         "rueda derecha, crochet, rueda izquierda y gancho-crochet"),
        ("F12-A", "crece", "F12-M", "{F12-M}-ED-1-4c", "ruedas, esquiva, jab y crochet al cuerpo"),
        ("F12-Ab", "variante", "F12-A", "{F12-Mb}-5c-5-PA-2", "ruedas, flexión, gancho abajo y arriba, paso atrás y recto"),
    ]),
    ("F13", "Jab arriba y abajo", "El jab cambia de altura para abrir hueco.", [
        ("F13-B", "base", None, "1-1c-6", "jab arriba, jab abajo y gancho"),
        ("F13-Bb", "variante", "F13-B", "1c-1-4", "jab abajo, jab arriba y crochet"),  # REVISAR CON ENTRENADOR: crochet trasero tras dos jabs
        ("F13-M", "crece", "F13-B", "{F13-B}-ED-2", "jab arriba y abajo, gancho, esquiva y recto"),
        ("F13-Mb", "variante", "F13-M", "{F13-Bb}-PA-6", "jab abajo y arriba, crochet, paso atrás y gancho"),
        ("F13-A", "crece", "F13-M", "{F13-M}-1-B-4c-4", "jab arriba y abajo, esquiva, jab, bloqueo y crochet abajo y arriba"),
        ("F13-Ab", "variante", "F13-A", "{F13-Mb}-F-3c-6-LI",
         "jab abajo y arriba, paso atrás, flexión, crochet al cuerpo, gancho y paso lateral"),
    ]),
    ("F14", "Parada y al cuerpo", "Se para el jab y se contesta abajo.", [
        ("F14-B", "base", None, "P-2c-5", "parada, recto al cuerpo y gancho"),
        ("F14-Bb", "variante", "F14-B", "P-1-2c", "parada, jab y recto al cuerpo"),
        ("F14-M", "crece", "F14-B", "{F14-B}-AI-6-3", "parada, recto al cuerpo, gancho, rueda y gancho-crochet"),
        ("F14-Mb", "variante", "F14-M", "{F14-Bb}-BA-4", "parada, jab, recto al cuerpo, ballesteo y crochet"),
        ("F14-A", "crece", "F14-M", "{F14-M}-ED-1-CA", "parada, rueda, esquiva, jab y cambio de ángulo"),
        ("F14-Ab", "variante", "F14-A", "{F14-Mb}-B-1-2-PI", "parada, ballesteo, bloqueo, jab-recto y pivote"),
    ]),
    ("F15", "Cambio de ángulo", "Se suelta, se cambia de ángulo y se ataca desde el nuevo sitio.", [
        ("F15-B", "base", None, "1-2-CA", "jab-recto y cambio de ángulo"),
        ("F15-Bb", "variante", "F15-B", "4-3-CA", "doble crochet y cambio de ángulo"),
        ("F15-M", "crece", "F15-B", "{F15-B}-5-EI-6", "jab-recto, cambio de ángulo, gancho, esquiva y gancho"),
        ("F15-Mb", "variante", "F15-M", "{F15-Bb}-5-PA", "doble crochet, cambio de ángulo, gancho y paso atrás"),
        ("F15-A", "crece", "F15-M", "{F15-M}-B-4-5", "jab-recto, cambio de ángulo, esquiva, bloqueo y crochet-gancho"),
        ("F15-Ab", "variante", "F15-A", "{F15-Mb}-1-AD-4-LI", "doble crochet, cambio de ángulo, paso atrás, rueda y paso lateral"),
    ]),
    ("F16", "Pivote", "Se suelta y se pivota para no quedarse delante.", [
        ("F16-B", "base", None, "6-3-PI", "gancho-crochet y pivote"),
        ("F16-Bb", "variante", "F16-B", "4-3-PI", "doble crochet y pivote"),
        ("F16-M", "crece", "F16-B", "B-{F16-B}-1", "bloqueo, gancho-crochet, pivote y jab"),
        ("F16-Mb", "variante", "F16-M", "{F16-Bb}-AD-6", "doble crochet, pivote, rueda y gancho"),
        ("F16-A", "crece", "F16-M", "{F16-M}-EI-1-BA-6", "bloqueo, pivote, esquiva, jab, ballesteo y gancho"),
        ("F16-Ab", "variante", "F16-A", "{F16-Mb}-3-F-6c-ED", "doble crochet, pivote, rueda, flexión y esquiva"),
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
    ("1-2-3", "jab-recto-crochet"),
    # Básico con defensa
    ("EI-5-4", "esquiva izquierda y gancho-crochet"),
    ("1-5c-4-B", "jab, gancho al cuerpo, crochet y bloqueo"),
    ("ED-6-3", "esquiva derecha y gancho-crochet"),
    ("1-ED-6-BA", "jab, esquiva, gancho y ballesteo"),
    ("PA-1-6-B", "paso atrás, jab-gancho y bloqueo"),
    ("ED-4-EI-5", "esquiva y crochet, esquiva y gancho"),
    ("F-5c-4-B", "flexión, gancho al cuerpo, crochet y bloqueo"),
    ("P-1-AD", "parada, jab y rueda"),
    ("AI-4c-5-PA", "rueda, crochet al cuerpo, gancho y paso atrás"),
    ("1-BA-6-F", "jab, ballesteo, gancho y flexión"),  # REVISAR CON ENTRENADOR: tras el ballesteo, gancho y no recto
    ("EI-6c-4-ED", "esquiva, gancho al cuerpo, crochet y esquiva"),
    # Medio
    ("1-2-4-3-EI", "jab-recto, doble crochet y esquiva"),
    ("ED-4-5-AI-1-PI", "esquiva, crochet-gancho, rueda, jab y pivote"),
    ("1-2-B-6-3-EI", "jab-recto, bloqueo, gancho-crochet y esquiva"),
    ("F-2c-3-4-PA", "flexión, recto al cuerpo, doble crochet y paso atrás"),
    ("P-1-AI-5-2", "parada, jab, rueda y gancho-recto"),
    ("BA-2-3-AI-6", "ballesteo, recto-crochet, rueda y gancho"),
    ("1c-2-B-4-ED", "jab al cuerpo, recto, bloqueo, crochet y esquiva"),
    ("PA-2-5-F-3c", "paso atrás, recto-gancho, flexión y crochet al cuerpo"),
    ("EI-5c-3-BA-1", "esquiva, gancho al cuerpo, crochet, ballesteo y jab"),
    ("1-AI-3-5-B-LD", "jab, rueda, crochet-gancho, bloqueo y paso lateral"),
    ("B-4-B-3-ED-6", "dos bloqueos con crochet, esquiva y gancho"),
    ("EI-5-AD-4-BA-6", "esquiva, gancho, rueda, crochet, ballesteo y gancho"),
    ("1-ED-6-EI-5-AI", "jab, esquiva, gancho, esquiva, gancho y rueda"),
    ("F-1-2-AI-5-B", "flexión, jab-recto, rueda, gancho y bloqueo"),
    ("P-1-PA-2-F-4c", "parada, jab, paso atrás, recto, flexión y crochet al cuerpo"),
    ("AI-6c-3-ED-B-4", "rueda, gancho al cuerpo, crochet, esquiva, bloqueo y crochet"),
    ("BA-2-F-2c-AI-3", "ballesteo, recto, flexión, recto al cuerpo, rueda y crochet"),
    ("PA-1-ED-4-B-6", "paso atrás, jab, esquiva, crochet, bloqueo y gancho"),
    # Avanzado
    ("1-2-3-6-ED-6-3-LI", "jab-recto-crochet-gancho, esquiva, gancho-crochet y paso lateral"),
    ("1-4c-2-3-5-4-B", "jab, crochet al cuerpo, recto-crochet, gancho-crochet y bloqueo"),
    ("1-2-4-AI-5c-3-2-CA", "jab-recto-crochet, rueda, gancho al cuerpo y cambio de ángulo"),
    ("1-2-ED-4-3-AI-5-PA-2", "jab-recto, esquiva, rueda, gancho, paso atrás y recto"),
    ("B-1-2-F-3c-1-EI-6", "bloqueo, jab-recto, flexión, crochet al cuerpo, jab, esquiva y gancho"),
    ("P-1-2-3-BA-2-AD-4-LD", "parada, jab-recto-crochet, ballesteo, rueda y paso lateral"),
    ("1-6c-3-AI-3-B-5-EI-LI", "jab, gancho al cuerpo, rueda, bloqueo, esquiva y paso lateral"),
    ("ED-2-3-F-1c-6-PA-1-LD", "esquiva, flexión con jab al cuerpo, paso atrás, jab y paso lateral"),
    ("1c-2-B-6-AI-3-1-BA", "jab al cuerpo, bloqueo, gancho, rueda, crochet-jab y ballesteo"),
    ("1-1-EI-2-5-B-5c-4-AD", "doble jab, esquiva, bloqueo, gancho al cuerpo y rueda"),
    ("ED-2-EI-3-AD-4-AI-5-CA", "esquiva y recto, esquiva y crochet, dos ruedas y cambio de ángulo"),
    ("1-B-5-F-2c-BA-6-PA", "jab, bloqueo, gancho, flexión, ballesteo y paso atrás"),  # REVISAR CON ENTRENADOR: tras el bloqueo, gancho y no recto
    ("P-1-ED-2-AI-3-AD-4-BA-4", "parada, jab, esquiva, recto, ruedas, ballesteo y crochet"),
    ("B-1-B-5-EI-5-F-3c", "dos bloqueos, esquiva, gancho, flexión y crochet al cuerpo"),  # REVISAR CON ENTRENADOR: tras el bloqueo, gancho y no recto
    ("AI-3-ED-4-PA-1c-6-BA", "rueda, esquiva, paso atrás, jab al cuerpo, gancho y ballesteo"),
    ("1-EI-4c-2-AD-3-F-5-B", "jab, esquiva, rueda, flexión, gancho y bloqueo"),
    ("BA-2-ED-6c-3-AI-4-PA-1", "ballesteo, esquiva, rueda y paso atrás con jab"),
    ("F-5c-B-4-EI-3-AD-6-CA", "flexión, gancho al cuerpo, bloqueo, crochet, esquiva y cambio de ángulo"),
]


# Palabras de los nombres y su familia en data/acciones.json. Los nombres solo usan estas palabras, «y» y «con».
PALABRA_GOLPE = {"jab": "jab", "recto": "directo", "crochet": "gancho", "gancho": "uppercut"}
PALABRA_OTRA = {"rueda": "rodar", "esquiva": "esquiva", "ballesteo": "ballesteo", "flexión": "flexion",
                "bloqueo": "bloqueo", "parada": "parada", "paso atrás": "paso_atras", "paso lateral": "paso_lateral",
                "pivote": "pivote", "cambio de ángulo": "salir"}
PLURAL = {"jabs": "jab", "rectos": "recto", "crochets": "crochet", "ganchos": "gancho",
          "ruedas": "rueda", "esquivas": "esquiva", "ballesteos": "ballesteo", "flexiones": "flexión", "bloqueos": "bloqueo"}
CONECTORES = {"y", "con"}
# Las largas primero: «esquivas» antes que «esquiva».
_PALABRAS = sorted([*PALABRA_GOLPE, *PALABRA_OTRA, *PLURAL], key=len, reverse=True)
MENCION = re.compile(r"\b(doble |dos )?(" + "|".join(_PALABRAS) + r")\b"
                     r"( al cuerpo| abajo y arriba| arriba y abajo| arriba| abajo| derecha| izquierda| a los dos lados)?")


def menciones(nombre):
    """Lo que nombra, en orden: [(familia, objetivo, lado, pegado al anterior)]; objetivo/lado None = cualquiera.

    «X-Y» y «doble X» van pegados (dos iguales seguidos); «X abajo y arriba» son dos X seguidos, al cuerpo y a la
    cabeza; «dos X» o «Xs», dos X no hace falta seguidos. Un golpe sin altura es a la cabeza; una defensa sin lado,
    a cualquiera; «a los dos lados», una a cada lado en cualquier orden.
    """
    piezas, fin = [], 0
    for m in MENCION.finditer(nombre):
        cantidad, palabra, detalle = m.groups()
        pegado, dos = nombre[fin:m.start()] == "-", cantidad is not None or palabra in PLURAL
        palabra, detalle = PLURAL.get(palabra, palabra), (detalle or "").strip()
        if palabra in PALABRA_GOLPE:
            familia = PALABRA_GOLPE[palabra]
            if detalle in ("abajo y arriba", "arriba y abajo"):
                alturas = ["cuerpo", "cabeza"] if detalle == "abajo y arriba" else ["cabeza", "cuerpo"]
                piezas += [(familia, alturas[0], None, pegado), (familia, alturas[1], None, True)]
            elif dos:
                piezas += [(familia, None, None, pegado), (familia, None, None, cantidad == "doble ")]
            else:
                piezas.append((familia, "cuerpo" if detalle in ("al cuerpo", "abajo") else "cabeza", None, pegado))
        else:
            lado = {"derecha": "der", "izquierda": "izq"}.get(detalle)
            piezas += [(PALABRA_OTRA[palabra], None, lado, pegado)] * (2 if dos or detalle == "a los dos lados" else 1)
        fin = m.end()
    return piezas


def _encaja(pieza, a):
    familia, objetivo, lado, _ = pieza
    return a.familia == familia and objetivo in (None, a.objetivo) and lado in (None, a.lado)


def nombre_cuadra(nombre, acciones):
    """Lo que nombra está en la combinación, en el mismo orden y empezando por la primera acción (puede saltarse)."""
    piezas = menciones(nombre)

    def desde(p, anterior):
        if p == len(piezas):
            return True
        candidatos = [anterior + 1] if p == 0 or piezas[p][3] else range(anterior + 1, len(acciones))
        return any(i < len(acciones) and _encaja(piezas[p], acciones[i]) and desde(p + 1, i) for i in candidatos)

    return desde(0, -1)


def fallos_del_nombre(nombre, acciones):
    """Reglas de los nombres: R1 empieza por la primera acción, R2 nombra un golpe, R3 lo que nombra está y en el
    mismo orden, R4 no dice la mano del golpe y R5 solo usa el vocabulario de las acciones."""
    piezas, fallos = menciones(nombre), []
    if not piezas or not _encaja(piezas[0], acciones[0]):
        fallos.append("no empieza por la primera acción")
    elif not nombre_cuadra(nombre, acciones):
        fallos.append("nombra algo que no está o en otro orden")
    if not any(familia in PALABRA_GOLPE.values() for familia, *_ in piezas):
        fallos.append("no nombra ningún golpe")
    if re.search(r"\bde (derecha|izquierda)\b", nombre):
        fallos.append("dice la mano del golpe")
    sobran = [p for p in re.split(r"[\s,-]+", MENCION.sub(" ", nombre)) if p and p not in CONECTORES]
    if sobran:
        fallos.append(f"palabras fuera del vocabulario: {' '.join(sobran)}")
    return fallos


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


def _anterior():
    crudo = json.loads(ANTERIOR.read_text(encoding="utf-8"))["combinaciones"]
    return {tuple(c["ids"]): ComboBiblioteca(c["notacion"], c["nivel"], tuple(acciones_por_ids(c["ids"])), c.get("nombre"))
            for c in crudo}


ANTES = _anterior()


def respecto(ids_):
    if tuple(ids_) in ANTES:
        return f"se queda (antes {NIVEL[ANTES[tuple(ids_)].nivel]})"
    dentro = [c for k, c in ANTES.items() if len(k) >= 3 and contiguo(list(k), ids_)]
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
            combos.append({"clave": clave, "familia": fid, "papel_crudo": (papel, origen), "cruda": notacion,
                           "notacion": por_clave[clave], "nombre": nombre})
    sueltas = [{"clave": None, "familia": None, "papel_crudo": None, "cruda": n, "notacion": n, "nombre": nombre}
               for n, nombre in SUELTAS]
    marcadas = marcas()
    for c in combos + sueltas:
        c["ids"] = ids(c["notacion"])
        c["acciones"] = acciones_por_ids(c["ids"])
        c["nivel"] = nivel_de(c["acciones"])
        c["golpes"] = sum(a.tipo == "golpe" for a in c["acciones"])
        c["defensas"] = sum(a.tipo == "defensa" for a in c["acciones"])
        c["respecto"] = respecto(c["ids"])
        c["duda"] = marcadas.get(c["cruda"])
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
            minimo, maximo = CARA[numero_]
            if not minimo <= pct <= maximo:
                malos.append(f"golpe {numero_} a la cara en {NIVEL.get(nivel, 'total')}: {pct:.1f} % "
                             f"(entre {minimo} y {maximo} %)")
    if empiezan_con_jab(combos) < MIN_EMPIEZAN_JAB:
        malos.append(f"empiezan con el jab {empiezan_con_jab(combos):.0f} % de las que empiezan por golpe "
                     f"(mínimo {MIN_EMPIEZAN_JAB} %)")
    malos += [f"nombre repetido: «{n}»" for n, v in Counter(c["nombre"] for c in combos).items() if v > 1]
    for c in combos:
        if re.search(r"\d", c["nombre"]):
            malos.append(f"#{c['n']} «{c['nombre']}»: el nombre lleva cifras")
        malos += [f"#{c['n']} «{c['nombre']}» ({c['notacion']}): {f}" for f in fallos_del_nombre(c["nombre"], c["acciones"])]
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
    for nivel in (1, 2, 3):
        seguidos = [c["n"] for c in combos if c["nivel"] == nivel and dos_ganchos_seguidos(c["acciones"])]
        if len(seguidos) > MAX_DOS_GANCHOS:
            malos.append(f"{NIVEL[nivel]}: {len(seguidos)} con 5-6 o 6-5 seguidos (máximo {MAX_DOS_GANCHOS}): "
                         + ", ".join(f"#{n}" for n in seguidos))
    avanzadas_1 = [c for c in combos if c["nivel"] == 3 and c["defensas"] == 1]
    if avanzadas_1 and all(c["familia"] == "F1" for c in avanzadas_1):
        malos.append("todas las de avanzado con 1 defensa son de la F1")
    return malos


def empiezan_con_jab(combos):
    """% de las que empiezan por golpe que empiezan con el jab (a la cara)."""
    con_golpe = [c["acciones"][0] for c in combos if c["acciones"][0].tipo == "golpe"]
    return 100 * sum(a.id == "jab" for a in con_golpe) / len(con_golpe)


def dos_ganchos_seguidos(acciones):
    """Si lleva un 5 y un 6 seguidos, en cualquier orden y a la cara o al cuerpo (el 5 al cuerpo y luego el 5 a la
    cara es el gancho abajo y arriba, con la misma mano: no cuenta)."""
    return any(a.familia == b.familia == "uppercut" and a.mano != b.mano for a, b in zip(acciones, acciones[1:]))


def usos_por_id(combos):
    return Counter(a.id for c in combos for a in c["acciones"])


def porcentajes_cara(combos, nivel=None):
    numeros = Counter(a.numero for c in combos if nivel in (None, c["nivel"]) for a in c["acciones"] if a.numero)
    total = sum(numeros.values())
    return {n: 100 * numeros[n] / total for n in range(1, 7)}


def lados(combos):
    usos = usos_por_id(combos)
    return {"esquiva": (usos["esquiva_der"], usos["esquiva_izq"]), "rueda": (usos["rodar_der"], usos["rodar_izq"])}


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

    def coletillas(self):
        return []  # solo cuenta las del nivel

    def guardar(self):
        return list(self.recientes)

    def restaurar(self, estado):
        self.recientes = list(estado)


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
    w("> reparto. Ya es la biblioteca de la app: `data/combinaciones.json` se genera desde aquí, con las dudas de técnica")
    w("> en «revisar», y cada nivel sortea solo de sus 50.")
    w("> Se genera con `python herramientas/biblioteca.py`: no editar a mano.")
    w("")
    w("## Cómo leerla")
    w("")
    w("- Todo en guardia **ortodoxa** (el zurdo lo hace en espejo). Los golpes van por número: 1 jab, 2 recto, 3 crochet")
    w("  adelantado, 4 crochet trasero, 5 gancho adelantado, 6 gancho trasero; «3 al cuerpo» es el crochet adelantado al")
    w("  cuerpo. Las defensas y salidas, como las dice la app («rueda derecha»).")
    w("- **Nivel** = número total de acciones (golpes + defensas + salidas), calculado con `motor.reglas.nivel_de`:")
    w("  básico 2-4, medio 5-6, avanzado 7-10.")
    w("- **Defensa** = esquiva, rueda, ballesteo, flexión, bloqueo, parada y paso atrás. Pivote, paso lateral y")
    w("  cambio de ángulo son **salidas**: no cuentan como defensa, pero sí como acción.")
    w("- **Defensa en**: inicio (antes del primer golpe), entre golpes, o final (después del último golpe).")
    w("- **Papel**: *base* de la familia; *crece de #n* (la del nivel anterior más acciones, en el mismo orden);")
    w("  *variante de #n* (mismo nivel, cambia un lado, un golpe o la salida).")
    w("- **Nombre**: empieza por la primera acción, nombra al menos un golpe y lo que dice va en el mismo orden que las")
    w("  acciones, aunque se salte alguna. No dice la mano: «crochet» es el 3 o el 4 y «gancho», el 5 o el 6. Los golpes")
    w("  seguidos van con guion («jab-recto-crochet»).")
    w("- **Respecto a la anterior**: *se queda* (ya estaba en la biblioteca de antes, igual), *cambia* (amplía una de antes")
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
    dudas(w, combos)
    salen(w, combos)
    return "\n".join(L) + "\n"


def tabla(w, combos):
    w("| # | Nombre | Papel | Acciones | Total | Golpes | Defensas | Salidas | Defensa en | Nivel "
      "| Respecto a la anterior |")
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
    w("Comprobado por el script (en total y en cada nivel para los golpes a la cara): cada golpe a la cara dentro de su")
    w(f"rango; cada golpe al cuerpo, al menos {MIN_CUERPO} veces; cada defensa, al menos {MIN_DEFENSA}; derecha e izquierda de")
    w(f"cada defensa con lado, a menos de un {MAX_DIFERENCIA_LADO} % de diferencia; cada salida, al menos {MIN_SALIDA}; de las")
    w(f"que empiezan por golpe, al menos el {MIN_EMPIEZAN_JAB} % empiezan con el jab. Los golpes 2 a 6 valen lo mismo;")
    w("solo el jab puede salir más.")
    w("")
    primeras = [c["acciones"][0] for c in combos]
    con_golpe = sum(a.tipo == "golpe" for a in primeras)
    w(f"**Cómo empiezan:** {con_golpe} de {len(combos)} empiezan por golpe y, de ellas, "
      f"{sum(a.id == 'jab' for a in primeras)} con el jab ({coma(empiezan_con_jab(combos), 0)} %). "
      f"Empiezan con 5 o 6: {sum(a.familia == 'uppercut' for a in primeras)}.")
    w("")
    w("**Golpes a la cara** (% sobre los golpes a la cara)")
    w("")
    w("| Golpe | Rango | Veces | Total | Básico | Medio | Avanzado |")
    w("|---|---|---|---|---|---|---|")
    numeros = Counter(a.numero for c in combos for a in c["acciones"] if a.numero)
    por_nivel = {n: porcentajes_cara(combos, n) for n in (None, 1, 2, 3)}
    nombres = {1: "1 jab", 2: "2 recto", 3: "3 crochet adelantado", 4: "4 crochet trasero",
               5: "5 gancho adelantado", 6: "6 gancho trasero"}
    for n in range(1, 7):
        w(f"| {nombres[n]} | {CARA[n][0]}-{CARA[n][1]} % | {numeros[n]} | " + " | ".join(f"{coma(por_nivel[x][n])} %" for x in (None, 1, 2, 3)) + " |")
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
    nombres_def = {"esquiva": "esquiva", "rodar": "rueda", "ballesteo": "ballesteo", "flexion": "flexión",
                   "bloqueo": "bloqueo", "parada": "parada", "paso_atras": "paso atrás"}
    for f in DEFENSAS:
        der, izq = con_lado.get(nombres_def[f], ("—", "—"))
        w(f"| {nombres_def[f]} | {por_familia[f]} | {der} | {izq} |")
    w(f"| paso lateral | {usos['paso_lateral_der'] + usos['paso_lateral_izq']} | {usos['paso_lateral_der']} "
      f"| {usos['paso_lateral_izq']} |")
    w(f"| pivote | {usos['pivote']} | — | — |")
    w(f"| cambio de ángulo | {usos['salir']} | — | — |")


def marcas():
    """Las dudas marcadas con REVISAR CON ENTRENADOR en este fichero, por notación cruda (la de FAMILIAS o SUELTAS)."""
    encontradas = {}
    for linea in Path(__file__).read_text(encoding="utf-8").splitlines():
        if (m := re.search(r'"([0-9A-Z{}c-]+)", "[^"]*"\),\s*# REVISAR CON ENTRENADOR: (.+)', linea)):
            encontradas[m.group(1)] = m.group(2)
    return encontradas


def dudas_de(c):
    """Las dudas de técnica de una combinación: la marcada y, si lleva 5-6 o 6-5, los dos ganchos seguidos."""
    dudas_ = [c["duda"]] if c["duda"] else []
    if dos_ganchos_seguidos(c["acciones"]) and not any("dos ganchos seguidos" in d for d in dudas_):
        dudas_.append("dos ganchos seguidos")
    return dudas_


def dudas(w, combos):
    """Las combinaciones marcadas con REVISAR CON ENTRENADOR en este fichero y las de dos ganchos seguidos."""
    w("## Dudas de técnica")
    w("")
    w("Golpes cambiados para cuadrar el balance que pueden no ser naturales. **REVISAR CON ENTRENADOR.**")
    w("")
    w("| # | Acciones | Duda |")
    w("|---|---|---|")
    for c in combos:
        if c["duda"]:
            w(f"| {c['n']} | {texto(c['acciones'])} | {c['duda']} |")
    seguidos = [c for c in combos if dos_ganchos_seguidos(c["acciones"])]
    w("")
    w(f"Con 5-6 o 6-5 seguidos (a la cara o al cuerpo; como mucho {MAX_DOS_GANCHOS} por nivel) hay {len(seguidos)}: "
      + ", ".join(f"#{c['n']}" for c in seguidos) + ".")
    w("")


def salen(w, combos):
    nuevas = {tuple(c["ids"]) for c in combos}
    ampliadas = {c["respecto"].split("«")[1].rstrip("»") for c in combos if c["respecto"].startswith("cambia")}
    fuera = [c for k, c in ANTES.items() if k not in nuevas]
    w("## Las de la biblioteca anterior que salen")
    w("")
    w(f"De las {len(ANTES)} de antes se quedan {len(ANTES) - len(fuera)} y salen {len(fuera)}. "
      "Las que salen, con su nivel de antes, el que les daría `nivel_de` y si alguna nueva las amplía:")
    w("")
    w("| Antes | Nivel de antes | Con nivel_de | Ampliada en la propuesta |")
    w("|---|---|---|---|")
    for c in fuera:
        w(f"| {texto(c.acciones)} | {NIVEL[c.nivel]} | {NIVEL.get(nivel_de(c.acciones), 'ninguno')} "
          f"| {'sí' if c.notacion in ampliadas else '—'} |")


def datos(combos):
    """data/combinaciones.json: una combinación por línea, en ortodoxo y con el número de la propuesta («n»)."""
    nota = ("Biblioteca de combinaciones de la sesión, en guardia ORTODOXA. Generada por herramientas/biblioteca.py: "
            "no editar a mano. n = número en docs/revision/biblioteca-propuesta.md; notacion = números de los golpes "
            "(1-6, solo a la cara) y orden corta de las defensas; nivel = motor.reglas.nivel_de (cada nivel sortea solo "
            "de las suyas); revisar = dudas de técnica. "
            f"{MARCA} toda la biblioteca (combinaciones, nombres y niveles)")
    lineas = []
    for c in combos:
        combo = {"n": c["n"], "notacion": notacion(c["acciones"]), "nivel": c["nivel"], "ids": c["ids"],
                 "nombre": c["nombre"]}
        if (dudas_ := dudas_de(c)):
            combo["revisar"] = f"{MARCA} #{c['n']} «{texto(c['acciones'])}»: {'; '.join(dudas_)}"
        lineas.append("    " + json.dumps(combo, ensure_ascii=False))
    return ('{\n  "_nota": ' + json.dumps(nota, ensure_ascii=False) + ',\n  "combinaciones": [\n'
            + ",\n".join(lineas) + "\n  ]\n}\n")


def main():
    combos, malos = preparar()
    if malos:
        print("No se genera nada: hay que corregir esto.\n- " + "\n- ".join(malos))
        raise SystemExit(1)
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(documento(combos), encoding="utf-8")
    DATOS.write_text(datos(combos), encoding="utf-8")
    print(f"{len(combos)} combinaciones en {SALIDA.relative_to(RAIZ)} y {DATOS.relative_to(RAIZ)}, "
          f"{sum(bool(dudas_de(c)) for c in combos)} con dudas de técnica")


if __name__ == "__main__":
    main()
