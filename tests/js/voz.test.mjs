import assert from "node:assert/strict";
import { test } from "node:test";

import { nombreCortoVoz } from "../../static/voz.js";

test("el nombre corto de la voz quita la coletilla del idioma", () => {
  assert.equal(nombreCortoVoz("Microsoft Helena - Spanish (Spain)"), "Microsoft Helena");
  assert.equal(nombreCortoVoz("Microsoft Álvaro Online (Natural) - Spanish (Spain)"), "Microsoft Álvaro Online (Natural)");
});

test("los nombres sin coletilla se quedan como están", () => {
  assert.equal(nombreCortoVoz("Google español"), "Google español");
  assert.equal(nombreCortoVoz("Mónica"), "Mónica");
  assert.equal(nombreCortoVoz("Jorge-Enhanced"), "Jorge-Enhanced");
});
