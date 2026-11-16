import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_FOTO } from "../../static/almacen.js";
import {
  CALIDADES, ErrorFoto, LADO_FOTO, MAX_ENTRADA, TEXTOS_FOTO, codificarFoto, leerFoto, prepararFoto, recorteCentrado,
} from "../../static/foto.js";

// Un fichero falso: solo importan el tipo y el tamaño (la decodificación también es falsa).
const fichero = (type = "image/jpeg", size = 1000) => ({ type, size });

// Un lienzo falso que apunta lo que se dibuja y devuelve, por cada calidad, el data URL que se le dé.
function lienzoFalso(porCalidad = () => "data:image/jpeg;base64,AAAA") {
  const llamadas = { dibujos: [], calidades: [], rellenos: [] };
  return {
    llamadas,
    crear(lado) {
      llamadas.lado = lado;
      return {
        contexto: {
          fillRect: (...a) => llamadas.rellenos.push(a),
          drawImage: (...a) => llamadas.dibujos.push(a.slice(1)),
        },
        codificar: async (calidad) => { llamadas.calidades.push(calidad); return porCalidad(calidad); },
      };
    },
  };
}

const imagen = (width, height) => {
  const img = { width, height, cerrada: false, close() { img.cerrada = true; } };
  return img;
};

async function rechaza(promesa, clave) {
  await assert.rejects(promesa, (e) => e instanceof ErrorFoto && e.clave === clave && e.message === TEXTOS_FOTO[clave]);
}

test("el recorte es el cuadrado mayor centrado", () => {
  assert.deepEqual(recorteCentrado(800, 600), { x: 100, y: 0, lado: 600 });
  assert.deepEqual(recorteCentrado(600, 800), { x: 0, y: 100, lado: 600 });
  assert.deepEqual(recorteCentrado(256, 256), { x: 0, y: 0, lado: 256 });
  assert.deepEqual(recorteCentrado(801, 600), { x: 100, y: 0, lado: 600 });
});

test("800 × 600 se recorta al centro y se reduce a 256 × 256 en JPEG 0,85", async () => {
  const lienzo = lienzoFalso();
  const img = imagen(800, 600);
  const datos = await prepararFoto(fichero(), { decodificar: async () => img, crearLienzo: lienzo.crear });
  assert.equal(datos, "data:image/jpeg;base64,AAAA");
  assert.equal(lienzo.llamadas.lado, LADO_FOTO);
  assert.deepEqual(lienzo.llamadas.dibujos, [[100, 0, 600, 600, 0, 0, 256, 256]]);
  assert.deepEqual(lienzo.llamadas.rellenos, [[0, 0, 256, 256]], "fondo blanco para lo transparente");
  assert.deepEqual(lienzo.llamadas.calidades, [0.85]);
  assert.ok(img.cerrada, "el bitmap se libera");
});

test("si a 0,85 no cabe en el almacén se prueba a 0,7, y si tampoco se rechaza", async () => {
  assert.deepEqual(CALIDADES, [0.85, 0.7]);
  const grande = `data:image/jpeg;base64,${"A".repeat(MAX_FOTO)}`;
  const lienzo = lienzoFalso((c) => (c === 0.85 ? grande : "data:image/jpeg;base64,BBBB"));
  const datos = await prepararFoto(fichero(), { decodificar: async () => imagen(300, 300), crearLienzo: lienzo.crear });
  assert.equal(datos, "data:image/jpeg;base64,BBBB");
  assert.deepEqual(lienzo.llamadas.calidades, [0.85, 0.7]);
  const img = imagen(300, 300);
  await rechaza(prepararFoto(fichero(), { decodificar: async () => img, crearLienzo: lienzoFalso(() => grande).crear }), "noCabe");
  assert.ok(img.cerrada);
  // Un navegador que no codifica JPEG devuelve PNG: tampoco vale.
  await rechaza(prepararFoto(fichero(), {
    decodificar: async () => imagen(300, 300), crearLienzo: lienzoFalso(() => "data:image/png;base64,AAAA").crear }), "noCabe");
});

test("lo que no es imagen, vacío o de más de 20 MB se rechaza sin decodificar", async () => {
  const nunca = async () => { throw new Error("no debería decodificar"); };
  await rechaza(prepararFoto(fichero("text/plain"), { decodificar: nunca }), "noImagen");
  await rechaza(prepararFoto(fichero("application/pdf"), { decodificar: nunca }), "noImagen");
  await rechaza(prepararFoto(fichero("image/jpeg", 0), { decodificar: nunca }), "ilegible");
  await rechaza(prepararFoto(fichero("image/jpeg", MAX_ENTRADA + 1), { decodificar: nunca }), "grande");
});

test("lo que no se puede decodificar (HEIC en escritorio) se rechaza con su texto", async () => {
  const falla = async () => { throw new DOMException("The source image could not be decoded.", "InvalidStateError"); };
  await rechaza(prepararFoto(fichero("image/heic"), { decodificar: falla }), "ilegible");
  // Sin tipo (HEIC en Windows) se intenta igualmente.
  let intentado = false;
  await rechaza(prepararFoto(fichero(""), { decodificar: async () => { intentado = true; throw new Error("x"); } }), "ilegible");
  assert.ok(intentado);
  await rechaza(prepararFoto(fichero(), { decodificar: async () => imagen(0, 0), crearLienzo: lienzoFalso().crear }), "ilegible");
});

test("sin lienzo 2D se dice que el navegador no puede", async () => {
  const img = imagen(10, 10);
  await rechaza(prepararFoto(fichero(), { decodificar: async () => img, crearLienzo: () => null }), "sinLienzo");
  assert.ok(img.cerrada);
});

test("con un recorte elegido se dibuja ese cuadrado a 256 × 256 y la imagen se cierra", async () => {
  const lienzo = lienzoFalso();
  const img = imagen(800, 600);
  const datos = await codificarFoto(img, { x: 300, y: 150, lado: 200 }, { crearLienzo: lienzo.crear });
  assert.equal(datos, "data:image/jpeg;base64,AAAA");
  assert.equal(lienzo.llamadas.lado, LADO_FOTO);
  assert.deepEqual(lienzo.llamadas.dibujos, [[300, 150, 200, 200, 0, 0, LADO_FOTO, LADO_FOTO]]);
  assert.ok(img.cerrada);
});

test("leerFoto devuelve la imagen sin cerrarla (es para el recorte) y rechaza igual que prepararFoto", async () => {
  const img = imagen(40, 30);
  assert.equal(await leerFoto(fichero(), { decodificar: async () => img }), img);
  assert.ok(!img.cerrada);
  await rechaza(leerFoto(fichero("text/plain"), { decodificar: async () => img }), "noImagen");
  const vacia = imagen(0, 0);
  await rechaza(leerFoto(fichero(), { decodificar: async () => vacia }), "ilegible");
  assert.ok(vacia.cerrada);
});
