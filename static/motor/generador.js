// Port de motor/generador.py: reglas + combos clásicos + pesos del perfil.
// Todo se genera en ortodoxo; si el perfil es zurdo se refleja al final con espejo().
import { catalogo, combosClasicos, espejoCombo, nombreHablado, repeticionesPermitidas } from "./acciones.js";
import { datos } from "./datos.js";
import { LONGITUD, SOLTAR_TRAS, esValida, familiaMano, ultimoGolpe } from "./reglas.js";

// Peso base de cada tipo al elegir la siguiente acción del paseo.
const PESO_TIPO = { golpe: 4.0, defensa: 1.5, movimiento: 1.0 };
// Hay tantas versiones al cuerpo como a la cabeza: sin esto saldrían la mitad de las veces.
const PESO_CUERPO = 0.5;

const pesoPaso = (a) => PESO_TIPO[a.tipo] * (a.objetivo === "cuerpo" ? PESO_CUERPO : 1.0);

export const PERFIL_NEUTRO = { pesos: {}, proporcion_clasicos: 0.3 };

export function cargarPerfil() {
  return datos().perfil;
}

export function textoCombo(acciones) {
  return acciones.map(nombreHablado).join(", ");
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

// Acciones que pueden ir en la siguiente posición sin romper reglas locales.
function candidatas(previa, combo, esUltima, nivel, disponibles) {
  const opciones = [];
  const hayGolpe = combo.some((a) => a.tipo === "golpe");
  for (const a of disponibles) {
    // Los movimientos solo como salida final (decisión del generador, no regla).
    if (a.tipo === "movimiento" && !esUltima) continue;
    if (esUltima) {
      if (a.familia === "bloqueo") continue;
      if (!hayGolpe && a.tipo !== "golpe") continue;
      if (nivel >= 2 && a.tipo === "golpe" && a.poder) continue;
    }
    if (previa) {
      if (previa.familia === "bloqueo" && a.tipo !== "golpe") continue;
      // Dos defensas seguidas no rompen reglas, pero el generador las evita:
      // se entrena defender Y devolver.
      if (previa.tipo === "defensa" && a.tipo === "defensa") continue;
      if (a.tipo === "golpe") {
        if (previa.familia === "rodar" && familiaMano(a) !== `gancho|${previa.peso_despues}`) continue;
        const permitidos = SOLTAR_TRAS[previa.id];
        if (permitidos && !permitidos.has(familiaMano(a))) continue;
        if (previa.tipo === "golpe" && previa.mano === a.mano
            && !repeticionesPermitidas().has(`${previa.id}|${a.id}`)) continue;
      }
    }
    opciones.push(a);
  }
  return opciones;
}

function paseo(nivel, azar) {
  const disponibles = [...catalogo().values()].filter((a) => a.nivel_minimo <= nivel);
  const longitud = azar.randint(...LONGITUD[nivel]);
  const combo = [];
  for (let i = 0; i < longitud; i++) {
    const previa = combo.length ? combo[combo.length - 1] : null;
    const opciones = candidatas(previa, combo, i === longitud - 1, nivel, disponibles);
    if (!opciones.length) return null;
    combo.push(azar.elegirConPesos(opciones, opciones.map(pesoPaso)));
  }
  return combo;
}

const clave = (acciones) => acciones.map((a) => a.id).join("|");

// Da la siguiente combinación a dictar para un nivel y perfil.
// Devuelve { acciones, origen: "reglas" | "clasico", nombre, texto }.
export class GeneradorCombos {
  constructor(nivel, { perfil = null, zurdo = false, azar }) {
    this.nivel = nivel;
    this.perfil = perfil ?? cargarPerfil();
    this.zurdo = zurdo;
    this.azar = azar;
    this.pesos = this.perfil.pesos ?? {};
    this.pesoMax = Object.values(this.pesos).reduce((p, v) => p * Math.max(v, 1.0), 1.0);
    this.refuerzo = this.perfil.refuerzo ?? null;
    if (this.refuerzo) this.pesoMax *= Math.max(this.refuerzo.factor, 1.0);
    // Solo los clásicos que cumplen las reglas de ESTE nivel.
    this.clasicos = combosClasicos().filter((c) => esValida(c.acciones, nivel));
    this.anterior = null;
  }

  candidata(clasico) {
    if (clasico) {
      const c = this.azar.choice(this.clasicos);
      return { acciones: c.acciones, origen: "clasico", nombre: c.nombre };
    }
    const combo = paseo(this.nivel, this.azar);
    if (!combo || !esValida(combo, this.nivel)) return null;
    return { acciones: combo, origen: "reglas", nombre: null };
  }

  siguiente() {
    // Primero se decide la rama, para que la proporción de clásicos sea la del perfil.
    const clasico = this.clasicos.length > 0
      && this.azar.random() < (this.perfil.proporcion_clasicos ?? 0.3);
    let candidata;
    while (true) {
      candidata = this.candidata(clasico);
      if (!candidata || clave(candidata.acciones) === this.anterior) continue;
      const aceptar = pesoPerfil(candidata.acciones, this.pesos, this.refuerzo) / this.pesoMax;
      if (this.azar.random() < aceptar) break;
    }
    this.anterior = clave(candidata.acciones);
    const acciones = this.zurdo ? espejoCombo(candidata.acciones) : candidata.acciones;
    return { ...candidata, acciones, texto: textoCombo(acciones) };
  }
}
