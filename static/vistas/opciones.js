// Textos de la interfaz para las opciones cerradas del perfil.
// Todas las preguntas admiten "No lo sé" (NO_SE), que es el valor por defecto.
import { NO_SE } from "../almacen.js";

const NO_LO_SE = [NO_SE, "No lo sé"];

export const BASICOS = {
  guardia: { etiqueta: "Guardia", opciones: [NO_LO_SE, ["ortodoxa", "Ortodoxa (izquierda delante)"], ["zurda", "Zurda (derecha delante)"]] },
  nivel: { etiqueta: "Nivel actual", opciones: [NO_LO_SE, ["1", "1 · básico"], ["2", "2 · medio"], ["3", "3 · avanzado"]] },
};

// "Mi estilo": lo elige el usuario (o su entrenador). La app solo lo recomienda (vistas/estilo.js).
export const MI_ESTILO = {
  etiqueta: "Mi estilo",
  opciones: [NO_LO_SE, ["boxer", "Boxer"], ["fajador", "Fajador"], ["contragolpeador", "Contragolpeador"],
    ["boxer_puncher", "Boxer-puncher"]],
};

// Preguntas de «Sobre ti», en su orden: las cinco clave (data/estilos.json, «obligatorias»), el cardio
// (solo desempata) y, la última, el golpe favorito.
export const ESTILO = {
  distancia: {
    etiqueta: "Distancia cómoda",
    opciones: [NO_LO_SE, ["corta", "Corta"], ["media", "Media"], ["larga", "Larga"]],
  },
  presion: {
    etiqueta: "Qué hago bajo presión",
    opciones: [NO_LO_SE, ["cubrirse", "Me cubro y espero"], ["contraatacar", "Contraataco"],
      ["salir", "Me muevo y salgo"], ["intercambiar", "Intercambio golpes"]],
  },
  volumen: {
    etiqueta: "Volumen",
    opciones: [NO_LO_SE, ["pocos_fuertes", "Pocos y fuertes"], ["combos_largos", "Combos largos"]],
  },
  iniciativa: {
    etiqueta: "Iniciativa",
    opciones: [NO_LO_SE, ["ataco", "Llevo la iniciativa"], ["espero", "Espero y contraataco"],
      ["segun_rival", "Según el rival"]],
  },
  defensa: {
    etiqueta: "Tipo de defensa",
    opciones: [NO_LO_SE, ["bloqueo", "Bloqueo y guardia"], ["esquiva", "Esquiva y cintura"],
      ["pies", "Juego de pies"], ["mixta", "Mixta"]],
  },
  cardio: {
    etiqueta: "Cardio",
    opciones: [NO_LO_SE, ["bueno", "Bueno"], ["regular", "Regular"], ["mejorar", "Hay que mejorarlo"]],
  },
  golpe_favorito: {
    etiqueta: "Golpe favorito",
    opciones: [NO_LO_SE, ["jab", "Jab"], ["directo", "Recto"], ["gancho", "Crochet"],
      ["uppercut", "Gancho"], ["cuerpo", "Golpes al cuerpo"]],
  },
};

export const SENSACION = ["Muy mal", "Mal", "Normal", "Bien", "Muy bien"];
