// Port de motor/sorteo.py: sorteo de la sesión con las combinaciones de la biblioteca y, si se
// eligen, las propias del usuario (las del creador, que guarda el almacén del navegador).
// - Solo las del nivel elegido, todas con la misma probabilidad salvo "Practicar más" (perfil
//   `practicar`): las que llevan un movimiento elegido pesan más, nunca se excluye ninguna.
// - No repite ninguna de las últimas SIN_REPETIR (por su identidad: el número en la biblioteca, el
//   id en las propias); en un grupo de n, de las últimas mín(SIN_REPETIR, n − 1).
// - Hasta que hayan salido todos los golpes del 1 al 6, solo saca las que añaden alguno (en las
//   6 primeras están todos seguro). Luego, las que añaden un golpe al cuerpo (7-12) que falte
//   pesan PESO_CUERPO, sin filtrar.
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
export const NUMEROS = [1, 2, 3, 4, 5, 6]; // paso 1 de la cobertura: los golpes a la cara
export const NUMEROS_CUERPO = [7, 8, 9, 10, 11, 12]; // paso 2: los golpes al cuerpo
// Paso 2 de la cobertura: con el 1-6 ya dicho, cuánto pesan las que añaden un 7-12 que falte (sin
// filtrar: por eso salen a lo largo de la sesión y menos que el 1-6). REVISAR CON ENTRENADOR (motor/sorteo.py).
export const PESO_CUERPO = 2.0;
export const NIVEL_COLETILLA = 1;
export const ACCIONES_COLETILLA = [2, 3]; // mínimo y máximo
// "Practicar más" (como mucho 3 movimientos, lo limita la interfaz): cada movimiento elegido
// multiplica por FACTOR_PRACTICAR las combinaciones que lo llevan. Si una lleva varios elegidos se
// multiplican, como mucho TOPE_PRACTICAR: con ×3, dos dan ×9 y tres ×27, y se quedan en ×8, así que
// ninguna combinación pesa más de 8 veces otra. Cifras en docs/revision/rediseno-plan.md (sección 5).
export const FACTOR_PRACTICAR = 3.0;
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

// Cuánto pesa una combinación (ortodoxa) con "Practicar más": [{ movimiento }]. El `cuanto` de los
// datos viejos ("poco"/"bastante") se ignora: todos pesan FACTOR_PRACTICAR. Cada movimiento elegido
// cuenta una vez aunque salga varias veces; lo desconocido no cuenta.
export function pesoPracticar(acciones, practicar) {
  const elegidos = new Set(practicar.map((p) => p.movimiento));
  const lleva = [...new Set(acciones.map(movimiento))].filter((m) => elegidos.has(m)).length;
  return Math.min(TOPE_PRACTICAR, FACTOR_PRACTICAR ** lleva);
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
// repetir y, si `cobertura`, en dos pasos: mientras falte algún golpe del 1 al 6, solo las que
// añaden alguno; luego, las que añaden un 7-12 que falte pesan PESO_CUERPO (×2, sin filtrar).
// Devuelve { acciones, origen: "biblioteca" | "propia", nombre, texto }.
export class SorteoGrupo {
  constructor(combos, { practicar, zurdo, azar, cobertura }) {
    this.combos = [...combos];
    this.practicar = practicar;
    this.zurdo = zurdo;
    this.azar = azar;
    this.recientes = []; // identidad de las últimas sacadas
    this.faltan = new Set(cobertura ? [...NUMEROS, ...NUMEROS_CUERPO] : []);
  }

  // Los golpes del 1 al 6 que faltan y añade la combinación.
  nuevosDeCara(c) {
    return [...numeros(c)].filter((n) => n <= 6 && this.faltan.has(n)).length;
  }

  candidatas() {
    const libres = this.combos.filter((c) => !this.recientes.includes(identidad(c)));
    const nuevas = libres.filter((c) => this.nuevosDeCara(c) > 0);
    return nuevas.length ? nuevas : libres;
  }

  // Paso 1: mientras falten golpes del 1 al 6, pesan más las que añaden más (así están todos
  // antes). Paso 2: las que añaden un 7-12 que falte, ×2.
  pesoCobertura(c) {
    if (NUMEROS.some((n) => this.faltan.has(n))) return Math.max(1, this.nuevosDeCara(c));
    return [...numeros(c)].some((n) => this.faltan.has(n)) ? PESO_CUERPO : 1;
  }

  siguiente() {
    const candidatas = this.candidatas();
    const elegida = this.azar.elegirConPesos(candidatas,
      candidatas.map((c) => pesoPracticar(c.acciones, this.practicar) * this.pesoCobertura(c)));
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
//   cobertura (1-6 y luego 7-12) solo cuenta en la biblioteca, pero los golpes de las propias,
//   también los del cuerpo, cuentan como ya salidos.
// - "solo": todas las propias, de cualquier nivel, sin cobertura.
// Coletillas: las propias cortas (2-3 acciones, de cualquier nivel) entre las de la biblioteca, con
// la misma moneda en cada puesto de la lista. Con «Solo las mías», solo las propias cortas, y se
// pueden repetir aunque se hayan dicho hace poco (coletillasRepetibles, ver elegirSiguiente): la
// biblioteca solo entra si no hay ninguna propia corta (y Entrenar lo avisa).
// Con «Solo las mías» (la efectiva) y alguna propia de 2-3 acciones, las coletillas son solo propias
// y se pueden repetir aunque estén entre las últimas dichas: mejor una propia repetida que una de la
// biblioteca o el silencio. Con las otras mezclas, nunca.
export const coletillasRepetibles = (mezcla, propias) => mezcla === "solo" && propias.some(esCorta);

export class SorteoMezcla {
  constructor(nivel, { perfil = null, zurdo = false, azar, propias = [], mezcla = "ninguna" }) {
    this.azar = azar;
    this.biblioteca = new SorteoBiblioteca(nivel, { perfil, zurdo, azar });
    const validas = propiasValidas(propias);
    this.cortas = validas.filter(esCorta);
    this.mezcla = mezclaEfectiva(mezcla, validas, nivel);
    this.coletillasRepetibles = coletillasRepetibles(this.mezcla, validas);
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
    if (this.mezcla === "solo") return propias;
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
