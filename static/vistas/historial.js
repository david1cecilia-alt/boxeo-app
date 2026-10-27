// Pestaña Historial: resumen y gráfico semanal, lista de sesiones, detalle con valoración
// (editable), borrado y copia de seguridad (exportar / importar).
// Maestro-detalle: en PC la lista y el detalle van en dos columnas; en móvil el CSS muestra
// solo la lista o, si hay una sesión elegida (#historial/<clave>), solo su detalle.
import { ErrorAlmacen } from "../almacen.js";
import { datos } from "../motor/datos.js";
import { $, aFecha, anunciar, esc, fechaLarga, hoyIso, minutos } from "./dom.js";
import { activarGrafico, graficoSemanas } from "./grafico.js";
import { SENSACION } from "./opciones.js";
import { porSemana, totales } from "./resumen.js";

const MES = new Intl.DateTimeFormat("es-ES", { month: "short" });
const MES_LARGO = new Intl.DateTimeFormat("es-ES", { month: "long" });
const mesYAno = (d) => `${MES_LARGO.format(d)} ${d.getFullYear()}`; // "octubre 2026", sin el "de"
const fmt = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const plural = (n, una, varias) => `${n} ${n === 1 ? una : varias}`;

// Nombre del preset con el que se hizo la sesión (por su asalto y descanso), o "Personalizado".
function nombrePreset(s) {
  const p = datos().presets.presets.find((x) => x.duracion_asalto === s.duracion_asalto && x.descanso === s.descanso);
  return p?.nombre ?? "Personalizado";
}

