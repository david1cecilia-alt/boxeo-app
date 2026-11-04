import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GRUPOS, TEXTO_LLENO, TEXTO_MAXIMO, TEXTO_MINIMO, anadir, anuncio, baldosas, cambiarCuerpo, combinacionesParaListar,
  editorNuevo, escuchar, ficha, hayCambios, puedeCrear, quitar, quitarUltima, resumen, textoBorrar, textoParaLectores,
} from "../../static/creador.js";
import { MAX_ACCIONES, MAX_PROPIAS } from "../../static/motor/reglas.js";
import { cargarDatosDeDisco } from "./datos.mjs";

const datos = cargarDatosDeDisco();

// Texto corto de data/acciones.json para una acción ortodoxa (lo que pinta la sesión).
function cortoDelJson(id) {
  const a = datos.acciones.acciones.find((x) => x.id === id);
  const familia = datos.acciones.textos[a.familia];
  const t = a.objetivo === "cuerpo" ? familia.al_cuerpo : familia;
  const lado = { izq: "izq.", der: "dcha." };
  return t.corto.replace("{mano}", lado[a.mano] ?? "").replace("{lado}", lado[a.lado] ?? "");
}

test("las baldosas salen de data/acciones.json: golpes 1-6, al cuerpo 7-12, defensas y salidas", () => {
  const golpes = baldosas("golpe");
  assert.deepEqual(golpes.map((b) => b.numero), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(baldosas("golpe", true).map((b) => b.numero), [7, 8, 9, 10, 11, 12]);
  for (const grupo of Object.keys(GRUPOS)) {
    const delJson = datos.acciones.acciones.filter((a) => a.tipo === grupo && (grupo !== "golpe" || a.objetivo !== "cuerpo"));
    const vistas = baldosas(grupo);
    assert.deepEqual(vistas.map((b) => b.id), delJson.map((a) => a.id));
    for (const b of vistas) assert.equal(b.texto, cortoDelJson(b.id));
  }
  assert.equal(baldosas("defensa").every((b) => b.numero === null), true);
  assert.equal(ficha("directo_cuerpo").texto, "recto abajo");
  assert.equal(ficha("gancho_der_cuerpo").texto, "croch. dcha. abajo");
});

test("añadir va al final, como mucho 10, y «Al cuerpo» se apaga solo tras cada golpe", () => {
  let e = cambiarCuerpo(editorNuevo(), true);
  e = anadir(e, "bloqueo");
  assert.equal(e.alCuerpo, true, "una defensa no apaga «Al cuerpo»");
  e = anadir(e, "directo_cuerpo");
  assert.equal(e.alCuerpo, false);
  assert.deepEqual(e.ids, ["bloqueo", "directo_cuerpo"]);
  for (let i = 0; i < 20; i++) e = anadir(e, "jab");
  assert.equal(e.ids.length, MAX_ACCIONES);
  assert.equal(anadir(e, "no_existe"), e);
});

test("quitar una cualquiera o la última; sin reordenar", () => {
  let e = editorNuevo(["jab", "directo", "bloqueo"]);
  assert.deepEqual(quitar(e, 1).ids, ["jab", "bloqueo"]);
  assert.deepEqual(quitarUltima(e).ids, ["jab", "directo"]);
  assert.equal(quitar(e, 7), e);
  e = editorNuevo();
  assert.equal(quitarUltima(e), e);
});

test("hay cambios solo si los ids no son los de partida", () => {
  const e = editorNuevo(["jab", "directo"]);
  assert.equal(hayCambios(e), false);
  assert.equal(hayCambios(anadir(e, "jab")), true);
  assert.equal(hayCambios(quitarUltima(anadir(e, "jab"))), false);
  assert.equal(hayCambios(cambiarCuerpo(e, true)), false);
});

test("guardar: «Mínimo 2» con 0-1 acciones; con 10, paleta llena; nivel y contador", () => {
  assert.equal(resumen([], []).motivo, TEXTO_MINIMO);
  assert.equal(resumen(["jab"], []).puedeGuardar, false);
  const dos = resumen(["jab", "directo"], []);
  assert.equal(dos.puedeGuardar, true);
  assert.equal(dos.motivo, null);
  assert.equal(dos.textoNivel, "Básico");
  assert.equal(dos.contador, "2 de 10 acciones");
  const diez = resumen(Array(10).fill("jab"), []);
  assert.equal(diez.lleno, true);
  assert.equal(diez.motivoPaleta, TEXTO_MAXIMO);
  assert.equal(diez.textoNivel, "Avanzado");
  assert.equal(diez.puedeGuardar, true);
});

test("avisos: sin golpes, igual que una de la biblioteca (con nivel) e igual que otra propia, no consigo misma", () => {
  assert.deepEqual(resumen(["bloqueo", "parada"], []).avisos.map((a) => a.tipo), ["sin_golpes"]);
  const deLaBiblioteca = datos.combinaciones.combinaciones[0];
  const avisos = resumen(deLaBiblioteca.ids, []).avisos;
  assert.equal(avisos[0].tipo, "biblioteca");
  assert.match(avisos[0].texto, /nivel (básico|medio|avanzado)/);
  const propias = [{ id: "p-1", ids: ["jab", "jab", "bloqueo"] }, { id: "p-2", ids: ["directo", "bloqueo"] }];
  assert.deepEqual(resumen(["directo", "bloqueo"], propias).avisos.map((a) => a.texto), ["Es igual que tu combinación 2."]);
  assert.deepEqual(resumen(["directo", "bloqueo"], propias, "p-2").avisos, []);
});

test("anuncio para lectores de pantalla: «Añadido recto abajo. 3 acciones, básico.»", () => {
  assert.equal(anuncio("Añadido", "directo_cuerpo", ["jab", "jab", "directo_cuerpo"]), "Añadido recto abajo. 3 acciones, básico.");
  assert.equal(anuncio("Añadido", "jab", ["jab"]), "Añadido jab. 1 acción.");
  assert.equal(anuncio("Quitado", "jab", []), "Quitado jab. 0 acciones.");
});

test(`se puede crear hasta ${MAX_PROPIAS}; con ${MAX_PROPIAS}, el motivo`, () => {
  const propias = Array.from({ length: MAX_PROPIAS }, (_, i) => ({ id: `p-${i}`, ids: ["jab", "directo"] }));
  assert.deepEqual(puedeCrear(propias.slice(1)), { puede: true, motivo: null });
  assert.deepEqual(puedeCrear(propias), { puede: false, motivo: TEXTO_LLENO });
});

test("listado: «Combinación N» por su orden, nivel, fichas y el texto para lectores de pantalla", () => {
  const lista = combinacionesParaListar([
    { id: "p-a", ids: ["jab", "rodar_der", "uppercut_der"] },
    { id: "p-b", ids: ["jab", "directo", "esquiva_izq", "gancho_izq", "directo"] },
    { id: "p-c", ids: ["jab", "otra_version", "directo"] },
  ]);
  assert.deepEqual(lista.map((c) => c.titulo), ["Combinación 1", "Combinación 2", "Combinación 3"]);
  assert.deepEqual(lista.map((c) => c.textoNivel), ["Básico", "Medio", "Básico"]);
  assert.deepEqual(lista[0].fichas.map((f) => [f.numero, f.texto]), [[1, "jab"], [null, "rueda dcha."], [6, "gancho dcha."]]);
  assert.equal(lista[0].hablado, textoParaLectores(["jab", "rodar_der", "uppercut_der"]));
  assert.match(lista[0].hablado, /rueda derecha/);
  assert.equal(lista[2].fichas.length, 2);
});

test("borrar avisa de que las siguientes se renumeran (y no si es la última)", () => {
  assert.equal(textoBorrar(3, 3).detalle, "No se puede deshacer.");
  assert.match(textoBorrar(2, 3).detalle, /La combinación 3 pasará a ser la 2/);
  assert.match(textoBorrar(1, 3).detalle, /se renumeran: la 2 pasará a ser la 1, y así hasta la 3/);
  assert.equal(textoBorrar(1, 3).titulo, "¿Borrar la combinación 1?");
});

test("«Escuchar» dice la combinación en el modo de voz de Entrenar y a la velocidad de Ajustes, en ortodoxo", () => {
  const ids = ["jab", "rodar_der", "gancho_izq"];
  const perfil = (voz, velocidad) => ({ sesion: { voz }, voz: { id: null, velocidad } });
  assert.deepEqual(escuchar(ids, perfil("numeros", "lenta")), { texto: "uno, rueda derecha, tres", velocidad: 0.9 });
  assert.deepEqual(escuchar(ids, perfil("nombres", "normal")),
    { texto: "jab, rueda derecha, crochet de izquierda", velocidad: 1.1 });
  assert.deepEqual(escuchar(ids, perfil("ambos", "rapida")),
    { texto: "uno jab, rueda derecha, tres crochet de izquierda", velocidad: 1.3 });
  assert.equal(escuchar([], perfil("ambos", "rapida")), null, "sin acciones no hay nada que decir");
  // Una propia sin golpes se dice igual en los tres modos (las órdenes de las defensas).
  const defensas = ["bloqueo", "parada", "paso_atras"];
  const textos = ["numeros", "nombres", "ambos"].map((m) => escuchar(defensas, perfil(m, "normal")).texto);
  assert.equal(new Set(textos).size, 1);
});
