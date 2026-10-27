// Escena 3D del maniquí (Three.js). Solo se carga con import() al abrir una ficha con
// postura: la app arranca sin Three.js.
// Maniquí de dibujo hecho por código: cápsulas y esferas blanco mate, articulaciones con
// punto rojo (--acento), guantes con venda. Luz principal blanca suave, contraluz roja desde
// atrás a la derecha (las luces van con la cámara: se mantienen al girar), niebla ligera y
// sombra suave en el suelo.
import * as THREE from "../vendor/three/three.module.min.js";

import { cinematica } from "./posturas.js";

// Algo por delante del cuerpo: así cabe el brazo estirado de los golpes en la vista de lado.
const OBJETIVO = new THREE.Vector3(0, 0.86, 0.16);
// Ángulos de cámara (grados): acimut 0 = de frente (desde +Z), 90 = de lado (desde +X).
export const VISTAS = {
  frente: { acimut: 0, elevacion: 6 },
  lado: { acimut: 90, elevacion: 6 },
  arriba: { acimut: 0, elevacion: 89 },
};

function token(nombre, porDefecto) {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  return valor || porDefecto;
}

// Segmentos del cuerpo: [desde, hasta, radio]. Los que no unen dos articulaciones
// (cabeza, guantes, pies, tronco) se crean aparte.
const HUESOS = [
  ["hombro_izq", "codo_izq", 0.05], ["codo_izq", "muneca_izq", 0.042],
  ["hombro_der", "codo_der", 0.05], ["codo_der", "muneca_der", 0.042],
  ["cadera_izq", "rodilla_izq", 0.062], ["rodilla_izq", "tobillo_izq", 0.048],
  ["cadera_der", "rodilla_der", 0.062], ["rodilla_der", "tobillo_der", 0.048],
];
// Articulaciones visibles: [nombre, radio, lado del punto rojo (+1 fuera izq, −1 fuera der)].
const ARTICULACIONES = [
  ["hombro_izq", 0.062, 1], ["codo_izq", 0.047, 1], ["muneca_izq", 0.036, 1],
  ["hombro_der", 0.062, -1], ["codo_der", 0.047, -1], ["muneca_der", 0.036, -1],
  ["cadera_izq", 0.065, 1], ["rodilla_izq", 0.052, 1], ["tobillo_izq", 0.04, 1],
  ["cadera_der", 0.065, -1], ["rodilla_der", 0.052, -1], ["tobillo_der", 0.04, -1],
  ["cuello", 0.045, 0], ["columna", 0.07, 0],
];

// Halo rojo: borde de luz roja (fresnel) en el contorno del lado de la contraluz (derecha de
// la pantalla) que recorta espalda, hombros y cabeza. Se mezcla después del tone mapping: antes,
// ACES lleva el rojo intenso a blanco y el borde sale rosa.
const HALO = { fuerza: 1.8, dureza: 2.0 };

