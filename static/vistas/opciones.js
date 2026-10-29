// Textos de la interfaz para las opciones cerradas del perfil y los pesos del generador.
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
  golpe_favorito: {
    etiqueta: "Golpe favorito",
    opciones: [NO_LO_SE, ["jab", "Jab"], ["directo", "Directo"], ["gancho", "Gancho"],
      ["uppercut", "Uppercut"], ["cuerpo", "Golpes al cuerpo"]],
  },
  volumen: {
    etiqueta: "Volumen",
    opciones: [NO_LO_SE, ["pocos_fuertes", "Pocos y fuertes"], ["combos_largos", "Combos largos"]],
  },
  cardio: {
    etiqueta: "Cardio",
    opciones: [NO_LO_SE, ["bueno", "Bueno"], ["regular", "Regular"], ["mejorar", "Hay que mejorarlo"]],
  },
  defensa: {
    etiqueta: "Tipo de defensa",
    opciones: [NO_LO_SE, ["bloqueo", "Bloqueo y guardia"], ["esquiva", "Esquiva y cintura"],
      ["pies", "Juego de pies"], ["mixta", "Mixta"]],
  },
  iniciativa: {
    etiqueta: "Iniciativa",
    opciones: [NO_LO_SE, ["ataco", "Llevo la iniciativa"], ["espero", "Espero y contraataco"],
      ["segun_rival", "Según el rival"]],
  },
};

export const PESOS_TEXTO = {
  termina_en_gancho: {
    etiqueta: "Acabar en gancho",
    ayuda: "Más combinaciones cuyo último golpe es un gancho (aunque después venga una salida).",
  },
  bloquear_y_devolver: {
    etiqueta: "Bloquear y devolver",
    ayuda: "Más combinaciones con «bloquea» seguido de un golpe.",
  },
  entrada_con_jab: {
    etiqueta: "Entrar con el jab",
    ayuda: "Más combinaciones que empiezan con jab.",
  },
};

export const RANGO_PESO = { min: 0.5, max: 4, paso: 0.1 };

export const SENSACION = ["Muy mal", "Mal", "Normal", "Bien", "Muy bien"];
