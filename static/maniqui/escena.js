// Escena 3D del maniquí (Three.js). Solo se carga con import() al abrir una ficha con
// postura: la app arranca sin Three.js.
// Maniquí hecho por código, sin modelos que descargar: piezas torneadas (LatheGeometry) con
// proporciones humanas (torso en V, extremidades más gruesas arriba, cuello, botas), guantes
// gris oscuro más grandes que la cabeza y articulaciones con punto rojo. Material satinado con
// oclusión ambiental suave en las juntas, borde de luz roja (Fresnel) solo en espalda y hombros,
// humo sutil detrás y sombra suave en el suelo. Las luces y el humo van con la cámara: se
// mantienen al girar.
import * as THREE from "../vendor/three/three.module.min.js";

import { cinematica } from "./posturas.js";

// Algo por delante del cuerpo: así cabe el brazo estirado de los golpes en la vista de lado.
const OBJETIVO = new THREE.Vector3(0, 0.84, 0.18);
// Ángulos de cámara (grados): acimut 0 = de frente (desde +Z), 90 = de lado (desde +X, el
// lado izquierdo del maniquí). Elevación negativa = desde abajo. La primera es la de inicio.
export const VISTAS = {
  tres_cuartos: { acimut: 55, elevacion: -4 },
  frente: { acimut: 0, elevacion: 6 },
  lado: { acimut: 90, elevacion: 6 },
  arriba: { acimut: 0, elevacion: 89 },
};
export const VISTA_INICIAL = "tres_cuartos";

const GRIS_GUANTE = 0x2a2a2a;
const GRIS_MUNEQUERA = 0x3d3d3d;

function token(nombre, porDefecto) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return valor || porDefecto;
}

// ---------- Formas ----------
// Perfiles de revolución [radio, y] en metros, de abajo arriba, en el marco de su articulación
// (el hueso sale hacia −Y). Se suavizan con una spline; radio 0 en los extremos cierra la pieza.
// Cada pieza entra un poco en las articulaciones vecinas: así no quedan huecos al doblar.
const PERFILES = {
  brazo: [[0, -0.33], [0.037, -0.31], [0.04, -0.26], [0.046, -0.17], [0.053, -0.08], [0.057, -0.02], [0.05, 0.03], [0, 0.04]],
  antebrazo: [[0, -0.26], [0.032, -0.24], [0.036, -0.18], [0.043, -0.09], [0.046, -0.04], [0.04, 0.02], [0, 0.03]],
  muslo: [[0, -0.47], [0.047, -0.45], [0.052, -0.4], [0.066, -0.28], [0.079, -0.12], [0.083, -0.02], [0.07, 0.04], [0, 0.05]],
  pierna: [[0, -0.42], [0.031, -0.4], [0.036, -0.32], [0.047, -0.18], [0.053, -0.09], [0.046, 0.02], [0, 0.03]],
  pelvis: [[0, -0.15], [0.06, -0.14], [0.1, -0.09], [0.112, -0.03], [0.102, 0.04], [0.084, 0.1], [0, 0.12]],
  abdomen: [[0, -0.05], [0.088, -0.04], [0.083, 0.05], [0.086, 0.13], [0.092, 0.2], [0, 0.24]],
  pecho: [[0, -0.1], [0.07, -0.09], [0.09, -0.03], [0.108, 0.03], [0.122, 0.08], [0.13, 0.13], [0.11, 0.17], [0.06, 0.195], [0, 0.2]],
  cuello: [[0, -0.05], [0.05, -0.04], [0.044, 0.03], [0.041, 0.1], [0, 0.12]],
  // Guante: puño (centro a la altura del punto `puno`, 9 cm más allá de la muñeca) y muñequera.
  puno: [[0, -0.195], [0.06, -0.188], [0.086, -0.165], [0.097, -0.12], [0.095, -0.07], [0.083, -0.03], [0.064, -0.005], [0, 0]],
  munequera: [[0, -0.005], [0.058, 0], [0.057, 0.05], [0.053, 0.09], [0.04, 0.095], [0, 0.095]],
  cana: [[0, -0.06], [0.05, -0.055], [0.048, 0.04], [0.044, 0.12], [0.038, 0.125], [0, 0.125]],
  // Pie de la bota: a lo largo de +Z (talón → punta); se tumba al crearlo.
  pie: [[0, -0.07], [0.035, -0.065], [0.046, -0.04], [0.048, 0.03], [0.046, 0.11], [0.036, 0.165], [0, 0.19]],
};
// Escala [x, z] de las piezas que no son redondas (el tronco es más ancho que hondo).
const ESCALAS = { pelvis: [1.3, 0.82], abdomen: [1.22, 0.8], pecho: [1.45, 0.76], puno: [1.12, 0.9], cana: [1, 1.1] };