export function iniciarHistorial({ almacen, historial, valoracion }) {
  const raiz = $("#historial-contenido");
  const mesActual = mesYAno(new Date());
  $("#antetitulo-historial").textContent = mesActual;

  async function pintar(clave = "") {
    let sesiones;
    try {
      sesiones = await historial.listar();
    } catch {
      raiz.innerHTML = `<p class="aviso">No se pudo leer el historial del servidor.</p>`;
      return;
    }
    const v = almacen.datos.valoraciones;
    const { mes } = totales(sesiones, v);
    const semanas = porSemana(sesiones, v);
    raiz.classList.toggle("con-detalle", Boolean(clave));
    raiz.innerHTML = `
      <section class="resumen-historial" aria-label="Resumen de ${esc(mesActual)}">
        <dl class="cifras">
          <div class="destacada"><dt>sesiones / mes</dt><dd>${mes.sesiones}</dd></div>
          <div><dt>asaltos / mes</dt><dd>${mes.asaltos}</dd></div>
          <div><dt>RPE medio</dt><dd>${mes.rpe == null ? "–" : `${fmt(mes.rpe)}<small>/10</small>`}</dd></div>
        </dl>
        ${graficoSemanas(semanas)}
      </section>

      <div class="maestro-detalle">
      <div class="col-lista">
      <section class="sesiones" aria-labelledby="t-sesiones">
        <h2 id="t-sesiones">Sesiones</h2>
        ${sesiones.length ? `<ul class="lista-sesiones">${sesiones.map((s) => fila(s, v[s.clave], clave)).join("")}</ul>`
          : `<p class="nota">Aún no hay sesiones. Las que termines aparecerán aquí.</p>`}
        <p class="nota">Guardado ${esc(historial.descripcion)}. Las valoraciones y notas, en este navegador.</p>
      </section>

      <section class="tarjeta" aria-labelledby="t-copia">
        <h2 id="t-copia">Copia de seguridad</h2>
        <p class="nota">Tus valoraciones, notas y perfil viven en este navegador: si borras sus datos, se pierden.
          Exporta una copia de vez en cuando.</p>
        <div class="acciones">
          <button type="button" id="exportar" class="boton secundario">Exportar mis datos</button>
          <label class="boton secundario" for="importar">Importar copia…</label>
          <input type="file" id="importar" accept="application/json,.json" class="solo-lectores">
        </div>
      </section>
      </div>
      <div class="col-detalle" id="historial-detalle">
        <p class="nota vacio">Elige una sesión de la lista para ver su detalle.</p>
      </div>
      </div>`;
    activarGrafico(raiz, semanas);
    $("#exportar").addEventListener("click", exportar);
    $("#importar").addEventListener("change", importar);
    if (clave) await detalle(sesiones.find((x) => x.clave === clave), clave);
  }

  // Bloque de fecha, preset y nivel, asaltos y combinaciones, y una pastilla con el RPE.
  function fila(s, v, elegida) {
    const fecha = aFecha(s.fecha);
    const actual = s.clave === elegida ? ' aria-current="true"' : "";
    const detalle = [plural(s.asaltos, "asalto", "asaltos"), plural(s.num_combinaciones ?? 0, "combinación", "combinaciones"),
      s.modo_reaccion ? "reacción" : ""].filter(Boolean).join(" · ");
    const rpe = v?.rpe != null ? `<span class="rpe">RPE ${v.rpe}</span>`
      : `<span class="rpe sin-valorar">RPE <span aria-hidden="true">–</span><span class="solo-lectores">sin valorar</span></span>`;
    return `<li><a href="#historial/${encodeURIComponent(s.clave)}"${actual}>
      <span class="bloque-fecha" aria-hidden="true"><b>${fecha.getDate()}</b>${esc(MES.format(fecha).replace(".", ""))}</span>
      <span class="texto-sesion">
        <span class="solo-lectores">${esc(fechaLarga(s.fecha))}:</span>
        <span class="titulo-sesion">${esc(nombrePreset(s))} · nivel ${s.nivel}</span>
        <span class="detalle">${esc(detalle)}</span>
      </span>
      ${rpe}
    </a></li>`;
  }

  async function detalle(s, clave) {
    const panel = $("#historial-detalle");
    if (!s) {
      panel.innerHTML = `<p class="aviso">Esa sesión no existe.</p><p><a href="#historial">Volver al historial</a></p>`;
      return;
    }
    const combinaciones = s.combinaciones ?? await historial.combinaciones(s.id);
    const v = almacen.valoracion(clave);
    const costosas = new Set(v?.costosas ?? []);
    const asaltos = [...new Set(combinaciones.map((c) => c.asalto))];
    const dato = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
    panel.innerHTML = `
      <p class="volver-movil"><a href="#historial" class="volver">← Historial</a></p>
      <section class="tarjeta" aria-labelledby="t-detalle">
        <h2 id="t-detalle" tabindex="-1">${esc(fechaLarga(s.fecha))}</h2>
        <dl class="datos">
          ${dato("Nivel", s.nivel)}
          ${dato("Guardia", s.zurdo ? "Zurda" : "Ortodoxa")}
          ${dato("Asaltos completados", s.asaltos)}
          ${dato("Asalto / descanso", `${minutos(s.duracion_asalto)} / ${minutos(s.descanso)}`)}
          ${s.pausa != null ? dato("Pausa entre combos", `${s.pausa} s`) : ""}
          ${s.modo_reaccion != null ? dato("Modo reacción", s.modo_reaccion ? "Sí" : "No") : ""}
        </dl>
      </section>

      <section class="tarjeta" aria-labelledby="t-valoracion">
        <h2 id="t-valoracion">Mi valoración</h2>
        ${v ? `<dl class="datos">
            ${dato("Esfuerzo (RPE)", v.rpe ?? "—")}
            ${dato("Cómo me he sentido", v.sensacion ? `${v.sensacion} · ${SENSACION[v.sensacion - 1]}` : "—")}
            ${dato("Salió bien", esc(v.bien) || "—")}
            ${dato("A corregir", esc(v.corregir) || "—")}
          </dl>` : `<p class="nota">Sin valorar todavía.</p>`}
        <div class="acciones">
          <button type="button" id="valorar" class="boton secundario">${v ? "Editar valoración" : "Valorar sesión"}</button>
        </div>
      </section>

      <section class="tarjeta" aria-labelledby="t-combos">
        <h2 id="t-combos">Combinaciones dictadas (${combinaciones.length})</h2>
        ${asaltos.map((a) => `<h3>Asalto ${a}</h3><ol class="combos">
          ${combinaciones.map((c, i) => c.asalto !== a ? "" : `<li>${esc(c.texto)}${costosas.has(i)
            ? ' <span class="etiqueta">Me ha costado</span>' : ""}</li>`).join("")}</ol>`).join("")
          || `<p class="nota">No se dictó ninguna combinación.</p>`}
      </section>

      <div class="acciones">
        <button type="button" id="borrar" class="boton peligro">Borrar sesión</button>
      </div>`;
    $("#t-detalle").focus();
    $("#valorar").addEventListener("click", async () => {
      if (await valoracion.abrir({ clave, combinaciones, titulo: "Valoración de la sesión" })) pintar(clave);
    });
    $("#borrar").addEventListener("click", async () => {
      if (!confirm("¿Borrar esta sesión y su valoración? No se puede deshacer.")) return;
      try {
        await historial.borrar(s.id);
        anunciar("Sesión borrada");
        location.hash = "#historial";
      } catch (e) {
        alert(e.message);
      }
    });
  }

  async function exportar() {
    let servidor = null;
    try {
      servidor = await historial.copia();
    } catch { /* sin servidor: solo el almacén */ }
    const copia = almacen.exportar(servidor);
    const blob = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
    const enlace = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob), download: `boxeo-copia-${hoyIso()}.json`,
    });
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
    anunciar("Copia exportada");
  }

  async function importar(e) {
    const fichero = e.target.files[0];
    e.target.value = "";
    if (!fichero) return;
    let copia;
    try {
      copia = JSON.parse(await fichero.text());
    } catch {
      alert("El fichero no es un JSON válido.");
      return;
    }
    const aviso = historial.origen === "servidor"
      ? "\n\nLas sesiones del servidor (SQLite) no se tocan: solo se sustituyen las valoraciones, el perfil y las notas."
      : "";
    if (!confirm(`Importar sustituye TODOS tus datos de este navegador por los de la copia.${aviso}\n\n¿Seguir?`)) return;
    try {
      const guardado = almacen.importar(copia);
      anunciar(guardado ? "Copia importada" : "Copia importada solo en memoria");
      pintar();
    } catch (error) {
      alert(error instanceof ErrorAlmacen ? error.message : `No se pudo importar: ${error.message}`);
    }
  }

  return {
    mostrar(parametro) {
      pintar(parametro);
    },
  };
}
