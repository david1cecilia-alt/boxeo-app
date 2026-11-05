// Con la mezcla «Ninguna» la sesión sale exactamente igual que antes (ver igual_que_antes.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { cargarDatosDeDisco } from "./datos.mjs";
import { FIJOS, casos } from "./igual_que_antes.mjs";

cargarDatosDeDisco();
const fijos = JSON.parse(readFileSync(FIJOS, "utf-8")).js;

test("la biblioteca sortea igual que antes, también el guion de la app", () => {
  assert.deepEqual(casos(), fijos);
});
