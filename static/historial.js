// Historial de sesiones. Cualquier implementación debe ofrecer:
//   guardar(sesion) -> guarda { asaltos, nivel, zurdo, duracion_asalto, descanso, combinaciones }
//   listar()        -> sesiones, la más reciente primero, con fecha y num_combinaciones
// HistorialServidor: SQLite vía FastAPI (en local). HistorialLocal: localStorage (PWA sin servidor).

const CLAVE = "boxeo.historial";
const MAX_SESIONES = 100;

class HistorialServidor {
  descripcion = "en el servidor (SQLite)";

  async guardar(sesion) {
    await fetch("api/sesiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sesion),
    });
  }

  async listar() {
    return (await fetch("api/sesiones")).json();
  }
}

class HistorialLocal {
  descripcion = "en este dispositivo";

  _leer() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE)) ?? [];
    } catch {
      return []; // sin almacenamiento (modo privado) o datos corruptos
    }
  }

  async guardar(sesion) {
    const sesiones = this._leer();
    const id = sesiones.reduce((m, s) => Math.max(m, s.id), 0) + 1;
    sesiones.unshift({ id, fecha: fechaLocal(), ...sesion, num_combinaciones: sesion.combinaciones.length });
    try {
      localStorage.setItem(CLAVE, JSON.stringify(sesiones.slice(0, MAX_SESIONES)));
    } catch { /* almacenamiento lleno o bloqueado: la sesión no se guarda */ }
  }

  async listar() {
    return this._leer();
  }
}

// Misma forma que datetime.now().isoformat(timespec="seconds") del servidor.
function fechaLocal(d = new Date()) {
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}` +
    `T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

// Si responde la API de FastAPI se usa SQLite; si no (GitHub Pages, sin conexión), localStorage.
export async function crearHistorial() {
  try {
    const r = await fetch("api/sesiones", { signal: AbortSignal.timeout(2000) });
    if (r.ok && r.headers.get("content-type")?.includes("application/json")) return new HistorialServidor();
  } catch { /* sin servidor */ }
  return new HistorialLocal();
}
