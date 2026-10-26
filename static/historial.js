// Fuente de las sesiones. Cualquier implementación debe ofrecer:
//   origen                -> "servidor" | "local" (forma la clave de la valoración: "local:<id>")
//   guardar(sesion)       -> id de la sesión guardada
//   listar()              -> sesiones, la más reciente primero, con `clave` y num_combinaciones
//   combinaciones(id)     -> [{ asalto, texto, ids }]
//   borrar(id)            -> borra la sesión y su valoración
//   copia()               -> sesiones completas para la copia de seguridad (solo servidor)
// HistorialServidor: SQLite vía FastAPI (en local). HistorialLocal: el almacén (PWA sin servidor).
// Las valoraciones, el perfil y las notas van SIEMPRE al almacén (un solo camino).
import { claveSesion } from "./almacen.js";

class HistorialServidor {
  origen = "servidor";
  descripcion = "en el servidor (SQLite)";

  constructor(almacen) {
    this.almacen = almacen;
  }

  async guardar(sesion) {
    const r = await fetch("api/sesiones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sesion),
    });
    if (!r.ok) throw new Error(`El servidor no guardó la sesión (${r.status})`);
    return (await r.json()).id;
  }

  async listar() {
    const sesiones = await (await fetch("api/sesiones")).json();
    return sesiones.map((s) => ({ ...s, zurdo: Boolean(s.zurdo), clave: claveSesion(this.origen, s.id) }));
  }

  async combinaciones(id) {
    const r = await fetch(`api/sesiones/${id}/combinaciones`);
    return r.ok ? r.json() : [];
  }

  async borrar(id) {
    const r = await fetch(`api/sesiones/${id}`, { method: "DELETE" });
    if (!r.ok && r.status !== 404) throw new Error(`El servidor no borró la sesión (${r.status})`);
    this.almacen.borrarValoracion(claveSesion(this.origen, id));
  }

  async copia() {
    const sesiones = await this.listar();
    return Promise.all(sesiones.map(async ({ clave, ...s }) => ({ ...s, combinaciones: await this.combinaciones(s.id) })));
  }
}

class HistorialLocal {
  origen = "local";
  descripcion = "en este dispositivo";

  constructor(almacen) {
    this.almacen = almacen;
  }

  async guardar(sesion) {
    return this.almacen.anadirSesion({ fecha: fechaLocal(), ...sesion });
  }

  async listar() {
    // Por fecha, como el servidor: tras importar, el orden de inserción no vale.
    return this.almacen.datos.sesiones
      .map((s) => ({ ...s, num_combinaciones: s.combinaciones.length, clave: claveSesion(this.origen, s.id) }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  async combinaciones(id) {
    return this.almacen.datos.sesiones.find((s) => s.id === id)?.combinaciones ?? [];
  }

  async borrar(id) {
    this.almacen.borrarSesion(id); // borra también su valoración
  }

  async copia() {
    return null; // las sesiones locales ya van dentro del almacén
  }
}

// Misma forma que datetime.now().isoformat(timespec="seconds") del servidor.
export function fechaLocal(d = new Date()) {
  const dos = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}` +
    `T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

// Si responde la API de FastAPI se usa SQLite; si no (GitHub Pages, sin conexión), el almacén.
export async function crearHistorial(almacen) {
  try {
    const r = await fetch("api/sesiones", { signal: AbortSignal.timeout(2000) });
    if (r.ok && r.headers.get("content-type")?.includes("application/json")) return new HistorialServidor(almacen);
  } catch { /* sin servidor */ }
  return new HistorialLocal(almacen);
}
