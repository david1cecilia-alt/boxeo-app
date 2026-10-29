// Pantalla encendida durante la sesión (Screen Wake Lock), también en pausa y en el descanso.
// El navegador suelta el bloqueo al cambiar de app o bloquear el móvil: se vuelve a pedir al
// volver mientras la sesión siga activa. Si el navegador no lo admite o lo niega, no pasa nada.

export function crearPantallaEncendida({
  wakeLock = globalThis.navigator?.wakeLock,
  documento = globalThis.document,
} = {}) {
  let activa = false;   // la sesión quiere la pantalla encendida
  let bloqueo = null;   // WakeLockSentinel vigente
  let pidiendo = null;  // petición en curso

  async function pedir() {
    if (!activa || !wakeLock || bloqueo || pidiendo) return;
    if (documento && documento.visibilityState !== "visible") return; // se pide al volver
    pidiendo = wakeLock.request("screen");
    try {
      const nuevo = await pidiendo;
      if (!activa) {
        nuevo.release(); // se paró mientras se pedía: que no quede encendida
        return;
      }
      bloqueo = nuevo;
      nuevo.addEventListener?.("release", () => {
        if (bloqueo === nuevo) bloqueo = null;
      });
    } catch {
      // No admitido, sin permiso o con batería baja: la sesión sigue igual.
    } finally {
      pidiendo = null;
    }
  }

  documento?.addEventListener("visibilitychange", () => {
    if (documento.visibilityState === "visible") pedir();
  });

  return {
    get activa() { return activa; },
    get bloqueada() { return bloqueo !== null; },
    // Al empezar la sesión. Devuelve la promesa de la petición (para los tests).
    encender() {
      activa = true;
      return pedir();
    },
    // Al parar o terminar.
    apagar() {
      activa = false;
      const actual = bloqueo;
      bloqueo = null;
      try { actual?.release(); } catch { /* ya suelto */ }
    },
  };
}
