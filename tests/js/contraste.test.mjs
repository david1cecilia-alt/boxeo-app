// Contraste WCAG de los colores de estilos.css: texto AA (4,5:1) y componentes (3:1).
// Los tokens translúcidos se componen sobre lo que tienen debajo: el cristal y los botones
// secundarios, sobre el fondo negro; la pastilla de RPE y las barras del gráfico, sobre su
// tarjeta; la barra flotante, sobre el peor caso posible, blanco puro (una foto clara detrás),
// así vale con o sin backdrop-filter.
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
const DEBAJO = {
  cristal: "fondo", secundario: "fondo", "secundario-hover": "fondo",
  "acento-tenue": "superficie", "serie-barra": "superficie",
};

// [r, g, b] de 0 a 255; los rgba se componen sobre `debajo` (o sobre lo que llevan siempre debajo).
function rgb(c, debajo = BLANCO) {
  const valor = c.startsWith("#") || c.startsWith("rgba") ? c : tokens[c];
  if (valor.startsWith("#")) return [1, 3, 5].map((i) => parseInt(valor.slice(i, i + 2), 16));
  if (DEBAJO[c]) debajo = rgb(DEBAJO[c]);
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
  // Preparación: la cuenta atrás sobre el velo del ring, compuesto sobre el peor caso (blanco puro).
  ["texto", "velo-ring"],
  // Historial y perfil
  ["sobre-acento", "acento-relleno"], // cifra destacada y tarjeta de estilo
  ["acento", "acento-tenue"], ["terciario", "superficie"], ["terciario", "secundario"], // RPE, gráfico
  // Galería: días con sesión (rojo) y futuros (tenue), sobre la página, la celda y la celda elegida
  ["acento", "superficie-hover"], ["tenue", "fondo"], ["tenue", "superficie"], ["tenue", "superficie-hover"],
];

const COMPONENTES = [
  ["borde", "superficie"], ["borde", "campo"], ["borde", "fondo"],
  ["foco", "fondo"], ["foco", "superficie"], ["foco", "campo"], ["foco", "cristal"],
  ["foco", "acento-relleno"], ["foco", "fase-final"], ["foco", "fase-descanso"], ["foco", "fase-pausa"],
  ["fase-reaccion-texto", "fase-reaccion"],
  // Pestaña activa (barra flotante) y nivel elegido (cristal, fondo): la marca de 3:1 es su borde en el rojo
  // de texto; el relleno lleva el texto blanco (arriba, en TEXTO).
  ["acento", "barra"], ["acento", "fondo"],
  // Indicadores sin texto, en el rojo de texto: deslizador, interruptor encendido, medidor, borde al pasar
  // por una baldosa (tarjeta) o una ficha (campo); y la bolita clara del interruptor sobre él.
  ["acento", "superficie"], ["acento", "campo"], ["acento", "cristal"], ["texto", "acento"],
  ["chip-activo", "fondo"], ["chip-activo", "cristal"], // chip seleccionado
  ["acento", "fondo"], // barra de progreso de los asaltos
  ["serie-asaltos", "superficie"], ["serie-rpe", "superficie"], ["serie-barra", "superficie"],
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

// Los días de otro mes ya no llevan color: su casilla del calendario va vacía.
test("en la galería, lo futuro se ve más apagado que lo pasado sin sesiones", () => {
  const fondo = rgb("fondo");
  const [suave, tenue] = ["suave", "tenue"].map((t) => luminancia(rgb(t, fondo)));
  assert.ok(suave > tenue);
  assert.equal(tokens.apagado, undefined);
});

test("el fondo rojo completo es solo de los últimos 10 s", () => {
  // Ninguna regla salvo la fase final pinta un fondo con el rojo de fase.
  const usos = [...css.matchAll(/([^{}]+)\{[^}]*background(?:-color)?:\s*var\(--fase-final\)/g)].map((m) => m[1].trim());
  assert.deepEqual(usos, ['#pantalla[data-fase="final"]']);
});

// Gris neutro (rediseño, R7): los fondos, superficies y textos grises no tiran a cálido ni a frío.
const GRISES = ["fondo", "superficie", "superficie-hover", "campo", "barra", "borde", "texto", "suave", "terciario",
  "tenue", "chip-activo", "sobre-chip-activo", "fase-asalto", "fase-pausa", "serie-rpe", "foco", "sobre-acento"];

test("los tokens grises son neutros (R = G = B)", () => {
  for (const t of GRISES) {
    const valor = tokens[t];
    assert.ok(valor, `falta --${t}`);
    const [r, g, b] = valor.startsWith("#")
      ? [1, 3, 5].map((i) => parseInt(valor.slice(i, i + 2), 16))
      : valor.slice(5, -1).split(",").slice(0, 3).map(Number);
    assert.ok(r === g && g === b, `--${t} no es gris neutro: ${valor}`);
  }
});

test("los degradados de las fotos usan el fondo (--fondo-rgb), no un negro suelto", () => {
  const fondoRgb = raiz.match(/--fondo-rgb:\s*(\d+) (\d+) (\d+);/);
  assert.ok(fondoRgb, "falta --fondo-rgb");
  assert.deepEqual(fondoRgb.slice(1).map(Number), rgb("fondo"));
  assert.ok(!/rgba\(10, ?10, ?10/.test(css), "queda un rgba(10, 10, 10, …) suelto");
  assert.ok(/rgb\(var\(--fondo-rgb\) \/ [\d.]+\)/.test(css));
});
