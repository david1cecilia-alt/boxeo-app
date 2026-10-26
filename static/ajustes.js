// Une los datos del usuario (almacén) con el motor: qué perfil usa el generador y
// qué nivel/guardia se proponen al entrenar. Sin reglas de boxeo.
import { NO_SE } from "./almacen.js";
import { datos } from "./motor/datos.js";
import { GeneradorCombos } from "./motor/generador.js";
import { construirGuion } from "./motor/temporizador.js";

export const PESOS = ["termina_en_gancho", "bloquear_y_devolver", "entrada_con_jab"];

// Perfil para el generador: los pesos editados SUSTITUYEN a los de data/perfil.json.
export function perfilGenerador(perfilUsuario) {
  const base = datos().perfil;
  return perfilUsuario?.pesos ? { ...base, pesos: { ...perfilUsuario.pesos } } : base;
}

export function nuevoGuion(config, perfilUsuario, azar) {
  const generador = new GeneradorCombos(config.nivel,
    { perfil: perfilGenerador(perfilUsuario), zurdo: config.zurdo, azar });
  return construirGuion(config, azar, generador);
}

// Nivel y guardia que se proponen al entrenar: los del perfil, o los de data/perfil.json si "No lo sé".
export function preferencias(perfilUsuario) {
  const base = datos().perfil;
  const { guardia, nivel } = perfilUsuario.basicos;
  return {
    nivel: nivel === NO_SE ? base.nivel : Number(nivel),
    zurdo: (guardia === NO_SE ? base.guardia : guardia) === "zurda",
  };
}
