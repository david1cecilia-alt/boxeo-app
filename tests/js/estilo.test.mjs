import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { TEXTO_AFINAR, notaAlcance, recomendarEstilo, textoEmpate, textoFaltan } from "../../static/vistas/estilo.js";
import { ESTILO, MI_ESTILO } from "../../static/vistas/opciones.js";

const tabla = JSON.parse(readFileSync(new URL("../../data/estilos.json", import.meta.url), "utf-8"));
const NOMBRES = Object.fromEntries(MI_ESTILO.opciones.filter(([id]) => id !== "no_se"));
const recomendar = (estilo, basicos = {}) => recomendarEstilo(estilo, basicos, tabla, NOMBRES);

test("la tabla usa los estilos de «Mi estilo» y las respuestas del Perfil, con su frase y fuentes", () => {
  for (const [pregunta, respuestas] of Object.entries(tabla.puntos)) {
    const validas = ESTILO[pregunta].opciones.map(([v]) => v);
    for (const [respuesta, estilos] of Object.entries(respuestas)) {
      assert.ok(validas.includes(respuesta), `${pregunta}.${respuesta}`);
      assert.ok(estilos.length && estilos.every((e) => e in NOMBRES), `${pregunta}.${respuesta}`);
      assert.ok(tabla.frases[pregunta][respuesta], `frase de ${pregunta}.${respuesta}`);
    }
  }
  assert.ok(!("cardio" in tabla.puntos), "cardio no puntúa");
  assert.ok(tabla.obligatorias.every((p) => p in tabla.puntos));
  assert.match(tabla._nota, /REVISAR CON ENTRENADOR/);
  assert.equal(tabla._fuentes.length, 3);
});

test("con menos de 4 obligatorias respondidas pide las que faltan", () => {
  assert.deepEqual(recomendar({}).faltan, 4);
  const r = recomendar({ distancia: "larga", presion: "salir", golpe_favorito: "jab", volumen: "no_se" });
  assert.equal(r.faltan, 2); // golpe favorito no es obligatoria; «No lo sé» no cuenta
  assert.equal(r.estilo, null);
  assert.equal(textoFaltan(2), "Responde 2 preguntas más para ver tu estilo recomendado.");
  assert.equal(textoFaltan(1), "Responde 1 pregunta más para ver tu estilo recomendado.");
});

test("un boxer claro, con su porqué hecho de sus respuestas", () => {
  const r = recomendar({ distancia: "larga", presion: "salir", volumen: "pocos_fuertes", iniciativa: "segun_rival", defensa: "pies", golpe_favorito: "jab" });
  assert.equal(r.faltan, 0);
  assert.deepEqual(r.puntos, { boxer: 5, fajador: 0, contragolpeador: 0, boxer_puncher: 2 });
  assert.equal(r.nombre, "Boxer");
  assert.equal(r.porque, "Porque prefieres la larga distancia, bajo presión te mueves y sales y te adaptas al rival.");
  assert.equal(r.tambien, null); // a 3 puntos
});

test("si el segundo queda a 1 punto justo, también encajas como él", () => {
  const r = recomendar({ distancia: "media", presion: "contraatacar", volumen: "pocos_fuertes", iniciativa: "espero", defensa: "pies" });
  assert.deepEqual([r.puntos.contragolpeador, r.puntos.boxer_puncher], [3, 2]);
  assert.equal(r.nombre, "Contragolpeador");
  assert.equal(r.empate, null);
  assert.equal(r.tambien, "Boxer-puncher");
});

test("a 2 puntos o más, el segundo no se nombra", () => {
  const r = recomendar({ distancia: "larga", presion: "salir", volumen: "pocos_fuertes", iniciativa: "segun_rival", defensa: "pies" });
  assert.deepEqual([r.puntos.boxer, r.puntos.boxer_puncher], [4, 2]);
  assert.equal(r.nombre, "Boxer");
  assert.equal(r.tambien, null);
});

