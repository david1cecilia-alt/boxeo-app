# Convenciones del proyecto Boxeo

## General
- Todo en **español**: código (nombres de variables/funciones), comentarios, commits y textos de la UI.
- 100 % local: nada de servicios de pago ni llamadas a internet en tiempo de ejecución.
- Python **3.12** (no subir a 3.13+ por MediaPipe). Entorno en `.venv`.
- Commits pequeños, mensaje en español en imperativo/descriptivo ("Añade generador de combinaciones").

## Arquitectura
- `motor/` es lógica pura en Python: sin FastAPI, sin I/O salvo leer `data/`. Todo testeable.
- `app/` solo traduce HTTP ⇄ motor y guarda en SQLite (`sqlite3` de la stdlib).
- `motor/` (Python) es la **referencia**. `static/motor/` es un port fiel que debe pasar los tests de
  equivalencia (`tests/test_equivalencia_js.py`). Las reglas nuevas se escriben primero en Python.
- El guion de la sesión lo genera siempre el motor JS en el navegador (funciona sin servidor, PWA).
  El resto de `static/` solo presenta (se migrará a Tauri + React).
- Historial: SQLite vía FastAPI si hay servidor; si no, `localStorage` (`static/historial.js`).
- Nada de datos personales en `data/`: se publica tal cual con la web.
- La voz va detrás de la interfaz de `static/voz.js` (`decir`, `callar`). Hoy Web Speech API, mañana Piper.

## Datos
- El vocabulario vive en `data/acciones.json`, nunca en el código. Los golpes se dicen por su nombre, nunca con números.
- Todo se define en guardia **ortodoxa**; el zurdo se obtiene con `motor.acciones.espejo()`. No duplicar datos.
- `nombre_hablado` es una plantilla (`{lado}`) que se rellena a partir de mano/lado.

## Reglas de boxeo
- Las reglas están en `motor/reglas.py` (`validar`). Si un combo clásico no las pasa, **avisar**, no cambiar la regla.
- Lo dudoso técnicamente se marca con `# REVISAR CON ENTRENADOR`; no inventar.

## Tests
- `.venv\Scripts\python -m pytest -q` debe pasar antes de cada commit.
- Aleatoriedad siempre con `random.Random(semilla)` inyectado (en JS, `crearAzar(semilla)` de `static/motor/azar.js`).
- `node` (18+) hace falta para los tests de equivalencia; sin él se saltan.
