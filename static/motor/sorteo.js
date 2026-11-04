// Port de motor/sorteo.py: sorteo de la sesión con las combinaciones de la biblioteca y, si se
// eligen, las propias del usuario (las del creador, que guarda el almacén del navegador).
// - Solo las del nivel elegido, todas con la misma probabilidad salvo "Practicar más" (perfil
//   `practicar`): las que llevan un movimiento elegido pesan más, nunca se excluye ninguna.
// - No repite ninguna de las últimas SIN_REPETIR (por su identidad: el número en la biblioteca, el
//   id en las propias); en un grupo de n, de las últimas mín(SIN_REPETIR, n − 1).
// - Hasta que hayan salido todos los golpes del 1 al 6, solo saca las que añaden alguno (en las
//   6 primeras están todos seguro).
// - Coletillas: las cortas (2-3 acciones) del nivel básico, para rellenar el final de un asalto
//   donde ya no cabe una del nivel.
// - Mezcla con las propias (SorteoMezcla): en cada sorteo, una moneda decide si sale una propia del
//   nivel (PROBABILIDAD_PROPIAS) o una de la biblioteca. «Solo las mías»: todas las propias, sin
//   mirar el nivel ni la cobertura.
// Todo en ortodoxo; si es zurdo se refleja al final con espejo().
import { accionesPorIds, biblioteca, catalogo, espejoCombo, numero, textoHablado } from "./acciones.js";
import { datos } from "./datos.js";
import { MAX_ACCIONES, nivelDe } from "./reglas.js";

export const SIN_REPETIR = 5;
export const NUMEROS = [1, 2, 3, 4, 5, 6];
export const NIVEL_COLETILLA = 1;
export const ACCIONES_COLETILLA = [2, 3]; // mínimo y máximo
// "Practicar más": cuánto multiplica cada movimiento elegido ("Un poco más", "Bastante más"). Si
// una combinación lleva varios elegidos se multiplican, como mucho TOPE_PRACTICAR.
export const FACTOR_PRACTICAR = { poco: 2.0, bastante: 4.0 };
export const TOPE_PRACTICAR = 8.0;
// Mezcla con las propias («Tus combinaciones» en Entrenar): probabilidad de que cada sorteo saque
// una propia del nivel. "ninguna" no tira moneda (sale lo mismo que sin propias); "solo", solo propias.
export const PROBABILIDAD_PROPIAS = { poco: 0.20, bastante: 0.35, mucho: 0.50 };
export const MEZCLAS = ["ninguna", ...Object.keys(PROBABILIDAD_PROPIAS), "solo"];
export const MIN_SOLO_PROPIAS = 3; // con menos, «Solo las mías» sortea como "ninguna"
export const MIN_ACCIONES_PROPIA = 2;

export function cargarPerfil() {
  return datos().perfil;
}

