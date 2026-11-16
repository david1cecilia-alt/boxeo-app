"""Simula «Practicar más» para elegir su factor y cuántos movimientos se pueden elegir.

Sesiones 3×3 a ritmo Constante con el guion real (construir_guion + SorteoBiblioteca) y semillas
fijas: repetirlo da las mismas cifras. Mide qué parte de las combinaciones dichas lleva cada
movimiento. Son las tablas de la sección 5 de docs/revision/rediseno-plan.md; repítelo si cambia
la biblioteca o el sorteo.

Uso (desde la raíz):
  python herramientas/simular_practicar.py factores   # un movimiento con ×1 … ×4 y tres a la vez
  python herramientas/simular_practicar.py cuantos    # con ×3, de 1 a 6 elegidos (D11)
Tarda unos minutos.
"""
import random
import statistics
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from motor import sorteo  # noqa: E402
from motor.acciones import catalogo  # noqa: E402
from motor.temporizador import ConfigSesion, construir_guion  # noqa: E402

SESIONES = 400
FACTORES = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0]
# Orden en que se añaden elegidos en «cuantos» (golpes y defensas frecuentes de cada nivel).
ORDEN_CUANTOS = {1: ["3", "esquiva", "rodar", "4", "bloqueo", "parada"],
                 2: ["4", "5", "rodar", "parada", "esquiva", "3"]}
MOVIMIENTO_DE_ID = {a.id: sorteo.movimiento(a) for a in catalogo().values()}


def medir(nivel: int, elegidos: list[str], factor: float, semilla: int) -> tuple[dict[str, float], float]:
    """Parte de las combinaciones dichas que lleva cada movimiento, y combinaciones por sesión."""
    original = sorteo.FACTOR_PRACTICAR
    sorteo.FACTOR_PRACTICAR = factor  # peso_practicar lo lee del módulo en cada llamada
    try:
        rng = random.Random(semilla)
        total, por_movimiento, por_sesion = 0, {}, []
        for _ in range(SESIONES):
            perfil = {**sorteo.cargar_perfil(), "practicar": [{"movimiento": m} for m in elegidos]}
            s = sorteo.SorteoBiblioteca(nivel, perfil=perfil, rng=rng)
            dichas = [e for e in construir_guion(ConfigSesion(nivel=nivel), rng, s) if e.tipo == "combo"]
            por_sesion.append(len(dichas))
            for e in dichas:
                total += 1
                for m in {MOVIMIENTO_DE_ID[i] for i in e.ids}:
                    por_movimiento[m] = por_movimiento.get(m, 0) + 1
    finally:
        sorteo.FACTOR_PRACTICAR = original
    return {m: n / total for m, n in por_movimiento.items()}, statistics.mean(por_sesion)


def factores() -> None:
    print(f"{SESIONES} sesiones 3×3 por caso. % de combinaciones que llevan el movimiento.\n")
    for nivel in (1, 2, 3):
        base, por_sesion = medir(nivel, [], 1.0, 1)
        print(f"=== Nivel {nivel} ({por_sesion:.0f} combinaciones por sesión)")
        print("mov".ljust(13) + "".join(f"×{f:<6}" for f in FACTORES) + "  subida ×2 / ×3 (puntos)")
        for m in sorted(base, key=base.get):
            valores = [base.get(m, 0) if f == 1.0 else medir(nivel, [m], f, 2)[0].get(m, 0) for f in FACTORES]
            print(m.ljust(13) + "".join(f"{100 * v:5.1f}% " for v in valores)
                  + f"  +{100 * (valores[2] - valores[0]):.1f} / +{100 * (valores[4] - valores[0]):.1f}")
        print()
    print("=== Tres elegidos a la vez (tope ×%g): %% de cada uno y del jab" % sorteo.TOPE_PRACTICAR)
    for nivel, elegidos in ((1, ["3", "esquiva", "rodar"]), (2, ["4", "5", "rodar"])):
        base, _ = medir(nivel, [], 1.0, 1)
        for f in (2.0, 2.5, 3.0, 4.0):
            r, _ = medir(nivel, elegidos, f, 3)
            print(f"Nivel {nivel}, ×{f}: " + ", ".join(
                f"{m} {100 * base.get(m, 0):.0f}→{100 * r.get(m, 0):.0f}%" for m in elegidos + ["1", "2"]))


def cuantos() -> None:
    print(f"×{sorteo.FACTOR_PRACTICAR:g}, tope ×{sorteo.TOPE_PRACTICAR:g}. {SESIONES} sesiones 3×3 por caso.\n")
    for nivel, orden in ORDEN_CUANTOS.items():
        base, _ = medir(nivel, [], 1.0, 1)
        print(f"=== Nivel {nivel}. Base: " + ", ".join(f"{m} {100 * base.get(m, 0):.0f}%" for m in orden + ["1", "2"]))
        for k in range(1, len(orden) + 1):
            elegidos = orden[:k]
            r, _ = medir(nivel, elegidos, sorteo.FACTOR_PRACTICAR, 3)
            subidas = [100 * (r.get(m, 0) - base.get(m, 0)) for m in elegidos]
            resto = [m for m in ("1", "2") if m not in elegidos]
            print(f"  {k} elegidos: " + ", ".join(f"{m} {100 * r.get(m, 0):.0f}%" for m in elegidos)
                  + f" | subida media +{sum(subidas) / k:.1f} pt (mín +{min(subidas):.1f})"
                  + " | " + ", ".join(f"{m} {100 * base.get(m, 0):.0f}→{100 * r.get(m, 0):.0f}%" for m in resto))


if __name__ == "__main__":
    modos = {"factores": factores, "cuantos": cuantos}
    if len(sys.argv) != 2 or sys.argv[1] not in modos:
        sys.exit(__doc__)
    modos[sys.argv[1]]()
