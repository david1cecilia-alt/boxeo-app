// El avatar y la identidad (nombre, avatar y foto, ver identidadPorDefecto en almacen.js).
// - crearAvatar(): el elemento que lo enseña en la cabecera de Entrenar, en Perfil y en Ajustes: la foto
//   propia o el predefinido como <img>, o la inicial del nombre (sin nombre, una silueta).
// - iniciarIdentidad(): el bloque «Nombre y avatar» de la sección Ajustes del menú (hueco #identidad).
// La foto es un data URL del usuario: se pinta siempre con img.src, nunca con innerHTML.
import { MAX_NOMBRE, nombreValido } from "../almacen.js";
import { ErrorFoto, TEXTOS_FOTO, prepararFoto } from "../foto.js";
import { datos } from "../motor/datos.js";
import { $, esc } from "./dom.js";

export const SIN_NOMBRE = "Tu perfil"; // lo que se lee sin nombre
export const ALT_FOTO = "Tu foto de perfil";
const SILUETA = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';

// Los avatares predefinidos de data/avatares.json: [{ id, archivo, alt }].
export const avatares = () => datos().avatares.avatares;

// La primera letra del nombre, en mayúscula, sin partir un emoji ni una letra con tilde compuesta ("" sin nombre).
export function inicial(nombre) {
  const texto = nombreValido(nombre);
  if (!texto) return "";
  const primera = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("es", { granularity: "grapheme" }).segment(texto)[Symbol.iterator]().next().value.segment
    : [...texto][0];
  return primera.toLocaleUpperCase("es-ES");
}

export const nombreVisible = (identidad) => identidad.nombre || SIN_NOMBRE;

/**
 * El elemento que enseña el avatar elegido. `decorativo`: true si al lado ya se lee quién es (alt="");
 * si no, la foto lleva ALT_FOTO y el predefinido su alt del JSON. La inicial es siempre decorativa.
 * `avatar`: para enseñar otro que el elegido (las opciones de Ajustes).
 */
export function crearAvatar(identidad, { decorativo = false, avatar = identidad.avatar, clase = "" } = {}) {
  const predefinido = avatar.tipo === "predefinido" && avatares().find((a) => a.id === avatar.id);
  const foto = avatar.tipo === "foto" && identidad.foto;
  if (foto || predefinido) {
    const img = document.createElement("img");
    img.className = `avatar ${clase}`.trim();
    img.src = foto || predefinido.archivo;
    img.alt = decorativo ? "" : foto ? ALT_FOTO : predefinido.alt;
    img.width = img.height = 256;
    img.decoding = "async";
    return img;
  }
  const span = document.createElement("span");
  span.className = `avatar avatar-inicial ${clase}`.trim();
  span.setAttribute("aria-hidden", "true");
  const letra = inicial(identidad.nombre);
  if (letra) span.textContent = letra;
  else span.innerHTML = SILUETA;
  return span;
}

/**
 * «Nombre y avatar» en Ajustes. `pintar(contenedor)` lo dibuja en el hueco #identidad; cada cambio se guarda
 * al momento y llama a `alGuardar()` (Ajustes dice «Guardado» y Entrenar repinta la cabecera).
 * Elegir otro avatar no borra la foto: solo «Quitar foto» la borra.
 */
