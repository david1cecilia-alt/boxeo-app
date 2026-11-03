import assert from "node:assert/strict";
import { test } from "node:test";

import { palabra, plural } from "../../static/vistas/dom.js";

test("los contadores van en singular solo con 1: «1 sesión», «0 sesiones», «2 asaltos»", () => {
  assert.equal(plural(1, "sesión", "sesiones"), "1 sesión");
  assert.equal(plural(0, "sesión", "sesiones"), "0 sesiones");
  assert.equal(plural(2, "asalto", "asaltos"), "2 asaltos");
  assert.equal(palabra(1, "minuto", "minutos"), "minuto");
  assert.equal(palabra(1.5, "minuto", "minutos"), "minutos");
});
