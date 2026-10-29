import assert from "node:assert/strict";
import { test } from "node:test";

import { crearPantallaEncendida } from "../../static/pantalla.js";

// Wake Lock de mentira: cuenta peticiones y bloqueos vivos; el sistema puede soltarlos.
function wakeLockFalso({ falla = false } = {}) {
  const vivos = new Set();
  return {
    vivos,
    peticiones: 0,
    async request(tipo) {
      assert.equal(tipo, "screen");
      this.peticiones++;
      if (falla) throw new Error("NotAllowedError");
      const oyentes = [];
      const bloqueo = {
        released: false,
        addEventListener: (_, f) => oyentes.push(f),
        async release() {
          if (bloqueo.released) return;
          bloqueo.released = true;
          vivos.delete(bloqueo);
          oyentes.forEach((f) => f());
        },
      };
      vivos.add(bloqueo);
      return bloqueo;
    },
    // Lo que hace el navegador al ocultar la página.
    soltarTodo() { [...vivos].forEach((b) => b.release()); },
  };
}

function documentoFalso() {
  const oyentes = [];
  return {
    visibilityState: "visible",
    addEventListener: (_, f) => oyentes.push(f),
    cambiar(estado) { this.visibilityState = estado; oyentes.forEach((f) => f()); },
  };
}

const esperar = () => new Promise((ok) => setTimeout(ok, 0));

test("se enciende al empezar y se suelta al parar", async () => {
  const wakeLock = wakeLockFalso();
  const pantalla = crearPantallaEncendida({ wakeLock, documento: documentoFalso() });
  await pantalla.encender();
  assert.equal(wakeLock.vivos.size, 1);
  pantalla.apagar();
  assert.equal(wakeLock.vivos.size, 0);
});

test("pedirlo dos veces no deja dos bloqueos", async () => {
  const wakeLock = wakeLockFalso();
  const pantalla = crearPantallaEncendida({ wakeLock, documento: documentoFalso() });
  await Promise.all([pantalla.encender(), pantalla.encender()]);
  assert.equal(wakeLock.peticiones, 1);
  assert.equal(wakeLock.vivos.size, 1);
});

test("si se para mientras se está pidiendo, no se queda encendida", async () => {
  const wakeLock = wakeLockFalso();
  const pantalla = crearPantallaEncendida({ wakeLock, documento: documentoFalso() });
  const peticion = pantalla.encender();
  pantalla.apagar();
  await peticion;
  assert.equal(wakeLock.vivos.size, 0);
});

test("al volver a la app se pide de nuevo, solo si la sesión sigue", async () => {
  const wakeLock = wakeLockFalso();
  const documento = documentoFalso();
  const pantalla = crearPantallaEncendida({ wakeLock, documento });
  await pantalla.encender();
  documento.cambiar("hidden");
  wakeLock.soltarTodo(); // el navegador lo suelta al ocultar
  assert.equal(pantalla.bloqueada, false);
  documento.cambiar("visible");
  await esperar();
  assert.equal(wakeLock.vivos.size, 1);
  assert.equal(wakeLock.peticiones, 2);

  pantalla.apagar();
  documento.cambiar("hidden");
  documento.cambiar("visible");
  await esperar();
  assert.equal(wakeLock.vivos.size, 0);
  assert.equal(wakeLock.peticiones, 2);
});

test("sin Wake Lock en el navegador o si lo niega, no falla", async () => {
  const sinApi = crearPantallaEncendida({ wakeLock: undefined, documento: documentoFalso() });
  await sinApi.encender();
  sinApi.apagar();
  const niega = crearPantallaEncendida({ wakeLock: wakeLockFalso({ falla: true }), documento: documentoFalso() });
  await niega.encender();
  assert.equal(niega.bloqueada, false);
  niega.apagar();
  const sinNada = crearPantallaEncendida({ wakeLock: undefined, documento: undefined });
  await sinNada.encender();
  sinNada.apagar();
});
