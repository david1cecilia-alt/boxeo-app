# Boxeo — entrenador local

App de entrenamiento de boxeo 100 % local: temporizador de asaltos, modo reacción
y dictado por voz de combinaciones con defensas integradas.

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
.venv\Scripts\python -m uvicorn app.main:app --reload
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
