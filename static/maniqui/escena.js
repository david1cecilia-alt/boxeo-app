// Escena 3D del maniquí (Three.js). Solo se carga con import() al abrir una ficha con
// postura: la app arranca sin Three.js.
// El maniquí es un GLB (maniqui.glb, comprimido con Draco) que crea
// herramientas/blender/crear_maniqui.py con MPFB: cuerpo de 1,86 m blanco mate, cabeza lisa,
// guantes y botas gris oscuro, pantalón negro con cinturilla roja y punto rojo en las juntas.
// Cada articulación de data/posturas.json mueve su `hueso` del GLB (y los que cuelgan de él sin
// articulación propia). Material satinado con oclusión ambiental suave en las juntas, líneas
// finas de unión de maniquí (cuello, hombros, cintura, codos, muñecas y rodillas), borde de luz
// roja (Fresnel) solo en espalda y hombros, humo sutil detrás y sombra suave en el suelo. Las luces y el humo
// van con la cámara: se mantienen al girar.
import * as THREE from "../vendor/three/three.module.min.js";
import { DRACOLoader } from "../vendor/three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";

import { cinematica, resolver } from "./posturas.js";

const MODELO = new URL("./maniqui.glb", import.meta.url).href;
const DECODIFICADOR = new URL("../vendor/three/addons/libs/draco/", import.meta.url).href;

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
const GRIS_SUELA = 0x4a4a4a;
const NEGRO_PANTALON = 0x1a1a1a;

// El GLB se descarga una vez; cada escena lo descomprime y monta de nuevo (es pequeño).
const draco = new DRACOLoader().setDecoderPath(DECODIFICADOR);
let descarga = null;

async function cargarModelo() {
  descarga ??= fetch(MODELO).then((r) => {
    if (!r.ok) throw new Error(`${MODELO}: ${r.status}`);
    return r.arrayBuffer();
  }).catch((error) => {
    descarga = null; // se reintenta en la próxima ficha
    throw error;
  });
  const gltf = await new GLTFLoader().setDRACOLoader(draco).parseAsync(await descarga, "");
  return gltf.scene;
}

function token(nombre, porDefecto) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return valor || porDefecto;
}

// ---------- Acabado (shader) ----------
// Oclusión ambiental: cada junta es una esfera que oscurece lo que tiene cerca (oclusión
// analítica de esfera, Íñigo Quílez). Sin postproceso: cuesta unas líneas de shader.
const N_ESFERAS = 16;
const AO = { fuerza: 0.9, maximo: 0.55 };
// Borde rojo: Fresnel solo en las caras del tronco que miran a la espalda o arriba (hombros).
const HALO = { fuerza: 2.6, dureza: 3.0 };
// Líneas de unión: cortes de la piel con un plano, medidos en la postura de reposo (la posición
// del vértice antes de mover los huesos), así que siguen al cuerpo. Cada una solo dentro de su
// esfera, para no cortar lo que tiene al lado. `grosor`: media anchura en metros.
const LINEAS = { grosor: 0.0015, fuerza: 0.5 };
const N_LINEAS = 10;

const GLSL_COMUN = `
varying vec3 vMundo;
varying vec3 vReposo;
uniform vec4 planosLinea[${N_LINEAS}];
uniform vec4 zonasLinea[${N_LINEAS}];
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

function acabado(material, uniformes, { halo = false, lineas = false } = {}) {
  material.defines = { ...(halo && { CON_HALO: "" }), ...(lineas && { CON_LINEAS: "" }) };
  material.customProgramCacheKey = () => `maniqui-${halo}-${lineas}`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vMundo;\nvarying vec3 vReposo;")
      .replace("#include <project_vertex>", `#include <project_vertex>
      vMundo = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vReposo = position;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${GLSL_COMUN}`)
      .replace("#include <color_fragment>", `#include <color_fragment>
      #ifdef CON_LINEAS
      float linea = 0.0;
      for (int i = 0; i < ${N_LINEAS}; i++) {
        vec3 dz = vReposo - zonasLinea[i].xyz;
        if (dot(dz, dz) > zonasLinea[i].w * zonasLinea[i].w) continue;
        float d = abs(dot(vReposo, planosLinea[i].xyz) - planosLinea[i].w);
        float borde = fwidth(d) * 1.5;
        linea = max(linea, 1.0 - smoothstep(${LINEAS.grosor}, ${LINEAS.grosor} + borde, d));
      }
      diffuseColor.rgb *= 1.0 - ${LINEAS.fuerza.toFixed(2)} * linea;
      #endif`)
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

