// Estilo recomendado del Perfil (lógica pura, sin DOM). La tabla de puntos, las frases y los
// umbrales viven en data/estilos.json (se inyecta como `tabla`): cada respuesta suma 1 punto a
// cada estilo de su lista.

const fmt = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const MAX_RAZONES = 3;

// Respuestas que puntúan (las demás, como «No lo sé», no cuentan).
const respondida = (estilo, tabla, pregunta) => Boolean(tabla.puntos[pregunta]?.[estilo[pregunta]]);

// «a», «a y b», «a, b y c».
function enumerar(partes) {
  return partes.length < 2 ? partes.join("") : `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

// Alcance frente a altura, solo si están las dos medidas. Siempre como ventaja, nunca obligación.
export function notaAlcance(basicos, tabla) {
  const { altura_cm: altura, alcance_cm: alcance } = basicos ?? {};
  if (typeof altura !== "number" || typeof alcance !== "number") return null;
  const diferencia = alcance - altura;
  if (diferencia >= tabla.umbral_alcance_cm) {
    return `Tu alcance es ${fmt(diferencia)} cm mayor que tu altura: te favorece trabajar a distancia con el jab.`;
  }
  if (diferencia <= -tabla.umbral_alcance_cm) {
    return "Tu alcance es corto para tu altura: te favorecen la media y la corta distancia.";
  }
  return null;
}

// `estilo`: perfil.estilo; `basicos`: perfil.basicos; `nombres`: { id: «Boxer», … } (los de «Mi estilo»).
// Devuelve { faltan, puntos, estilo, nombre, empate, porque, tambien, afinar, avisos, alcance }:
// con `faltan` > 0 aún no hay recomendación (estilo null). Con empate exacto en cabeza no se elige
// a ninguno por el orden: estilo y nombre null y `empate` con los nombres empatados.
// `afinar`: quedan preguntas que puntúan sin contestar (o con «No lo sé»).
export function recomendarEstilo(estilo, basicos, tabla, nombres) {
  const alcance = notaAlcance(basicos, tabla);
  const hechas = tabla.obligatorias.filter((p) => respondida(estilo, tabla, p)).length;
  const faltan = Math.max(tabla.minimo - hechas, 0);
  const puntos = Object.fromEntries(Object.keys(nombres).map((id) => [id, 0]));
  for (const pregunta of Object.keys(tabla.puntos)) {
    if (!respondida(estilo, tabla, pregunta)) continue;
    for (const id of tabla.puntos[pregunta][estilo[pregunta]]) puntos[id] += 1;
  }
  if (faltan) return { faltan, puntos, estilo: null, alcance };
  const maximo = Math.max(...Object.values(puntos));
  // Los de cabeza en el orden de «Mi estilo» (solo para escribirlos siempre igual).
  const cabeza = Object.keys(nombres).filter((id) => puntos[id] === maximo);
  const segundo = Object.keys(nombres).filter((id) => puntos[id] === maximo - 1);
  const razones = Object.keys(tabla.puntos)
    .filter((p) => respondida(estilo, tabla, p) && tabla.puntos[p][estilo[p]].some((id) => cabeza.includes(id)))
    .map((p) => tabla.frases[p][estilo[p]])
    .slice(0, MAX_RAZONES);
  const avisos = cabeza.includes("fajador") && estilo.cardio === "mejorar" ? ["Este estilo exige mucho fondo."] : [];
  const unico = cabeza.length === 1 ? cabeza[0] : null;
  return {
    faltan: 0, puntos, estilo: unico, nombre: unico && nombres[unico],
    empate: unico ? null : cabeza.map((id) => nombres[id]),
    porque: razones.length ? `Porque ${enumerar(razones)}.` : "",
    // Solo con un ganador claro y el segundo a 1 punto justo.
    tambien: unico && segundo.length && maximo > 1 ? enumerar(segundo.map((id) => nombres[id])) : null,
    afinar: Object.keys(tabla.puntos).some((p) => !respondida(estilo, tabla, p)),
    avisos, alcance,
  };
}

// «Encajas igual como Boxer y como Fajador» (o «como A, como B y como C»).
export function textoEmpate(empatados) {
  return `Encajas igual ${enumerar(empatados.map((n) => `como ${n}`))}.`;
}

export const TEXTO_AFINAR = "Responde más preguntas para afinar.";

// «Responde 2 preguntas más para ver tu estilo recomendado».
export function textoFaltan(faltan) {
  return `Responde ${faltan} ${faltan === 1 ? "pregunta" : "preguntas"} más para ver tu estilo recomendado.`;
}
