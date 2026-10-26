// Generador pseudoaleatorio con semilla (mulberry32). Reproducible consigo mismo:
// la misma semilla da siempre la misma secuencia en JS. No imita a random de Python.

export function crearAzar(semilla) {
  let estado = semilla >>> 0;

  function random() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    random,
    // Entero en [a, b], ambos incluidos (como randint de Python).
    randint: (a, b) => a + Math.floor(random() * (b - a + 1)),
    uniform: (a, b) => a + (b - a) * random(),
    choice: (lista) => lista[Math.floor(random() * lista.length)],
    // Un elemento elegido con probabilidad proporcional a su peso.
    elegirConPesos(lista, pesos) {
      const total = pesos.reduce((s, p) => s + p, 0);
      let r = random() * total;
      for (let i = 0; i < lista.length; i++) {
        r -= pesos[i];
        if (r < 0) return lista[i];
      }
      return lista[lista.length - 1];
    },
  };
}

// Semilla nueva para cada sesión.
export function semillaAleatoria() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