// El movimiento de "Practicar más" de una acción ortodoxa: "1"-"6" los golpes a la cara, "cuerpo"
// cualquier golpe al cuerpo (aunque lleven número, del 7 al 12) y la familia las defensas y salidas
// ("rodar", "pivote").
export function movimiento(accion) {
  if (accion.tipo === "golpe") return accion.objetivo === "cuerpo" ? "cuerpo" : String(accion.numero);
  return accion.familia;
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

// Lo que distingue una combinación en la ventana de no repetir: su número en la biblioteca o el id
// de la propia. No sus acciones, para que dos iguales no se confundan y Python y JS cuenten lo mismo.
export const identidad = (combo) => (combo.propia ? combo.id : combo.n);

// Si vale de coletilla por su número de acciones (ACCIONES_COLETILLA).
export const esCorta = (combo) =>
  combo.acciones.length >= ACCIONES_COLETILLA[0] && combo.acciones.length <= ACCIONES_COLETILLA[1];

// Las combinaciones en un orden al azar ponderado por "Practicar más": la primera de la lista que
// cumpla una condición sale con la probabilidad de su peso entre las que la cumplen.
export function ordenPonderado(combos, practicar, azar) {
  // u^(1/peso): ordenar por ella es sortear sin reemplazo con esos pesos.
  const clave = (peso) => {
    const u = azar.random();
    return peso > 0 ? u ** (1 / peso) : 0.0;
  };
  const claves = new Map(combos.map((c) => [c, clave(pesoPracticar(c.acciones, practicar))]));
  return [...combos].sort((a, b) => claves.get(b) - claves.get(a));
}

// Cuántas de las últimas no se repiten en un grupo de nCombos: SIN_REPETIR, o n − 1 si son menos
// (siempre queda alguna libre).
export const ventana = (nCombos) => Math.max(0, Math.min(SIN_REPETIR, nCombos - 1));

// Las propias del almacén ([{ id, ids, ... }]) que se pueden sortear: ids del catálogo y de
// MIN_ACCIONES_PROPIA a MAX_ACCIONES acciones. Las demás se ignoran. Devuelve
// { propia: true, id, acciones, nivel } en ortodoxo; nunca se nombran.
export function propiasValidas(propias) {
  const cat = catalogo();
  return (propias ?? [])
    .filter((p) => typeof p?.id === "string" && Array.isArray(p.ids)
      && p.ids.length >= MIN_ACCIONES_PROPIA && p.ids.length <= MAX_ACCIONES && p.ids.every((i) => cat.has(i)))
    .map((p) => {
      const acciones = accionesPorIds(p.ids);
      return Object.freeze({ propia: true, id: p.id, acciones, nivel: nivelDe(acciones) });
    });
}

// La mezcla con la que se sortea de verdad: "solo" con menos de MIN_SOLO_PROPIAS propias, y
// poco/bastante/mucho sin propias del nivel, sortean como "ninguna".
export function mezclaEfectiva(mezcla, propias, nivel) {
  if (mezcla === "solo") return propias.length >= MIN_SOLO_PROPIAS ? mezcla : "ninguna";
  if (Object.hasOwn(PROBABILIDAD_PROPIAS, mezcla)) return propias.some((p) => p.nivel === nivel) ? mezcla : "ninguna";
  return "ninguna";
}

// Sortea dentro de un grupo de combinaciones (ortodoxas): pesos de "Practicar más", ventana de no
// repetir y, si `cobertura`, primero las que añaden golpes del 1 al 6 que falten.
// Devuelve { acciones, origen: "biblioteca" | "propia", nombre, texto }.
export class SorteoGrupo {
  constructor(combos, { practicar, zurdo, azar, cobertura }) {
    this.combos = [...combos];
    this.practicar = practicar;
    this.zurdo = zurdo;
    this.azar = azar;
    this.recientes = []; // identidad de las últimas sacadas
    this.faltan = new Set(cobertura ? NUMEROS : []);
  }

  candidatas() {
    const libres = this.combos.filter((c) => !this.recientes.includes(identidad(c)));
    const nuevas = libres.filter((c) => [...numeros(c)].some((n) => this.faltan.has(n)));
    return nuevas.length ? nuevas : libres;
  }

  siguiente() {
    const candidatas = this.candidatas();
    // Mientras falten golpes, pesan más las que añaden más: así están todos antes.
    const nuevos = (c) => [...numeros(c)].filter((n) => this.faltan.has(n)).length;
    const elegida = this.azar.elegirConPesos(candidatas,
      candidatas.map((c) => pesoPracticar(c.acciones, this.practicar) * Math.max(1, nuevos(c))));
    const k = ventana(this.combos.length);
    this.recientes = k ? [...this.recientes, identidad(elegida)].slice(-k) : [];
    for (const n of numeros(elegida)) this.faltan.delete(n);
    return this.combinacion(elegida);
  }

  combinacion(combo) {
    const acciones = this.zurdo ? espejoCombo(combo.acciones) : combo.acciones;
    if (combo.propia) return { acciones, origen: "propia", nombre: null, texto: textoHablado(acciones) };
    return { acciones, origen: "biblioteca", nombre: combo.nombre ?? combo.notacion, texto: textoHablado(acciones) };
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

// Da la siguiente combinación de la biblioteca para un nivel y perfil.
export class SorteoBiblioteca extends SorteoGrupo {
  constructor(nivel, { perfil = null, zurdo = false, azar }) {
    perfil ??= cargarPerfil();
    super(biblioteca().filter((c) => c.nivel === nivel),
      { practicar: perfil.practicar ?? [], zurdo, azar, cobertura: true });
    this.nivel = nivel;
    this.perfil = perfil;
  }

  // Todas las coletillas en un orden al azar ponderado por "Practicar más": la primera de la lista
  // que cumpla una condición sale con la probabilidad de su peso entre las que la cumplen. No cambia
  // lo que recuerda el sorteo (recientes ni golpes que faltan).
  coletillas() {
    const cortas = biblioteca().filter((c) => c.nivel === NIVEL_COLETILLA && esCorta(c));
    return ordenPonderado(cortas, this.practicar, this.azar).map((c) => this.combinacion(c));
  }
}

// El sorteo de la sesión con las propias, con la misma interfaz que SorteoBiblioteca (siguiente,
// coletillas, guardar, restaurar): el guion, las reservas y Reacción no cambian.
// - "ninguna" (o una mezcla que no se puede cumplir, ver mezclaEfectiva): exactamente
//   SorteoBiblioteca, sin tirar moneda.
// - poco/bastante/mucho: en cada sorteo, con probabilidad PROBABILIDAD_PROPIAS una propia del nivel
//   y si no, una de la biblioteca. Cada grupo con su ventana y sus pesos de "Practicar más"; la
//   cobertura del 1 al 6 solo filtra la biblioteca, pero los golpes de las propias cuentan como ya
//   salidos.
// - "solo": todas las propias, de cualquier nivel, sin cobertura.
// Coletillas: las propias cortas (2-3 acciones, de cualquier nivel) entre las de la biblioteca, con
// la misma moneda en cada puesto de la lista. Con «Solo las mías», primero todas las propias cortas
// y detrás las de la biblioteca, solo para rellenar: el guion dice la primera que quepa y no se haya
// dicho hace poco, y las propias suelen estar entre las recientes (son las del asalto). Sin propias
// cortas, las de la biblioteca (y Entrenar lo avisa).
export class SorteoMezcla {
  constructor(nivel, { perfil = null, zurdo = false, azar, propias = [], mezcla = "ninguna" }) {
    this.azar = azar;
    this.biblioteca = new SorteoBiblioteca(nivel, { perfil, zurdo, azar });
    const validas = propiasValidas(propias);
    this.cortas = validas.filter(esCorta);
    this.mezcla = mezclaEfectiva(mezcla, validas, nivel);
    const delGrupo = this.mezcla === "solo" ? validas : validas.filter((p) => p.nivel === nivel);
    this.propias = new SorteoGrupo(delGrupo,
      { practicar: this.biblioteca.practicar, zurdo, azar, cobertura: false });
  }

  siguiente() {
    if (this.mezcla === "ninguna") return this.biblioteca.siguiente();
    if (this.mezcla === "solo" || this.azar.random() < PROBABILIDAD_PROPIAS[this.mezcla]) {
      const combo = this.propias.siguiente();
      for (const a of combo.acciones) this.biblioteca.faltan.delete(numero(a, this.biblioteca.zurdo));
      return combo;
    }
    return this.biblioteca.siguiente();
  }

  coletillas() {
    const deBiblioteca = this.biblioteca.coletillas();
    if (this.mezcla === "ninguna" || !this.cortas.length) return deBiblioteca;
    const propias = ordenPonderado(this.cortas, this.biblioteca.practicar, this.azar)
      .map((c) => this.propias.combinacion(c));
    if (this.mezcla === "solo") return [...propias, ...deBiblioteca];
    const p = PROBABILIDAD_PROPIAS[this.mezcla];
    const mezcladas = [];
    while (propias.length && deBiblioteca.length) {
      mezcladas.push((this.azar.random() < p ? propias : deBiblioteca).shift());
    }
    return [...mezcladas, ...propias, ...deBiblioteca];
  }

  // Lo que recuerdan los dos grupos (ver SorteoGrupo.guardar).
  guardar() {
    return [this.biblioteca.guardar(), this.propias.guardar()];
  }

  restaurar([biblioteca, propias]) {
    this.biblioteca.restaurar(biblioteca);
    this.propias.restaurar(propias);
  }
}