function torneado(nombre) {
  const curva = new THREE.SplineCurve(PERFILES[nombre].map(([r, y]) => new THREE.Vector2(r, y)));
  const perfil = curva.getPoints(48).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const geometria = new THREE.LatheGeometry(perfil, 32);
  const [x, z] = ESCALAS[nombre] ?? [1, 1];
  return geometria.scale(x, 1, z);
}

// Articulaciones visibles: [nombre, radio, lado del punto rojo (+1 fuera izq, −1 fuera der)].
const ARTICULACIONES = [
  ["hombro_izq", 0.066, 1], ["codo_izq", 0.046, 1], ["cadera_izq", 0.075, 1], ["rodilla_izq", 0.054, 1],
  ["hombro_der", 0.066, -1], ["codo_der", 0.046, -1], ["cadera_der", 0.075, -1], ["rodilla_der", 0.054, -1],
];
// Piezas torneadas en el marco de cada articulación: [articulación, perfil, material].
const PIEZAS = [
  ["pelvis", "pelvis", "piel"], ["columna", "abdomen", "espalda"], ["pecho", "pecho", "espalda"],
  ["cuello", "cuello", "piel"],
  ...["izq", "der"].flatMap((l) => [
    [`hombro_${l}`, "brazo", "piel"], [`codo_${l}`, "antebrazo", "piel"],
    [`muneca_${l}`, "puno", "guante"], [`muneca_${l}`, "munequera", "munequera"],
    [`cadera_${l}`, "muslo", "piel"], [`rodilla_${l}`, "pierna", "piel"],
    [`tobillo_${l}`, "cana", "guante"], [`tobillo_${l}`, "pie", "guante"],
  ]),
];

// ---------- Acabado (shader) ----------
// Oclusión ambiental: cada junta es una esfera que oscurece lo que tiene cerca (oclusión
// analítica de esfera, Íñigo Quílez). Sin postproceso: cuesta unas líneas de shader.
const N_ESFERAS = 16;
const AO = { fuerza: 0.9, maximo: 0.55 };
// Borde rojo: Fresnel solo en las caras del tronco que miran a la espalda o arriba (hombros).
const HALO = { fuerza: 2.6, dureza: 3.0 };

const GLSL_COMUN = `
varying vec3 vMundo;
uniform vec4 esferasAO[${N_ESFERAS}];
uniform vec3 espalda;
uniform vec3 arribaPecho;
uniform vec3 colorHalo;
float ocluir(vec3 p, vec3 n, vec4 e) {
  vec3 d = e.xyz - p;
  float l = length(d);
  float h = l / e.w;
  if (h <= 1.0) return 0.0;
  float nl = dot(n, d / l);
  float h2 = h * h;
  float k2 = 1.0 - h2 * nl * nl;
  float res = max(0.0, nl) / h2;
  if (k2 > 0.001) {
    res = nl * acos(clamp(-nl * sqrt((h2 - 1.0) / max(1.0 - nl * nl, 1e-4)), -1.0, 1.0)) - sqrt(k2 * (h2 - 1.0));
    res = (res / h2 + atan(sqrt(k2 / (h2 - 1.0)))) / 3.141593;
  }
  return res;
}`;

