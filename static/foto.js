// La foto propia del avatar, sin DOM: de un fichero que elige el usuario (cámara o galería) a un
// data:image/jpeg;base64 de 256 × 256, con el recorte cuadrado centrado. Nunca sale del navegador.
// - Orientación: createImageBitmap con imageOrientation "from-image" aplica la del EXIF (las fotos del
//   móvil no salen giradas); el recorte se calcula sobre la imagen ya girada.
// - Lienzo: OffscreenCanvas si lo hay (y da contexto 2D); si no, un <canvas>.
// - HEIC: Safari en iPhone lo pasa a JPEG al elegirlo y macOS lo lee; donde no se puede decodificar
//   (Chrome de escritorio), se rechaza con un texto claro.
// El resultado tiene que pasar fotoValida() del almacén: si a 0,85 no cabe, se prueba a 0,7.
import { fotoValida } from "./almacen.js";

export const LADO_FOTO = 256;
export const CALIDADES = [0.85, 0.7];
export const MAX_ENTRADA = 20 * 1024 * 1024; // 20 MB: las del móvil pesan 3-12 MB

export const TEXTOS_FOTO = {
  noImagen: "Eso no es una imagen: elige una foto JPG, PNG o WebP.",
  grande: "La foto pesa más de 20 MB: elige otra más ligera.",
  ilegible: "No se puede leer esta imagen (puede ser HEIC). Prueba con una JPG o PNG.",
  sinLienzo: "Este navegador no puede preparar la foto.",
  noCabe: "No se ha podido reducir la foto lo bastante: prueba con otra.",
};

export class ErrorFoto extends Error {
  constructor(clave) {
    super(TEXTOS_FOTO[clave]);
    this.name = "ErrorFoto";
    this.clave = clave;
  }
}

// El cuadrado más grande centrado en una imagen de ancho × alto.
export function recorteCentrado(ancho, alto) {
  const lado = Math.min(ancho, alto);
  return { x: Math.floor((ancho - lado) / 2), y: Math.floor((alto - lado) / 2), lado };
}

function decodificarPorDefecto(archivo) {
  return createImageBitmap(archivo, { imageOrientation: "from-image" });
}

// Base64 de un ArrayBuffer, a trozos (String.fromCharCode con muchos argumentos desborda la pila).
function base64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

// Un lienzo de lado × lado: { contexto, codificar(calidad) → Promise<data URL JPEG> }, o null.
function lienzoPorDefecto(lado) {
  if (typeof OffscreenCanvas === "function") {
    const lienzo = new OffscreenCanvas(lado, lado);
    const contexto = lienzo.getContext("2d");
    if (contexto) {
      return {
        contexto,
        async codificar(calidad) {
          const blob = await lienzo.convertToBlob({ type: "image/jpeg", quality: calidad });
          return `data:image/jpeg;base64,${base64(await blob.arrayBuffer())}`;
        },
      };
    }
  }
  const lienzo = globalThis.document?.createElement("canvas");
  const contexto = lienzo?.getContext("2d");
  if (!contexto) return null;
  lienzo.width = lado;
  lienzo.height = lado;
  return { contexto, codificar: async (calidad) => lienzo.toDataURL("image/jpeg", calidad) };
}

/**
 * De un File/Blob de imagen al data URL JPEG del avatar. Lanza ErrorFoto (con su texto para el usuario)
 * si no es una imagen, pesa demasiado, no se puede leer o no cabe. `decodificar` y `crearLienzo` se
 * inyectan en los tests.
 */
export async function prepararFoto(archivo, { decodificar = decodificarPorDefecto, crearLienzo = lienzoPorDefecto } = {}) {
  // Sin tipo es lo normal con HEIC en Windows: se intenta igualmente.
  if (archivo?.type && !archivo.type.startsWith("image/")) throw new ErrorFoto("noImagen");
  if (!archivo?.size) throw new ErrorFoto("ilegible");
  if (archivo.size > MAX_ENTRADA) throw new ErrorFoto("grande");

  let imagen;
  try {
    imagen = await decodificar(archivo);
  } catch {
    throw new ErrorFoto("ilegible");
  }
  try {
    if (!imagen?.width || !imagen?.height) throw new ErrorFoto("ilegible");
    const lienzo = crearLienzo(LADO_FOTO);
    if (!lienzo) throw new ErrorFoto("sinLienzo");
    const { contexto } = lienzo;
    const { x, y, lado } = recorteCentrado(imagen.width, imagen.height);
    // Fondo blanco: lo transparente de un PNG saldría negro en JPEG.
    contexto.fillStyle = "#fff";
    contexto.fillRect(0, 0, LADO_FOTO, LADO_FOTO);
    contexto.imageSmoothingEnabled = true;
    contexto.imageSmoothingQuality = "high";
    contexto.drawImage(imagen, x, y, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
    for (const calidad of CALIDADES) {
      const datos = await lienzo.codificar(calidad);
      if (fotoValida(datos)) return datos;
    }
    throw new ErrorFoto("noCabe");
  } finally {
    imagen?.close?.();
  }
}