test("con empate exacto no se elige a ninguno por el orden: encajas igual como los dos", () => {
  const respuestas = { distancia: "corta", presion: "salir", volumen: "combos_largos", iniciativa: "segun_rival" };
  const r = recomendar(respuestas);
  assert.deepEqual([r.puntos.boxer, r.puntos.fajador, r.puntos.boxer_puncher], [2, 2, 1]);
  assert.equal(r.estilo, null);
  assert.equal(r.nombre, null);
  assert.deepEqual(r.empate, ["Boxer", "Fajador"]);
  assert.equal(r.tambien, null); // el «también» es solo para el que va a 1 punto de un ganador claro
  assert.equal(textoEmpate(r.empate), "Encajas igual como Boxer y como Fajador.");
  // El porqué junta las respuestas de los dos.
  assert.equal(r.porque, "Porque prefieres la corta distancia, bajo presión te mueves y sales y lanzas combos largos.");
  // Mismo resultado aunque cambie el orden en que se escribieron las respuestas.
  const alReves = Object.fromEntries(Object.entries(respuestas).reverse());
  assert.deepEqual(recomendar(alReves).empate, ["Boxer", "Fajador"]);
});

test("empate de más de dos: encajas igual como todos ellos", () => {
  const r = recomendar({ distancia: "larga", presion: "intercambiar", volumen: "pocos_fuertes", iniciativa: "espero", cardio: "mejorar" });
  assert.deepEqual(r.empate, ["Boxer", "Fajador", "Contragolpeador", "Boxer-puncher"]);
  assert.equal(textoEmpate(r.empate), "Encajas igual como Boxer, como Fajador, como Contragolpeador y como Boxer-puncher.");
  assert.deepEqual(r.avisos, ["Este estilo exige mucho fondo."]); // el fajador está entre los empatados
});

test("«Responde más preguntas para afinar» solo si quedan preguntas de estilo sin contestar", () => {
  const todas = { distancia: "larga", presion: "salir", volumen: "pocos_fuertes", iniciativa: "segun_rival", defensa: "pies", golpe_favorito: "jab" };
  assert.equal(recomendar(todas).afinar, false);
  assert.equal(recomendar({ ...todas, golpe_favorito: "no_se" }).afinar, true); // «No lo sé» no cuenta
  const { golpe_favorito, ...sinGolpe } = todas;
  assert.equal(recomendar(sinGolpe).afinar, true);
  assert.equal(TEXTO_AFINAR, "Responde más preguntas para afinar.");
});

test("fajador con cardio por mejorar avisa del fondo; con buen cardio, no", () => {
  const fajador = { distancia: "corta", presion: "intercambiar", volumen: "combos_largos", iniciativa: "ataco", defensa: "bloqueo" };
  assert.equal(recomendar({ ...fajador, cardio: "mejorar" }).nombre, "Fajador");
  assert.deepEqual(recomendar({ ...fajador, cardio: "mejorar" }).avisos, ["Este estilo exige mucho fondo."]);
  assert.deepEqual(recomendar({ ...fajador, cardio: "bueno" }).avisos, []);
  const boxer = { distancia: "larga", presion: "salir", volumen: "pocos_fuertes", iniciativa: "segun_rival", cardio: "mejorar" };
  assert.deepEqual(recomendar(boxer).avisos, []);
});

test("alcance frente a altura: solo con las dos medidas y a partir de 3 cm", () => {
  assert.equal(notaAlcance({ altura_cm: 175, alcance_cm: 180.5 }, tabla),
    "Tu alcance es 5,5 cm mayor que tu altura: te favorece trabajar a distancia con el jab.");
  assert.equal(notaAlcance({ altura_cm: 175, alcance_cm: 178 }, tabla),
    "Tu alcance es 3 cm mayor que tu altura: te favorece trabajar a distancia con el jab.");
  assert.equal(notaAlcance({ altura_cm: 180, alcance_cm: 177 }, tabla),
    "Tu alcance es corto para tu altura: te favorecen la media y la corta distancia.");
  assert.equal(notaAlcance({ altura_cm: 180, alcance_cm: 182 }, tabla), null);
  assert.equal(notaAlcance({ altura_cm: 180, alcance_cm: null }, tabla), null);
  assert.equal(notaAlcance({}, tabla), null);
  // La nota sale aunque aún falten respuestas.
  assert.match(recomendar({}, { altura_cm: 170, alcance_cm: 180 }).alcance, /10 cm mayor/);
});