function acabado(material, uniformes, { halo = false } = {}) {
  if (halo) material.defines = { CON_HALO: "" };
  material.customProgramCacheKey = () => (halo ? "maniqui-halo" : "maniqui");
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMundo;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GLSL_COMUN}`)
      .replace("#include <aomap_fragment>", `#include <aomap_fragment>
      vec3 nMundo = normalize(inverseTransformDirection(normal, viewMatrix));
      float oclusion = 0.0;
      for (int i = 0; i < ${N_ESFERAS}; i++) oclusion += ocluir(vMundo, nMundo, esferasAO[i]);
      float ao = 1.0 - clamp(oclusion * ${AO.fuerza.toFixed(2)}, 0.0, ${AO.maximo.toFixed(2)});
      reflectedLight.indirectDiffuse *= ao;
      reflectedLight.directDiffuse *= mix(1.0, ao, 0.7);
      reflectedLight.directSpecular *= ao;`)
      .replace("#include <tonemapping_fragment>", `#include <tonemapping_fragment>
      #ifdef CON_HALO
      float fresnel = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), ${HALO.dureza.toFixed(1)});
      float hacia = saturate(1.6 * dot(nMundo, espalda) + 0.8 * max(dot(nMundo, arribaPecho), 0.0) - 0.1);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, colorHalo, saturate(fresnel * hacia * ${HALO.fuerza.toFixed(1)}));
      #endif`);
  };
  return material;
}

// Humo: manchas suaves deterministas (misma textura siempre: las fotos sin WebGL no cambian).
function texturaHumo() {
  const lado = 128;
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = lado;
  const g = lienzo.getContext("2d");
  let semilla = 12345;
  const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 60; i++) {
    const x = lado * (0.3 + 0.4 * azar());
    const y = lado * (0.3 + 0.4 * azar());
    const r = lado * (0.06 + 0.14 * azar());
    const degradado = g.createRadialGradient(x, y, 0, x, y, r);
    degradado.addColorStop(0, `rgba(255,255,255,${(0.05 + 0.08 * azar()).toFixed(3)})`);
    degradado.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = degradado;
    g.fillRect(0, 0, lado, lado);
  }
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}
// [x, y, tamaño, rojo?, opacidad, giro] en el espacio de la cámara, detrás del maniquí.
const HUMO = [
  [-1.0, 0.15, 2.6, false, 0.14, 0.3], [-0.55, -0.6, 2.2, false, 0.1, 1.2], [0.15, 0.95, 2.0, false, 0.05, 2.6],
  [1.0, 0.3, 2.8, true, 0.22, 2.0], [1.3, -0.5, 2.4, true, 0.16, 0.7],
];