export function iniciarIdentidad({ almacen, alGuardar, preparar = prepararFoto }) {
  let raiz = null;
  const identidad = () => almacen.datos.perfil.identidad;

  function guardar(cambio) {
    const p = structuredClone(almacen.datos.perfil);
    p.identidad = { ...p.identidad, ...cambio };
    almacen.guardarPerfil(p);
    alGuardar();
  }

  function mensaje(texto, error = false) {
    const p = $("#mensaje-foto", raiz);
    p.textContent = texto;
    p.classList.toggle("aviso", error);
  }

  // Una opción de avatar: el radio y su imagen. Su nombre es el alt del predefinido o, si se da, `texto`
  // («Inicial», «Tu foto»), y entonces la imagen es decorativa.
  function opcion(valor, avatar, texto) {
    const label = document.createElement("label");
    label.className = "avatar-opcion";
    const input = Object.assign(document.createElement("input"), { type: "radio", name: "avatar", value: valor });
    const actual = identidad().avatar;
    input.checked = valor === (actual.tipo === "predefinido" ? `predefinido:${actual.id}` : actual.tipo);
    label.append(input, crearAvatar(identidad(), { avatar, decorativo: Boolean(texto) }));
    if (texto) label.append(Object.assign(document.createElement("span"), { className: "solo-lectores", textContent: texto }));
    return label;
  }

  function pintar(contenedor = raiz) {
    if (contenedor !== raiz) {
      // Ajustes rehace su formulario (y el hueco) al repintarse: los eventos van en el hueco nuevo.
      contenedor.addEventListener("change", alCambiar);
      contenedor.addEventListener("click", alPulsar);
    }
    raiz = contenedor;
    const { nombre, foto } = identidad();
    raiz.hidden = false;
    raiz.className = "identidad";
    raiz.innerHTML = `
      <h3 class="titulo-campo">Nombre y avatar</h3>
      <label class="campo">Nombre
        <input type="text" id="nombre" name="nombre" maxlength="${MAX_NOMBRE}" autocomplete="nickname"
          placeholder="${SIN_NOMBRE}" value="${esc(nombre)}" aria-describedby="nombre-nota">
      </label>
      <p class="nota" id="nombre-nota">Sale en la cabecera de Entrenar y en tu perfil. Como mucho ${MAX_NOMBRE} caracteres.</p>
      <fieldset class="avatares">
        <legend>Avatar</legend>
        <div class="avatares-fila"></div>
      </fieldset>
      <div class="acciones identidad-foto">
        <label class="boton secundario" for="subir-foto">Subir una foto…</label>
        <input type="file" id="subir-foto" accept="image/*" class="solo-lectores" aria-describedby="mensaje-foto">
        ${foto ? '<button type="button" id="quitar-foto" class="boton secundario">Quitar foto</button>' : ""}
      </div>
      <p class="nota" id="mensaje-foto" aria-live="polite"></p>`;
    const fila = $(".avatares-fila", raiz);
    fila.append(opcion("inicial", { tipo: "inicial" }, "Inicial"));
    for (const a of avatares()) fila.append(opcion(`predefinido:${a.id}`, { tipo: "predefinido", id: a.id }));
    if (foto) fila.append(opcion("foto", { tipo: "foto" }, "Tu foto"));
  }

  async function subir(input) {
    const [archivo] = input.files;
    input.value = ""; // para poder volver a elegir la misma
    if (!archivo) return;
    mensaje("Preparando la foto…");
    let foto;
    try {
      foto = await preparar(archivo);
    } catch (e) {
      mensaje(e instanceof ErrorFoto ? e.message : TEXTOS_FOTO.ilegible, true);
      return;
    }
    guardar({ foto, avatar: { tipo: "foto" } });
    pintar();
    mensaje("Foto guardada. Ya es tu avatar.");
    $('input[name="avatar"][value="foto"]', raiz).focus();
  }

  function alCambiar(e) {
    const el = e.target;
    if (el.id === "nombre") {
      el.value = nombreValido(el.value);
      guardar({ nombre: el.value });
      // La inicial de la primera opción (y de la cabecera) sigue al nombre.
      const nueva = crearAvatar(identidad(), { avatar: { tipo: "inicial" } });
      $(".avatar-opcion .avatar-inicial", raiz)?.replaceWith(nueva);
    } else if (el.name === "avatar") {
      const [tipo, id] = el.value.split(":");
      guardar({ avatar: id ? { tipo, id } : { tipo } });
    } else if (el.id === "subir-foto") {
      subir(el);
    }
  }

  function alPulsar(e) {
    if (!e.target.closest("#quitar-foto")) return;
    const { avatar } = identidad();
    guardar({ foto: null, avatar: avatar.tipo === "foto" ? { tipo: "inicial" } : avatar });
    pintar();
    mensaje("Foto quitada.");
    $("#subir-foto", raiz).focus();
  }

  return { pintar };
}
