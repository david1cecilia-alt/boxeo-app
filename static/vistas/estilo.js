// Estilo recomendado del Perfil (lógica pura, sin DOM). La tabla de puntos, las frases y los
// umbrales viven en data/estilos.json (se inyecta como `tabla`): cada respuesta suma 1 punto a
// cada estilo de su lista. Es orientativo: el estilo lo definen meses de práctica y el entrenador.

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
// Devuelve { faltan, puntos, estilo, nombre, porque, tambien, avisos, alcance }:
// con `faltan` > 0 aún no hay recomendación (estilo null).
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
  // A igual puntuación, el orden de «Mi estilo» (estable: siempre el mismo resultado).
  const [primero, segundo] = Object.keys(nombres).sort((a, b) => puntos[b] - puntos[a]);
  const razones = Object.keys(tabla.puntos)
    .filter((p) => respondida(estilo, tabla, p) && tabla.puntos[p][estilo[p]].includes(primero))
    .map((p) => tabla.frases[p][estilo[p]])
    .slice(0, MAX_RAZONES);
  const avisos = primero === "fajador" && estilo.cardio === "mejorar" ? ["Este estilo exige mucho fondo."] : [];
  return {
    faltan: 0, puntos, estilo: primero, nombre: nombres[primero],
    porque: razones.length ? `Porque ${enumerar(razones)}.` : "",
    tambien: segundo && puntos[segundo] > 0 && puntos[primero] - puntos[segundo] <= 1 ? nombres[segundo] : null,
    avisos, alcance,
  };
}

// «Responde 2 preguntas más para ver tu estilo recomendado».
export function textoFaltan(faltan) {
  return `Responde ${faltan} ${faltan === 1 ? "pregunta" : "preguntas"} más para ver tu estilo recomendado.`;
}