export function crearEscena(lienzo, datos) {
  const esqueleto = datos.esqueleto;
  const fondo = new THREE.Color(token("--fondo", "#0a0a0a"));
  const acento = new THREE.Color(token("--acento", "#ff3b30"));
  const rojoHalo = new THREE.Color(token("--acento-relleno", "#d7192a"));

  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const escena = new THREE.Scene();
  escena.fog = new THREE.Fog(fondo, 5.5, 11);

  const camara = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  escena.add(camara);

  // ---------- Luces (en el espacio de la cámara) ----------
  escena.add(new THREE.HemisphereLight(0xffffff, fondo, 0.3));
  const principal = new THREE.DirectionalLight(0xffffff, 2.4);
  principal.position.set(-2.5, 3.2, 1.5); // delante, arriba a la izquierda
  camara.add(principal);
  const relleno = new THREE.DirectionalLight(0xffffff, 0.18);
  relleno.position.set(2, 0.5, 2);
  camara.add(relleno);
  // Los objetivos de las luces van al maniquí aunque las luces sigan a la cámara.
  for (const luz of [principal, relleno]) {
    luz.target.position.copy(OBJETIVO);
    escena.add(luz.target);
  }

  // Sombra suave: la proyecta una luz fija desde arriba (no gira con la cámara). No ilumina
  // (intensidad 0): solo alimenta el ShadowMaterial del suelo.
  const sombra = new THREE.DirectionalLight(0xffffff, 0);
  sombra.position.set(-0.6, 5, 0.8);
  sombra.castShadow = true;
  sombra.shadow.mapSize.set(1024, 1024);
  sombra.shadow.radius = 6;
  sombra.shadow.blurSamples = 16;
  Object.assign(sombra.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: 1, far: 8 });
  escena.add(sombra);
  const suelo = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.55 }),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true;
  escena.add(suelo);

  // ---------- Humo ----------
  const humo = texturaHumo();
  for (const [x, y, tamano, rojo, opacidad, giro] of HUMO) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: humo, color: rojo ? rojoHalo : 0xffffff, transparent: true, opacity: opacidad,
      rotation: giro, depthWrite: false, fog: false, toneMapped: false,
    }));
    sprite.position.set(x, y, -5.6);
    sprite.scale.setScalar(tamano);
    camara.add(sprite);
  }

  // ---------- Materiales ----------
  const esferasAO = Array.from({ length: N_ESFERAS }, () => new THREE.Vector4(0, -10, 0, 0.01));
  const uniformes = {
    esferasAO: { value: esferasAO },
    espalda: { value: new THREE.Vector3(0, 0, -1) },
    arribaPecho: { value: new THREE.Vector3(0, 1, 0) },
    colorHalo: { value: rojoHalo },
  };
  const satinado = (color, roughness = 0.45) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
  const materiales = {
    piel: acabado(satinado(0xebe8e3), uniformes),
    espalda: acabado(satinado(0xebe8e3), uniformes, { halo: true }),
    guante: acabado(satinado(GRIS_GUANTE, 0.42), uniformes),
    munequera: acabado(satinado(GRIS_MUNEQUERA, 0.8), uniformes),
  };
  const rojo = new THREE.MeshStandardMaterial({ color: acento, roughness: 0.5, emissive: acento, emissiveIntensity: 0.35 });

  // ---------- Maniquí ----------
  const maniqui = new THREE.Group();
  escena.add(maniqui);
  const malla = (geometria, material) => {
    const m = new THREE.Mesh(geometria, material);
    m.castShadow = true;
    maniqui.add(m);
    return m;
  };

  const geometrias = Object.fromEntries(Object.keys(PERFILES).map((n) => [n, torneado(n)]));
  geometrias.pie.rotateX(Math.PI / 2).scale(1, 0.72, 1).translate(0, -0.035, 0);
  const piezas = PIEZAS.map(([marco, perfil, material]) => ({ marco, malla: malla(geometrias[perfil], materiales[material]) }));

  const articulaciones = ARTICULACIONES.map(([nombre, radio, lado]) => {
    const grupo = new THREE.Group();
    const material = nombre.startsWith("hombro") ? materiales.espalda : materiales.piel;
    const esfera = new THREE.Mesh(new THREE.SphereGeometry(radio, 28, 18), material);
    esfera.castShadow = true;
    grupo.add(esfera);
    const punto = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.2, 12, 8), rojo);
    punto.position.set(lado * radio * 0.93, 0, 0);
    grupo.add(punto);
    maniqui.add(grupo);
    return { nombre, grupo };
  });

  const cabeza = malla(new THREE.SphereGeometry(0.1, 36, 26).scale(0.84, 1.08, 0.94), materiales.piel);
  const mandibula = malla(new THREE.SphereGeometry(0.062, 24, 16).scale(1, 0.9, 1.05), materiales.piel);
  const orejas = [1, -1].map((s) => ({ s, malla: malla(new THREE.SphereGeometry(0.022, 12, 10).scale(0.5, 1.2, 0.9), materiales.piel) }));
  const pulgares = ["izq", "der"].map((lado) => ({
    lado, malla: malla(new THREE.CapsuleGeometry(0.026, 0.06, 6, 12), materiales.guante),
  }));

  // ---------- Colocar una postura ----------
  const v = (p) => new THREE.Vector3(...p);
  const q = (r) => new THREE.Quaternion(...r);

  // Coloca una pieza en el marco de una articulación con un desplazamiento local.
  function enMarco(m, marco, desplazamiento = [0, 0, 0], giroLocal = null) {
    const rot = q(marco.rot);
    m.position.copy(v(marco.pos)).add(v(desplazamiento).applyQuaternion(rot));
    m.quaternion.copy(giroLocal ? rot.multiply(giroLocal) : rot);
  }

  // Esferas de oclusión: juntas, centro de tronco y cabeza, y guantes.
  const OCLUSORES = [
    ["hombro_izq", 0.06], ["hombro_der", 0.06], ["codo_izq", 0.042], ["codo_der", 0.042],
    ["cadera_izq", 0.068], ["cadera_der", 0.068], ["rodilla_izq", 0.05], ["rodilla_der", 0.05],
    ["cuello", 0.04], ["puno_izq", 0.085], ["puno_der", 0.085],
    ["pecho", 0.09, [0, 0.08, 0]], ["columna", 0.075, [0, 0.1, 0]], ["pelvis", 0.085, [0, -0.03, 0]],
    ["cabeza", 0.09, [0, 0.11, 0]], ["tobillo_der", 0.04],
  ];

  function mostrar(resuelta) {
    const mundo = cinematica(esqueleto, resuelta);
    for (const p of piezas) enMarco(p.malla, mundo[p.marco]);
    for (const a of articulaciones) enMarco(a.grupo, mundo[a.nombre]);
    enMarco(cabeza, mundo.cabeza, [0, 0.12, 0.005]);
    enMarco(mandibula, mundo.cabeza, [0, 0.06, 0.035]);
    for (const o of orejas) enMarco(o.malla, mundo.cabeza, [o.s * 0.083, 0.115, -0.005]);
    for (const p of pulgares) {
      const s = p.lado === "izq" ? 1 : -1;
      enMarco(p.malla, mundo[`muneca_${p.lado}`], [-s * 0.085, -0.07, 0.035],
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 0, s * 0.25)));
    }

    OCLUSORES.forEach(([nombre, radio, desplazamiento = [0, 0, 0]], i) => {
      const marco = mundo[nombre];
      const centro = v(marco.pos).add(v(desplazamiento).applyQuaternion(q(marco.rot)));
      esferasAO[i].set(centro.x, centro.y, centro.z, radio);
    });
    const giroPecho = q(mundo.pecho.rot);
    uniformes.espalda.value.set(0, 0, -1).applyQuaternion(giroPecho);
    uniformes.arribaPecho.value.set(0, 1, 0).applyQuaternion(giroPecho);
  }

  // ---------- Cámara ----------
  const orbita = { ...VISTAS[VISTA_INICIAL], distancia: 3.7 };

  function colocarCamara() {
    const a = THREE.MathUtils.degToRad(orbita.acimut);
    const e = THREE.MathUtils.degToRad(orbita.elevacion);
    camara.position.set(
      OBJETIVO.x + orbita.distancia * Math.cos(e) * Math.sin(a),
      OBJETIVO.y + orbita.distancia * Math.sin(e),
      OBJETIVO.z + orbita.distancia * Math.cos(e) * Math.cos(a),
    );
    // Desde arriba, el rival queda en la parte de arriba de la pantalla.
    camara.up.set(0, 1, 0);
    if (orbita.elevacion > 80) camara.up.set(Math.sin(a), 0, Math.cos(a));
    camara.lookAt(OBJETIVO);
  }

  function ajustarTamano() {
    const { clientWidth: ancho, clientHeight: alto } = lienzo;
    if (!ancho || !alto) return;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    // En pantallas estrechas se aleja para que quepa el cuerpo entero.
    orbita.distancia = camara.aspect < 0.6 ? 4.6 : 3.7;
    camara.updateProjectionMatrix();
  }

  function pintar() {
    colocarCamara();
    renderer.render(escena, camara);
  }

  ajustarTamano();
  const observador = new ResizeObserver(() => { ajustarTamano(); pintar(); });
  observador.observe(lienzo);

  return {
    mostrar(resuelta) { mostrar(resuelta); pintar(); },
    orbita,
    pintar,
    destruir() {
      observador.disconnect();
      humo.dispose();
      renderer.dispose();
    },
  };
}
