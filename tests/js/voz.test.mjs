import assert from "node:assert/strict";
import { test } from "node:test";

import { elegirVoz, nombreCortoVoz, vocesEspanol } from "../../static/voz.js";

test("el nombre corto de la voz quita la coletilla del idioma", () => {
  assert.equal(nombreCortoVoz("Microsoft Helena - Spanish (Spain)"), "Microsoft Helena");
  assert.equal(nombreCortoVoz("Microsoft Álvaro Online (Natural) - Spanish (Spain)"), "Microsoft Álvaro Online (Natural)");
});

test("los nombres sin coletilla se quedan como están", () => {
  assert.equal(nombreCortoVoz("Google español"), "Google español");
  assert.equal(nombreCortoVoz("Mónica"), "Mónica");
  assert.equal(nombreCortoVoz("Jorge-Enhanced"), "Jorge-Enhanced");
});

// Voces de mentira con los campos de SpeechSynthesisVoice que se usan.
const voz = (name, lang, voiceURI = `urn:${name}`, localService = true) => ({ name, lang, voiceURI, localService });
const HELENA = voz("Microsoft Helena - Spanish (Spain)", "es-ES");
const PABLO = voz("Microsoft Pablo - Spanish (Spain)", "es-ES");
const SABINA = voz("Microsoft Sabina - Spanish (Mexico)", "es-MX");
const ONLINE = voz("Google español", "es-ES", "Google español", false);
const DAVID = voz("Microsoft David - English (United States)", "en-US");
const VOCES = [DAVID, SABINA, ONLINE, PABLO, HELENA];

test("automática: la primera de es-ES local, como hasta ahora", () => {
  assert.equal(elegirVoz(VOCES), PABLO);
  assert.equal(elegirVoz([ONLINE, SABINA]), ONLINE, "sin locales, la de es-ES");
  assert.equal(elegirVoz([DAVID, SABINA]), SABINA, "sin es-ES, otra en español");
  assert.equal(elegirVoz([DAVID]), null);
});

test("la voz elegida se busca por su voiceURI o, si no, por su nombre", () => {
  assert.equal(elegirVoz(VOCES, "urn:Microsoft Helena - Spanish (Spain)"), HELENA);
  assert.equal(elegirVoz(VOCES, "Microsoft Sabina - Spanish (Mexico)"), SABINA);
});

test("si la voz guardada no está en este dispositivo, se usa la automática sin error", () => {
  assert.equal(elegirVoz(VOCES, "urn:voz-de-otro-movil"), PABLO);
  assert.equal(elegirVoz([], "urn:voz-de-otro-movil"), null);
});

test("solo se ofrecen voces en español, primero las de España", () => {
  assert.deepEqual(vocesEspanol(VOCES), [ONLINE, HELENA, PABLO, SABINA]);
});