export async function crearEscena(lienzo, datos) {
  const esqueleto = datos.esqueleto;
  const modelo = await cargarModelo();
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
    planosLinea: { value: Array.from({ length: N_LINEAS }, () => new THREE.Vector4()) },
    zonasLinea: { value: Array.from({ length: N_LINEAS }, () => new THREE.Vector4(0, -10, 0, 0)) },
  };
  // Pantalón y botas por las dos caras: por el bajo y la caña se ve el interior.
  const satinado = (color, roughness = 0.45, side = THREE.FrontSide) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, side });
  const materiales = {
    piel: acabado(satinado(0xebe8e3), uniformes, { lineas: true }),
    espalda: acabado(satinado(0xebe8e3), uniformes, { halo: true, lineas: true }),
    guante: acabado(satinado(GRIS_GUANTE, 0.42), uniformes),
    munequera: acabado(satinado(GRIS_MUNEQUERA, 0.8), uniformes),
    bota: acabado(satinado(GRIS_GUANTE, 0.5, THREE.DoubleSide), uniformes),
    suela: acabado(satinado(GRIS_SUELA, 0.7), uniformes),
    pantalon: acabado(satinado(NEGRO_PANTALON, 0.85, THREE.DoubleSide), uniformes),
    cinturilla: acabado(satinado(rojoHalo, 0.6, THREE.DoubleSide), uniformes),
  };
  const rojo = new THREE.MeshStandardMaterial({ color: acento, roughness: 0.5, emissive: acento, emissiveIntensity: 0.35 });

  // ---------- Maniquí ----------
  // Cada material del GLB por el suyo, según el nombre que le pone crear_maniqui.py.
  const porNombre = { ...materiales, rojo };
  modelo.traverse((o) => {
    if (!o.isMesh) return;
    o.material = porNombre[o.material.name] ?? materiales.piel;
    o.castShadow = true;
    o.frustumCulled = false; // la caja de la malla es la del reposo, no la de la postura
  });
  escena.add(modelo);
  modelo.updateMatrixWorld(true);

  // Huesos de padres a hijos, con su giro en el mundo en el reposo (todas las articulaciones
  // a cero) y la articulación que los mueve: la suya o la del antepasado más cercano.
  const articulacionDe = Object.fromEntries(Object.entries(esqueleto)
    .filter(([, a]) => a.hueso).map(([nombre, a]) => [a.hueso, nombre]));
  const huesos = [];
  modelo.traverse((o) => {
    if (!o.isBone) return;
    let h = o;
    while (h?.isBone && !(h.name in articulacionDe)) h = h.parent;
    huesos.push({ hueso: o, articulacion: h?.isBone ? articulacionDe[h.name] : null,
      reposo: o.getWorldQuaternion(new THREE.Quaternion()) });
  });
  const raiz = huesos.find((h) => h.articulacion === "pelvis").hueso;
  const giros = new Map(); // hueso → giro en el mundo de la postura actual

  // Líneas de unión, con las articulaciones en el reposo (en coordenadas de la malla).
  const malla = modelo.getObjectByProperty("isSkinnedMesh", true);
  const aMalla = malla.matrixWorld.clone().invert();
  const reposo = cinematica(esqueleto, resolver(esqueleto, { pos: raiz.getWorldPosition(new THREE.Vector3()).toArray() }));
  const enReposo = (articulacion, [x, y, z] = [0, 0, 0]) =>
    new THREE.Vector3(...reposo[articulacion].pos).add(new THREE.Vector3(x, y, z));
  // La cintura, algo por encima de la cinturilla del pantalón, en el centro del tronco.
  const cintura = enReposo("columna", [0, reposo.cadera_izq.pos[1] - reposo.columna.pos[1] + 0.16, 0.05]);
  const lineas = [
    // [punto, normal del plano, centro de su zona, radio de la zona]
    [enReposo("cuello", [0, 0.03, 0]), [0, 1, 0], enReposo("cuello", [0, 0.03, 0]), 0.07],
    [cintura, [0, 1, 0], cintura, 0.17],
    ...[1, -1].flatMap((s) => {
      const l = s > 0 ? "izq" : "der";
      return [
        [enReposo(`hombro_${l}`, [s * 0.01, -0.015, 0]), [s, -0.6, 0], enReposo(`hombro_${l}`), 0.11],
        [enReposo(`codo_${l}`, [0, 0.03, 0]), [0, 1, 0], enReposo(`codo_${l}`, [0, 0.03, 0]), 0.065],
        [enReposo(`muneca_${l}`, [0, 0.115, 0]), [0, 1, 0], enReposo(`muneca_${l}`, [0, 0.115, 0]), 0.055],
        [enReposo(`rodilla_${l}`, [0, 0.035, 0]), [0, 1, 0], enReposo(`rodilla_${l}`, [0, 0.035, 0]), 0.08],
      ];
    }),
  ];
  lineas.forEach(([punto, normal, centro, radio], i) => {
    const plano = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(...normal).normalize(), punto)
      .applyMatrix4(aMalla);
    uniformes.planosLinea.value[i].set(plano.normal.x, plano.normal.y, plano.normal.z, -plano.constant);
    const c = centro.clone().applyMatrix4(aMalla);
    uniformes.zonasLinea.value[i].set(c.x, c.y, c.z, radio);
  });

  // ---------- Colocar una postura ----------
  const v = (p) => new THREE.Vector3(...p);
  const q = (r) => new THREE.Quaternion(...r);
  const padreGiro = new THREE.Quaternion();

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
    // Giro en el mundo de cada hueso = el de su articulación × el suyo en el reposo; el local
    // sale de quitarle el del padre.
    for (const { hueso, articulacion, reposo } of huesos) {
      const giro = articulacion ? q(mundo[articulacion].rot).multiply(reposo) : reposo;
      giros.set(hueso, giro);
      const padre = giros.get(hueso.parent) ?? hueso.parent.getWorldQuaternion(padreGiro);
      hueso.quaternion.copy(padre).invert().multiply(giro);
    }
    raiz.position.copy(raiz.parent.worldToLocal(v(mundo.pelvis.pos)));
    modelo.updateMatrixWorld(true);

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
      modelo.traverse((o) => o.geometry?.dispose());
      renderer.dispose();
    },
  };
}
