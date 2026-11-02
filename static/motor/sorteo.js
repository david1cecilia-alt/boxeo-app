// Port de motor/sorteo.py: sorteo de la sesión con las combinaciones de la biblioteca.
// - Solo las del nivel elegido o inferiores.
// - No repite ninguna de las últimas SIN_REPETIR.
// - Hasta que hayan salido todos los golpes del 1 al 6, solo saca las que añaden alguno (en las
//   6 primeras están todos seguro).
// - La proporción de combinaciones con defensa es la del nivel (defensaPorNivel).
// - Los pesos del perfil y el refuerzo de "Practicar" multiplican la probabilidad de cada una.
// - Coletillas: las cortas (2-3 acciones) del nivel básico, para rellenar el final de un asalto
//   donde ya no cabe una del nivel.
// Todo en ortodoxo; si es zurdo se refleja al final con espejo().
import { biblioteca, defensaPorNivel, espejoCombo, textoHablado } from "./acciones.js";
import { datos } from "./datos.js";
import { ultimoGolpe } from "./reglas.js";

export const SIN_REPETIR = 5;
export const NUMEROS = [1, 2, 3, 4, 5, 6];
export const NIVEL_COLETILLA = 1;
export const ACCIONES_COLETILLA = [2, 3]; // mínimo y máximo

export const PERFIL_NEUTRO = { pesos: {} };

export function cargarPerfil() {
  return datos().perfil;
}

// Multiplica los pesos del perfil que cumple la combinación (ortodoxa).
// `refuerzo` ({ acciones: [ids], factor }) sube las combinaciones que llevan alguna de esas
// acciones: es el "Practicar" de una ficha, solo para una sesión.
export function pesoPerfil(combo, pesos, refuerzo = null) {
  let peso = 1.0;
  const ultimo = ultimoGolpe(combo);
  if (ultimo && ultimo.familia === "gancho") peso *= pesos.termina_en_gancho ?? 1.0;
  if (combo.some((a) => a.familia === "bloqueo")) peso *= pesos.bloquear_y_devolver ?? 1.0;
  if (combo[0].id === "jab") peso *= pesos.entrada_con_jab ?? 1.0;
  if (refuerzo && combo.some((a) => refuerzo.acciones.includes(a.id))) peso *= refuerzo.factor;
  return peso;
}

export const numeros = (combo) => new Set(combo.acciones.map((a) => a.numero).filter(Boolean));

// Da la siguiente combinación de la biblioteca para un nivel y perfil.
// Devuelve { acciones, origen: "biblioteca", nombre, texto }.
export class SorteoBiblioteca {
  constructor(nivel, { perfil = null, zurdo = false, azar }) {
    this.nivel = nivel;
    this.perfil = perfil ?? cargarPerfil();
    this.zurdo = zurdo;
    this.azar = azar;
    this.pesos = this.perfil.pesos ?? {};
    this.refuerzo = this.perfil.refuerzo ?? null;
    this.combos = biblioteca().filter((c) => c.nivel <= nivel);
    this.probDefensa = defensaPorNivel()[nivel];
    this.recientes = [];
    this.faltan = new Set(NUMEROS);
  }

  candidatas() {
    const conDefensa = this.azar.random() < this.probDefensa;
    const libres = this.combos.filter((c) => !this.recientes.includes(c));
    const filtrado = libres.filter((c) => c.conDefensa === conDefensa);
    const delTipo = filtrado.length ? filtrado : libres;
    if (!this.faltan.size) return delTipo;
    // La cobertura del 1 al 6 manda sobre la proporción de defensa.
    const nuevas = (grupo) => grupo.filter((c) => [...numeros(c)].some((n) => this.faltan.has(n)));
    for (const grupo of [nuevas(delTipo), nuevas(libres)]) if (grupo.length) return grupo;
    return delTipo;
  }

  siguiente() {
    const candidatas = this.candidatas();
    // Mientras falten golpes, pesan más las que añaden más: así están todos antes.
    const nuevos = (c) => [...numeros(c)].filter((n) => this.faltan.has(n)).length;
    const elegida = this.azar.elegirConPesos(candidatas,
      candidatas.map((c) => pesoPerfil(c.acciones, this.pesos, this.refuerzo) * Math.max(1, nuevos(c))));
    this.recientes = [...this.recientes, elegida].slice(-SIN_REPETIR);
    for (const n of numeros(elegida)) this.faltan.delete(n);
    return this.combinacion(elegida);
  }

  combinacion(combo) {
    const acciones = this.zurdo ? espejoCombo(combo.acciones) : combo.acciones;
    return { acciones, origen: "biblioteca", nombre: combo.nombre ?? combo.notacion, texto: textoHablado(acciones) };
  }

  // Todas las coletillas en un orden al azar ponderado por el perfil: la primera de la lista que
  // cumpla una condición sale con la probabilidad de su peso entre las que la cumplen. No cambia
  // lo que recuerda el sorteo (recientes ni golpes que faltan).
  coletillas() {
    const [minimo, maximo] = ACCIONES_COLETILLA;
    const cortas = biblioteca().filter((c) => c.nivel === NIVEL_COLETILLA
      && c.acciones.length >= minimo && c.acciones.length <= maximo);
    // u^(1/peso): ordenar por ella es sortear sin reemplazo con esos pesos.
    const clave = (peso) => {
      const u = this.azar.random();
      return peso > 0 ? u ** (1 / peso) : 0.0;
    };
    const claves = new Map(cortas.map((c) => [c, clave(pesoPerfil(c.acciones, this.pesos, this.refuerzo))]));
    return [...cortas].sort((a, b) => claves.get(b) - claves.get(a)).map((c) => this.combinacion(c));
  }

  // Lo que recuerda el sorteo, para sacar reservas sin que cuenten (ver restaurar).
  guardar() {
    return [[...this.recientes], new Set(this.faltan)];
  }

  restaurar([recientes, faltan]) {
    this.recientes = [...recientes];
    this.faltan = new Set(faltan);
  }
}
