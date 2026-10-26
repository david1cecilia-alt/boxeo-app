// Pestaña Perfil: datos que rellena el usuario (solo en este navegador). Se guarda al
// cambiar cada campo. Los pesos sustituyen a los de data/perfil.json en el generador.
import { PESOS } from "../ajustes.js";
import { datos } from "../motor/datos.js";
import { $, $$, anunciar, esc, hoyIso } from "./dom.js";
import { BASICOS, ESTILO, PESOS_TEXTO, RANGO_PESO } from "./opciones.js";

const MEDIDAS = {
  altura_cm: ["Altura", "cm", 100, 230],
  peso_kg: ["Peso", "kg", 30, 200],
  alcance_cm: ["Alcance", "cm", 100, 250],
};

function selector(grupo, campo, { etiqueta, opciones }, actual) {
  return `<label class="campo">${etiqueta}
    <select data-grupo="${grupo}" data-campo="${campo}">
      ${opciones.map(([v, t]) => `<option value="${v}" ${String(actual) === v ? "selected" : ""}>${t}</option>`).join("")}
    </select></label>`;
}

export function iniciarPerfil({ almacen }) {
  const raiz = $("#perfil-contenido");
  let revisar = null; // data/revisar.json, cargado la primera vez

  // Copia del perfil para editar y guardar entero.
  const perfil = () => structuredClone(almacen.datos.perfil);
  function guardar(cambio) {
    const p = perfil();
    cambio(p);
    almacen.guardarPerfil(p);
    anunciar("Guardado");
    $("#guardado-perfil").textContent = almacen.persistente ? "Guardado" : "Guardado solo en memoria";
  }

  function pintar() {
    const p = almacen.datos.perfil;
    const pesos = p.pesos ?? datos().perfil.pesos;
    raiz.innerHTML = `
      <p class="nota">Todo lo de esta pestaña se guarda solo en este navegador. <span id="guardado-perfil" aria-hidden="true"></span></p>

      <form class="tarjeta formulario" id="f-basicos" aria-labelledby="t-basicos">
        <h2 id="t-basicos">Básicos</h2>
        ${Object.entries(BASICOS).map(([c, def]) => selector("basicos", c, def, p.basicos[c])).join("")}
        <label class="campo">Empecé a boxear
          <input type="date" data-grupo="basicos" data-campo="inicio" value="${esc(p.basicos.inicio ?? "")}" max="${hoyIso()}"></label>
        <div class="rejilla">
          ${Object.entries(MEDIDAS).map(([c, [etiqueta, unidad, min, max]]) => `
            <label class="campo">${etiqueta} (${unidad}, opcional)
              <input type="number" inputmode="decimal" min="${min}" max="${max}" step="0.5"
                data-grupo="basicos" data-campo="${c}" data-numero value="${p.basicos[c] ?? ""}"></label>`).join("")}
        </div>
      </form>

      <form class="tarjeta formulario" id="f-estilo" aria-labelledby="t-estilo">
        <h2 id="t-estilo">Estilo</h2>
        ${Object.entries(ESTILO).map(([c, def]) => selector("estilo", c, def, p.estilo[c])).join("")}
      </form>

      <section class="tarjeta" aria-labelledby="t-focos">
        <h2 id="t-focos" tabindex="-1">Focos de trabajo</h2>
        ${p.focos.length ? `<ul class="lista-editable">${p.focos.map((f, i) => `
          <li><span>${esc(f)}</span>
            <button type="button" class="boton pequeno" data-quitar-foco="${i}" aria-label="Quitar foco: ${esc(f)}">Quitar</button></li>`).join("")}
          </ul>` : `<p class="nota">Aún no hay focos. Añade lo que quieras trabajar.</p>`}
        <form id="f-foco" class="en-linea">
          <label class="campo">Nuevo foco <input name="foco" maxlength="120" required
            placeholder="p. ej. lanzar 2–3 golpes en vez de 1–2"></label>
          <button type="submit" class="boton secundario">Añadir</button>
        </form>
      </section>

      <form class="tarjeta formulario" id="f-pesos" aria-labelledby="t-pesos">
        <h2 id="t-pesos" tabindex="-1">Ajustes del generador</h2>
        <p class="nota">Cambian cuántas veces sale cada tipo de combinación. 1 = neutro; más de 1, más a menudo;
          menos de 1, menos. ${p.pesos ? "Estás usando tus valores." : "Ahora mismo, los valores por defecto."}</p>
        ${PESOS.map((c) => `
          <div class="deslizador">
            <label for="peso-${c}">${PESOS_TEXTO[c].etiqueta}</label>
            <output for="peso-${c}" id="valor-${c}">×${pesos[c].toFixed(1)}</output>
            <input type="range" id="peso-${c}" data-peso="${c}" min="${RANGO_PESO.min}" max="${RANGO_PESO.max}"
              step="${RANGO_PESO.paso}" value="${pesos[c]}" aria-describedby="ayuda-${c}">
            <p class="nota" id="ayuda-${c}">${PESOS_TEXTO[c].ayuda}</p>
          </div>`).join("")}
        <button type="button" id="pesos-defecto" class="boton secundario" ${p.pesos ? "" : "disabled"}>
          Volver a los valores por defecto</button>
      </form>

      <section class="tarjeta" aria-labelledby="t-notas">
        <h2 id="t-notas" tabindex="-1">Notas del entrenador</h2>
        <form id="f-nota" class="formulario">
          <label class="campo">Fecha <input type="date" name="fecha" value="${hoyIso()}" required></label>
          <label class="campo">Nota <textarea name="texto" rows="3" maxlength="1000" required></textarea></label>
          <button type="submit" class="boton secundario">Añadir nota</button>
        </form>
        <ul class="lista-editable notas">${almacen.datos.notas_entrenador.map((n) => `
          <li><div><time datetime="${esc(n.fecha)}">${esc(n.fecha)}</time><p>${esc(n.texto)}</p></div>
            <button type="button" class="boton pequeno" data-borrar-nota="${esc(n.id)}" aria-label="Borrar nota del ${esc(n.fecha)}">Borrar</button></li>`).join("")}
        </ul>
      </section>

      <section class="tarjeta" aria-labelledby="t-revisar">
        <h2 id="t-revisar">Revisar con el entrenador</h2>
        <p class="nota">Puntos del motor marcados como dudosos. Lo que apuntes aquí es solo para ti: no cambia el motor.</p>
        <div id="lista-revisar"><p class="nota">Cargando…</p></div>
      </section>`;
    conectar();
    pintarRevisar();
  }

  function conectar() {
    // Selects, fecha y medidas: se guardan al cambiar.
    for (const el of $$("[data-grupo]", raiz)) {
      el.addEventListener("change", () => {
        if (el.dataset.numero !== undefined && el.value !== "" && !el.checkValidity()) {
          el.reportValidity();
          return;
        }
        guardar((p) => {
          const valor = el.dataset.numero !== undefined ? (el.value === "" ? null : Number(el.value))
            : el.type === "date" ? (el.value || null) : el.value;
          p[el.dataset.grupo][el.dataset.campo] = valor;
        });
      });
    }

    $("#f-foco").addEventListener("submit", (e) => {
      e.preventDefault();
      const texto = e.target.foco.value.trim();
      if (!texto) return;
      guardar((p) => p.focos.push(texto));
      pintar();
      $("#f-foco input").focus();
    });
    for (const b of $$("[data-quitar-foco]", raiz)) {
      b.addEventListener("click", () => {
        guardar((p) => p.focos.splice(Number(b.dataset.quitarFoco), 1));
        pintar();
        $("#t-focos").focus();
      });
    }

    for (const r of $$("[data-peso]", raiz)) {
      r.addEventListener("input", () => ($(`#valor-${r.dataset.peso}`).textContent = `×${Number(r.value).toFixed(1)}`));
      r.addEventListener("change", () => {
        guardar((p) => (p.pesos = Object.fromEntries(PESOS.map((c) => [c, Number($(`#peso-${c}`).value)]))));
        $("#pesos-defecto").disabled = false;
      });
    }
    $("#pesos-defecto").addEventListener("click", () => {
      guardar((p) => (p.pesos = null));
      pintar();
      $("#t-pesos").focus();
    });

    $("#f-nota").addEventListener("submit", (e) => {
      e.preventDefault();
      const texto = e.target.texto.value.trim();
      if (!texto) return;
      almacen.anadirNotaEntrenador(texto, e.target.fecha.value);
      anunciar("Nota añadida");
      pintar();
      $("#t-notas").focus();
    });
    for (const b of $$("[data-borrar-nota]", raiz)) {
      b.addEventListener("click", () => {
        if (!confirm("¿Borrar esta nota?")) return;
        almacen.borrarNotaEntrenador(b.dataset.borrarNota);
        anunciar("Nota borrada");
        pintar();
        $("#t-notas").focus();
      });
    }
  }

  async function pintarRevisar() {
    const contenedor = $("#lista-revisar");
    try {
      revisar ??= (await (await fetch("data/revisar.json")).json()).puntos;
    } catch {
      contenedor.innerHTML = `<p class="aviso">No se pudo cargar la lista de puntos.</p>`;
      return;
    }
    const respuestas = almacen.datos.revisiones;
    contenedor.innerHTML = `<ul class="lista-revisar">${revisar.map((r) => {
      const resp = respuestas[r.id] ?? { respuesta: "", confirmado: false };
      return `<li>
        <p class="punto">${esc(r.texto)} <span class="etiqueta ${resp.confirmado ? "ok" : ""}">${resp.confirmado ? "Confirmado" : "Pendiente"}</span></p>
        <p class="nota">En <code>${esc(r.origen)}</code>${resp.fecha ? ` · actualizado el ${esc(resp.fecha)}` : ""}</p>
        <label class="campo">Respuesta del entrenador
          <textarea rows="2" maxlength="500" data-revision="${esc(r.id)}">${esc(resp.respuesta)}</textarea></label>
        <label class="check"><input type="checkbox" data-confirmado="${esc(r.id)}" ${resp.confirmado ? "checked" : ""}>
          <span>Confirmado</span></label>
      </li>`;
    }).join("")}</ul>`;
    for (const r of revisar) {
      const guardarRevision = () => {
        almacen.guardarRevision(r.id, {
          respuesta: $(`[data-revision="${r.id}"]`).value.trim(),
          confirmado: $(`[data-confirmado="${r.id}"]`).checked,
        });
        anunciar("Guardado");
      };
      $(`[data-revision="${r.id}"]`).addEventListener("change", guardarRevision);
      $(`[data-confirmado="${r.id}"]`).addEventListener("change", async () => {
        guardarRevision();
        await pintarRevisar();
        $(`[data-confirmado="${r.id}"]`).focus(); // el repintado no debe perder el foco
      });
    }
  }

  return { mostrar: pintar };
}