function conHalo(material, color) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.colorHalo = { value: color };
    shader.fragmentShader = `uniform vec3 colorHalo;\n${shader.fragmentShader}`
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      float halo = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), ${HALO.dureza.toFixed(1)})
        * smoothstep(-0.1, 0.7, normal.x);`)
      .replace("#include <tonemapping_fragment>", `#include <tonemapping_fragment>
      gl_FragColor.rgb = mix(gl_FragColor.rgb, colorHalo, clamp(halo * ${HALO.fuerza.toFixed(1)}, 0.0, 1.0));`);
  };
  return material;
}

export function crearEscena(lienzo, datos) {
  const esqueleto = datos.esqueleto;
  const fondo = new THREE.Color(token("--fondo", "#0b0b0b"));
  const acento = new THREE.Color(token("--acento", "#ff3b30"));

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
  escena.add(new THREE.HemisphereLight(0xffffff, fondo, 0.35));
  const principal = new THREE.DirectionalLight(0xffffff, 2.2);
  principal.position.set(-2.5, 3.2, 1.5); // delante, arriba a la izquierda
  camara.add(principal);
  const contraluz = new THREE.DirectionalLight(acento, 30);
  contraluz.position.set(2.6, 1.4, -6); // detrás del maniquí, a la derecha: tiñe el lado en sombra
  camara.add(contraluz);
  const relleno = new THREE.DirectionalLight(0xffffff, 0.25);
  relleno.position.set(2, 0.5, 2);
  camara.add(relleno);
  // Los objetivos de las luces van al maniquí aunque las luces sigan a la cámara.
  for (const luz of [principal, contraluz, relleno]) {
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

  // ---------- Maniquí ----------
  const blanco = conHalo(new THREE.MeshStandardMaterial({ color: 0xece8e3, roughness: 0.82, metalness: 0 }), acento);
  const venda = conHalo(new THREE.MeshStandardMaterial({ color: 0xd2cdc6, roughness: 0.95, metalness: 0 }), acento);
  const rojo = new THREE.MeshStandardMaterial({ color: acento, roughness: 0.6, emissive: acento, emissiveIntensity: 0.35 });
  const maniqui = new THREE.Group();
  escena.add(maniqui);

  const malla = (geometria, material = blanco) => {
    const m = new THREE.Mesh(geometria, material);
    m.castShadow = true;
    maniqui.add(m);
    return m;
  };

  // Cápsula unitaria (alto 1 entre centros) que se estira entre dos puntos.
  const huesos = HUESOS.map(([a, b, radio]) => ({
    a, b, malla: malla(new THREE.CapsuleGeometry(radio, 1, 6, 16)), radio,
  }));

  const articulaciones = ARTICULACIONES.map(([nombre, radio, lado]) => {
    const grupo = new THREE.Group();
    const esfera = new THREE.Mesh(new THREE.SphereGeometry(radio, 24, 16), blanco);
    esfera.castShadow = true;
    grupo.add(esfera);
    const punto = new THREE.Mesh(new THREE.SphereGeometry(radio * 0.22, 12, 8), rojo);
    punto.position.set(lado * radio * 0.92, 0, lado === 0 ? radio * 0.92 : 0);
    grupo.add(punto);
    maniqui.add(grupo);
    return { nombre, grupo };
  });

  // Tronco en segmentos: pelvis, abdomen y pecho, con su orientación.
  const pelvis = malla(new THREE.CapsuleGeometry(0.1, 0.1, 6, 20));
  pelvis.scale.set(1.3, 1, 0.85);
  const abdomen = malla(new THREE.CapsuleGeometry(0.095, 0.1, 6, 20));
  abdomen.scale.set(1.15, 1, 0.8);
  const pecho = malla(new THREE.CapsuleGeometry(0.12, 0.12, 6, 20));
  pecho.scale.set(1.42, 1, 0.78);
  const cuello = malla(new THREE.CylinderGeometry(0.042, 0.05, 1, 16));
  const cabeza = malla(new THREE.SphereGeometry(0.1, 32, 24));
  cabeza.scale.set(0.84, 1.08, 0.94);
  const mandibula = malla(new THREE.SphereGeometry(0.062, 24, 16));
  mandibula.scale.set(1, 0.9, 1.05);

  const guantes = ["izq", "der"].map((lado) => {
    const guante = malla(new THREE.SphereGeometry(0.082, 28, 20));
    guante.scale.set(0.95, 1.2, 1.05);
    const pulgar = malla(new THREE.CapsuleGeometry(0.022, 0.05, 4, 10));
    const vendaje = malla(new THREE.CylinderGeometry(0.052, 0.056, 0.095, 20), venda);
    return { lado, guante, pulgar, vendaje };
  });
  const pies = ["izq", "der"].map((lado) => {
    const pie = malla(new THREE.CapsuleGeometry(0.042, 0.16, 6, 14));
    pie.scale.set(1.15, 1, 0.8);
    return { lado, pie };
  });

  // ---------- Colocar una postura ----------
  const v = (p) => new THREE.Vector3(...p);
  const q = (r) => new THREE.Quaternion(...r);
  const arriba = new THREE.Vector3(0, 1, 0);

  function estirar(m, desde, hasta) {
    const eje = new THREE.Vector3().subVectors(hasta, desde);
    m.position.copy(desde).addScaledVector(eje, 0.5);
    m.quaternion.setFromUnitVectors(arriba, eje.clone().normalize());
    m.scale.set(1, eje.length(), 1);
  }

  // Coloca una pieza en el marco de una articulación con un desplazamiento local.
  function enMarco(m, marco, desplazamiento = [0, 0, 0], giroLocal = null) {
    const rot = q(marco.rot);
    m.position.copy(v(marco.pos)).add(v(desplazamiento).applyQuaternion(rot));
    m.quaternion.copy(giroLocal ? rot.multiply(giroLocal) : rot);
  }

  function mostrar(resuelta) {
    const mundo = cinematica(esqueleto, resuelta);
    for (const h of huesos) {
      const desde = v(mundo[h.a].pos);
      const hasta = v(mundo[h.b].pos);
      const eje = new THREE.Vector3().subVectors(hasta, desde);
      // La cápsula ya mide 2·radio más: se acorta para que no tape las articulaciones.
      const largo = Math.max(0.01, eje.length() - 2 * h.radio);
      h.malla.position.copy(desde).addScaledVector(eje, 0.5);
      h.malla.quaternion.setFromUnitVectors(arriba, eje.normalize());
      h.malla.scale.set(1, largo, 1);
    }
    for (const a of articulaciones) enMarco(a.grupo, mundo[a.nombre]);

    enMarco(pelvis, mundo.pelvis, [0, -0.02, 0]);
    enMarco(abdomen, mundo.columna, [0, 0.1, 0.005]);
    enMarco(pecho, mundo.pecho, [0, 0.1, 0]);
    estirar(cuello, v(mundo.cuello.pos), v(mundo.cabeza.pos).add(new THREE.Vector3(0, 0.03, 0).applyQuaternion(q(mundo.cabeza.rot))));
    enMarco(cabeza, mundo.cabeza, [0, 0.12, 0.005]);
    enMarco(mandibula, mundo.cabeza, [0, 0.06, 0.035]);

    for (const g of guantes) {
      const s = g.lado === "izq" ? 1 : -1;
      const marco = mundo[`puno_${g.lado}`];
      enMarco(g.guante, marco, [0, 0.0, 0.015]);
      enMarco(g.pulgar, marco, [-s * 0.064, 0.03, 0.035],
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0, s * 0.35)));
      enMarco(g.vendaje, mundo[`muneca_${g.lado}`], [0, -0.035, 0]);
    }
    for (const p of pies) {
      const marco = mundo[`tobillo_${p.lado}`];
      // El pie va del tobillo a la punta, tumbado hacia +Z local.
      enMarco(p.pie, marco, [0, -0.045, 0.075], new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)));
    }
  }

  // ---------- Cámara ----------
  const orbita = { acimut: VISTAS.frente.acimut, elevacion: VISTAS.frente.elevacion, distancia: 3.9 };

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
    orbita.distancia = camara.aspect < 0.6 ? 4.8 : 3.9;
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
      renderer.dispose();
    },
  };
}
