// Port de motor/sorteo.py: sorteo de la sesión con las combinaciones de la biblioteca.
// - Solo las del nivel elegido, todas con la misma probabilidad salvo "Practicar más" (perfil
//   `practicar`): las que llevan un movimiento elegido pesan más, nunca se excluye ninguna.
// - No repite ninguna de las últimas SIN_REPETIR.
// - Hasta que hayan salido todos los golpes del 1 al 6, solo saca las que añaden alguno (en las
//   6 primeras están todos seguro).
// - Coletillas: las cortas (2-3 acciones) del nivel básico, para rellenar el final de un asalto
//   donde ya no cabe una del nivel.
// Todo en ortodoxo; si es zurdo se refleja al final con espejo().
import { biblioteca, catalogo, espejoCombo, textoHablado } from "./acciones.js";
import { datos } from "./datos.js";

export const SIN_REPETIR = 5;
export const NUMEROS = [1, 2, 3, 4, 5, 6];
export const NIVEL_COLETILLA = 1;
export const ACCIONES_COLETILLA = [2, 3]; // mínimo y máximo
// "Practicar más": cuánto multiplica cada movimiento elegido ("Un poco más", "Bastante más"). Si
// una combinación lleva varios elegidos se multiplican, como mucho TOPE_PRACTICAR.
export const FACTOR_PRACTICAR = { poco: 2.0, bastante: 4.0 };
export const TOPE_PRACTICAR = 8.0;

export function cargarPerfil() {
  return datos().perfil;
}

// El movimiento de "Practicar más" de una acción ortodoxa: "1"-"6" los golpes a la cara, "cuerpo"
// cualquier golpe al cuerpo y la familia las defensas y salidas ("rodar", "pivote").
export function movimiento(accion) {
  if (accion.numero) return String(accion.numero);
  return accion.tipo === "golpe" ? "cuerpo" : accion.familia;
}

// Los que se pueden elegir en "Practicar más", en el orden del catálogo.
export const movimientos = () => [...new Set([...catalogo().values()].map(movimiento))];

// Cuánto pesa una combinación (ortodoxa) con "Practicar más": [{ movimiento, cuanto }]. Cada
// movimiento elegido cuenta una vez aunque salga varias; lo desconocido no cuenta.
export function pesoPracticar(acciones, practicar) {
  const factores = new Map(practicar.filter((p) => Object.hasOwn(FACTOR_PRACTICAR, p.cuanto))
    .map((p) => [p.movimiento, FACTOR_PRACTICAR[p.cuanto]]));
  let peso = 1.0;
  for (const m of new Set(acciones.map(movimiento))) if (factores.has(m)) peso *= factores.get(m);
  return Math.min(TOPE_PRACTICAR, peso);
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
    this.practicar = this.perfil.practicar ?? [];
    this.combos = biblioteca().filter((c) => c.nivel === nivel);
    this.recientes = [];
    this.faltan = new Set(NUMEROS);
  }

  candidatas() {
    const libres = this.combos.filter((c) => !this.recientes.includes(c));
    const nuevas = libres.filter((c) => [...numeros(c)].some((n) => this.faltan.has(n)));
    return nuevas.length ? nuevas : libres;
  }

  siguiente() {
    const candidatas = this.candidatas();
    // Mientras falten golpes, pesan más las que añaden más: así están todos antes.
    const nuevos = (c) => [...numeros(c)].filter((n) => this.faltan.has(n)).length;
    const elegida = this.azar.elegirConPesos(candidatas,
      candidatas.map((c) => pesoPracticar(c.acciones, this.practicar) * Math.max(1, nuevos(c))));
    this.recientes = [...this.recientes, elegida].slice(-SIN_REPETIR);
    for (const n of numeros(elegida)) this.faltan.delete(n);
    return this.combinacion(elegida);
  }

  combinacion(combo) {
    const acciones = this.zurdo ? espejoCombo(combo.acciones) : combo.acciones;
    return { acciones, origen: "biblioteca", nombre: combo.nombre ?? combo.notacion, texto: textoHablado(acciones) };
  }

  // Todas las coletillas en un orden al azar ponderado por "Practicar más": la primera de la lista
  // que cumpla una condición sale con la probabilidad de su peso entre las que la cumplen. No cambia
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
    const claves = new Map(cortas.map((c) => [c, clave(pesoPracticar(c.acciones, this.practicar))]));
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
