// Contraste WCAG de los colores de estilos.css: texto AA (4,5:1) y componentes (3:1).
// Los tokens translúcidos se componen sobre lo que tienen debajo: el cristal y los botones
// secundarios, sobre el fondo negro; la barra flotante, sobre el peor caso posible, blanco
// puro (una foto clara detrás), así vale con o sin backdrop-filter.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { RAIZ } from "./datos.mjs";

const css = readFileSync(join(RAIZ, "static", "estilos.css"), "utf-8");
const raiz = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
const tokens = Object.fromEntries(
  [...raiz.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6}|rgba\([^)]*\))/g)].map((m) => [m[1], m[2]]),
);

const BLANCO = [255, 255, 255];
const SOBRE_FONDO = new Set(["cristal", "secundario", "secundario-hover"]);

// [r, g, b] de 0 a 255; los rgba se componen sobre `debajo` (o sobre el fondo si van siempre encima).
function rgb(c, debajo = BLANCO) {
  const valor = c.startsWith("#") || c.startsWith("rgba") ? c : tokens[c];
  if (valor.startsWith("#")) return [1, 3, 5].map((i) => parseInt(valor.slice(i, i + 2), 16));
  if (SOBRE_FONDO.has(c)) debajo = rgb("fondo");
  const [r, g, b, a] = valor.slice(5, -1).split(",").map(Number);
  return [r, g, b].map((x, i) => x * a + debajo[i] * (1 - a));
}

function luminancia([r, g, b]) {
  const [R, G, B] = [r, g, b].map((x) => x / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function contraste(a, b) {
  const fondo = rgb(b);
  const [l1, l2] = [luminancia(rgb(a, fondo)), luminancia(fondo)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [primer plano, fondo]
const TEXTO = [
  ["texto", "fondo"], ["texto", "superficie"], ["texto", "superficie-hover"], ["texto", "campo"],
  ["texto", "secundario"], ["texto", "secundario-hover"], ["texto", "cristal"], ["texto", "barra"],
  ["sobre-acento", "acento-relleno"], ["sobre-acento", "acento-relleno-hover"],
  ["sobre-chip-activo", "chip-activo"],
  ["suave", "fondo"], ["suave", "superficie"], ["suave", "campo"], ["suave", "cristal"], ["suave", "barra"],
  ["terciario", "fondo"], ["terciario", "cristal"],
  ["acento", "fondo"], ["acento", "superficie"], ["acento", "campo"], ["acento", "cristal"],
  ["texto", "fase-asalto"], ["suave", "fase-asalto"], ["acento", "fase-asalto"],
  ["texto", "fase-final"], ["texto", "fase-descanso"], ["texto", "fase-pausa"],
  ["fase-final", "texto"], // número del golpe en los últimos 10 s (círculo invertido)
  ["fase-reaccion-texto", "fase-reaccion"], ["sobre-acento", "fondo"], // botón secundario en reacción
  ["aviso", "aviso-fondo"], ["ok", "ok-fondo"],
];

const COMPONENTES = [
  ["borde", "superficie"], ["borde", "campo"], ["borde", "fondo"],
  ["foco", "fondo"], ["foco", "superficie"], ["foco", "campo"], ["foco", "cristal"],
  ["foco", "acento-relleno"], ["foco", "fase-final"], ["foco", "fase-descanso"], ["foco", "fase-pausa"],
  ["fase-reaccion-texto", "fase-reaccion"],
  ["acento-relleno", "barra"], // pestaña activa de la barra flotante
  ["acento-relleno", "cristal"], ["acento-relleno", "fondo"], // nivel elegido, interruptor encendido
  ["chip-activo", "fondo"], ["chip-activo", "cristal"], // chip seleccionado
  ["acento", "fondo"], // barra de progreso de los asaltos
  ["serie-asaltos", "superficie"], ["serie-rpe", "superficie"],
];

test("los tokens existen", () => {
  for (const [a, b] of [...TEXTO, ...COMPONENTES]) {
    for (const t of [a, b]) assert.ok(t.startsWith("#") || tokens[t], `falta --${t}`);
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

test("el fondo rojo completo es solo de los últimos 10 s", () => {
  // Ninguna regla salvo la fase final pinta un fondo con el rojo de fase.
  const usos = [...css.matchAll(/([^{}]+)\{[^}]*background(?:-color)?:\s*var\(--fase-final\)/g)].map((m) => m[1].trim());
  assert.deepEqual(usos, ['#pantalla[data-fase="final"]']);
});
