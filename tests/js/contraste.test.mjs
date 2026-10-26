// Contraste WCAG de los colores de estilos.css: texto AA (4,5:1) y componentes (3:1).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { RAIZ } from "./datos.mjs";

const css = readFileSync(join(RAIZ, "static", "estilos.css"), "utf-8");
const raiz = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
const tokens = Object.fromEntries([...raiz.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const color = (c) => (c.startsWith("#") ? c : tokens[c]);

function luminancia(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a, b) {
  const [l1, l2] = [luminancia(color(a)), luminancia(color(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [primer plano, fondo]
const TEXTO = [
  ["texto", "fondo"], ["texto", "tarjeta"], ["texto", "campo"], ["texto", "secundario"],
  ["#ffffff", "principal"], ["#ffffff", "principal-hover"],
  ["suave", "fondo"], ["suave", "tarjeta"], ["suave", "campo"],
  ["texto", "fase-asalto"], ["texto", "fase-final"], ["texto", "fase-descanso"], ["texto", "fase-pausa"],
  ["fase-reaccion-texto", "fase-reaccion"], ["#ffffff", "#111317"], // botón secundario en reacción
  ["#ffe8a3", "#4a3a05"], ["ok", "#12392c"], ["#8cc8ff", "tarjeta"], ["#8cc8ff", "fondo"],
];

const COMPONENTES = [
  ["borde", "tarjeta"], ["borde", "campo"], ["borde", "fondo"],
  ["foco", "fondo"], ["foco", "tarjeta"], ["foco", "campo"], ["foco", "fase-final"],
  ["foco", "fase-descanso"], ["foco", "fase-pausa"], ["fase-reaccion-texto", "fase-reaccion"],
  ["serie-asaltos", "tarjeta"], ["serie-rpe", "tarjeta"],
];

test("los tokens existen", () => {
  for (const [a, b] of [...TEXTO, ...COMPONENTES]) {
    assert.ok(color(a) && color(b), `falta ${a} o ${b}`);
  }
});

test("texto con contraste AA (4,5:1)", () => {
  for (const [a, b] of TEXTO) {
    const r = contraste(a, b);
    assert.ok(r >= 4.5, `${a} sobre ${b}: ${r.toFixed(2)}:1`);
  }
});

test("bordes, foco y marcas de gráficos con 3:1", () => {
  for (const [a, b] of COMPONENTES) {
    const r = contraste(a, b);
    assert.ok(r >= 3, `${a} sobre ${b}: ${r.toFixed(2)}:1`);
  }
});
