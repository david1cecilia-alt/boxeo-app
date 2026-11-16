// La cuenta del recorte de la foto (vistas/recorte.js), sin DOM: el zoom mínimo cubre todo el cuadrado, el
// recorte nunca se sale de la imagen y mover / acercar van en el sentido esperado.
import assert from "node:assert/strict";
import { test } from "node:test";

import { ZOOM_MAX, acercar, encuadreInicial, limitar, mover, recorteDe } from "../../static/vistas/recorte.js";

const dentro = ({ x, y, lado }, ancho, alto) => x >= 0 && y >= 0 && x + lado <= ancho + 1e-9 && y + lado <= alto + 1e-9;

test("con zoom 1× el recorte es el cuadrado mayor centrado (sin bordes vacíos)", () => {
  assert.deepEqual(recorteDe(encuadreInicial(800, 600), 800, 600), { x: 100, y: 0, lado: 600 });
  assert.deepEqual(recorteDe(encuadreInicial(600, 800), 600, 800), { x: 0, y: 100, lado: 600 });
});

test("el zoom va de 1× a 3×: ni menos (quedarían bordes) ni más", () => {
  assert.equal(limitar({ cx: 400, cy: 300, zoom: 0.5 }, 800, 600).zoom, 1);
  assert.equal(limitar({ cx: 400, cy: 300, zoom: 9 }, 800, 600).zoom, ZOOM_MAX);
  assert.equal(limitar({ cx: 400, cy: 300, zoom: Number.NaN }, 800, 600).zoom, 1);
  assert.equal(recorteDe({ cx: 400, cy: 300, zoom: 3 }, 800, 600).lado, 200);
});

test("el recorte nunca se sale de la imagen, se mueva o se acerque como se mueva", () => {
  let e = encuadreInicial(1200, 900);
  for (const [dx, dy, z] of [[5000, 0, 1], [-5000, -5000, 2], [0, 9000, 3], [-1, 1, 1.4], [9999, 9999, 2.2]]) {
    e = acercar(mover(e, dx, dy, 300, 1200, 900), z, 1200, 900);
    assert.ok(dentro(recorteDe(e, 1200, 900), 1200, 900), JSON.stringify(e));
  }
});

test("arrastrar a la derecha lleva el recorte a la izquierda, en proporción a la vista", () => {
  const e = acercar(encuadreInicial(800, 600), 2, 800, 600); // lado 300, vista 300 px: 1 px = 1 px de imagen
  const movido = mover(e, 50, -20, 300, 800, 600);
  assert.equal(movido.cx, e.cx - 50);
  assert.equal(movido.cy, e.cy + 20);
});

test("acercar mantiene el centro si cabe", () => {
  const e = acercar({ cx: 300, cy: 300, zoom: 1 }, 2, 800, 600);
  assert.deepEqual([e.cx, e.cy, e.zoom], [300, 300, 2]);
});
