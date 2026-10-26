# Boxeo — entrenador local

App de entrenamiento de boxeo 100 % local: temporizador de asaltos, modo reacción
y dictado por voz de combinaciones con defensas integradas.

## Estado

Lo que funciona hoy:

- **Temporizador de asaltos** configurable (asaltos, duración, descanso), con preset amateur
  3×3 min / 1 min y una prueba rápida de 2×30 s. Campana al empezar y al acabar el asalto,
  tablillas y voz a los 10 s del final.
- **Modo reacción**: señales visuales y sonoras ("¡esquiva!", "¡contra!"…) en momentos
  aleatorios, que nunca se solapan con una combinación.
- **Motor de combinaciones** con defensas integradas, siempre por su nombre en español:
  generadas por reglas (cargar y soltar, bloquear y devolver, alternar manos, salida tras golpe
  de poder, longitud por nivel) y mezcladas con combos clásicos de `data/combos.json`.
- **Perfil** con pesos (más ganchos al final, más bloquear y devolver, jab de entrada) y
  **modo zurdo** como espejo automático.
- **Ritmo** por nivel: la siguiente combinación espera a que dé tiempo a ejecutar la anterior.
- **Voz** del navegador (Web Speech API) detrás de una interfaz intercambiable.
- **Historial** de sesiones en SQLite (fecha, asaltos, nivel, combinaciones dictadas).
- 138 tests con pytest.

Pendiente: revisar con entrenador los puntos marcados `REVISAR CON ENTRENADOR`.
Fuera de alcance por ahora: IA local, análisis de vídeo, voz por micrófono, Tauri + React.

## Requisitos

- Windows con **Python 3.12** (no 3.13+: más adelante usaremos MediaPipe).
- Un navegador moderno (Chrome/Edge) con voz en español instalada en Windows.

## Instalación (una sola vez, necesita internet)

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

## Arrancar

```powershell
.venv\Scripts\python -m uvicorn app.main:crear_app --factory --reload
```

Abre <http://127.0.0.1:8000>. Funciona sin internet.

## Tests

```powershell
.venv\Scripts\python -m pytest -q
```

## Estructura

| Carpeta   | Qué contiene |
|-----------|--------------|
| `app/`    | API FastAPI y acceso a SQLite |
| `motor/`  | Lógica pura: acciones, reglas, generador, ritmo, temporizador |
| `data/`   | Vocabulario, combos clásicos, perfil y presets (JSON) |
| `static/` | Interfaz HTML + CSS + JS sin framework |
| `tests/`  | Tests con pytest |
