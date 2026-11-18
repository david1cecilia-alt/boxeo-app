import assert from "node:assert/strict";
import { test } from "node:test";

// AudioContext de mentira: apunta qué osciladores arrancan y paran.
const osciladores = [];
const ganancias = [];
globalThis.AudioContext = class {
  constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; }
  resume() { this.state = "running"; }
  createOscillator() {
    const osc = { frequency: {}, sonando: false, connect: (n) => n, disconnect() {},
      start() { this.sonando = true; }, stop() { this.sonando = false; } };
    osciladores.push(osc);
    return osc;
  }
  createGain() {
    const gan = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n };
    ganancias.push(gan);
    return gan;
  }
};

const { DESPIERTO_FRECUENCIA, DESPIERTO_VOLUMEN, activarSonido, dejarDormir, mantenerDespierto } =
  await import("../../static/sonido.js");
const sonando = () => osciladores.filter((o) => o.sonando).length;

test("sin el gesto de Empezar (sin AudioContext) no suena nada", () => {
  mantenerDespierto();
  assert.equal(osciladores.length, 0);
});

test("mantener despierto suena una sola vez, casi a cero, hasta dejar dormir", () => {
  activarSonido();
  mantenerDespierto();
  mantenerDespierto(); // al reanudar o al empezar otro asalto: no se suma otro
  assert.equal(sonando(), 1);
  dejarDormir();
  dejarDormir();
  assert.equal(sonando(), 0);
  mantenerDespierto();
  assert.equal(sonando(), 1, "vuelve a sonar en el siguiente asalto");
  dejarDormir();
});

test("el zumbido es el que no se corta con cascos: 170 Hz a −50 dB", () => {
  assert.equal(DESPIERTO_FRECUENCIA, 170);
  assert.ok(Math.abs(20 * Math.log10(DESPIERTO_VOLUMEN) + 50) < 1e-9);
  activarSonido();
  mantenerDespierto();
  assert.equal(osciladores.at(-1).frequency.value, 170);
  assert.equal(ganancias.at(-1).gain.value, DESPIERTO_VOLUMEN);
  dejarDormir();
});
