// Pestaña Historial: resumen y gráfico semanal, lista de sesiones, detalle con valoración
// (editable), borrado y copia de seguridad (exportar / importar).
import { ErrorAlmacen } from "../almacen.js";
import { $, anunciar, esc, fechaLarga, hoyIso, minutos } from "./dom.js";
import { activarGrafico, graficoSemanas } from "./grafico.js";
import { SENSACION } from "./opciones.js";
import { porSemana, totales } from "./resumen.js";

export function iniciarHistorial({ almacen, historial, valoracion }) {
  const raiz = $("#historial-contenido");

  async function lista() {
    let sesiones;
    try {
      sesiones = await historial.listar();
    } catch {
      raiz.innerHTML = `<p class="aviso">No se pudo leer el historial del servidor.</p>`;
      return;
    }
    const v = almacen.datos.valoraciones;
    const t = totales(sesiones);
    const semanas = porSemana(sesiones, v);
    raiz.innerHTML = `
      <section class="tarjeta" aria-labelledby="t-resumen">
        <h2 id="t-resumen">Resumen</h2>
        <dl class="cifras">
          ${[["Esta semana", t.semana], ["Este mes", t.mes]].map(([titulo, x]) => `<div><dt>${titulo}</dt><dd>
            <span><strong>${x.sesiones}</strong> ${x.sesiones === 1 ? "sesión" : "sesiones"}</span>
            <span><strong>${x.asaltos}</strong> ${x.asaltos === 1 ? "asalto" : "asaltos"}</span></dd></div>`).join("")}
        </dl>
        ${graficoSemanas(semanas)}
      </section>

      <section class="tarjeta" aria-labelledby="t-sesiones">
        <h2 id="t-sesiones">Sesiones</h2>
        ${sesiones.length ? `<ul class="lista-sesiones">${sesiones.map((s) => fila(s, v[s.clave])).join("")}</ul>`
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
      </section>`;
    activarGrafico(raiz, semanas);
    $("#exportar").addEventListener("click", exportar);
    $("#importar").addEventListener("change", importar);
  }

  function fila(s, v) {
    const esfuerzo = v?.rpe != null ? `RPE ${v.rpe}` : "Sin valorar";
    return `<li><a href="#historial/${encodeURIComponent(s.clave)}">
      <span class="fecha">${esc(fechaLarga(s.fecha))}</span>
      <span class="detalle">Nivel ${s.nivel} · ${s.asaltos} ${s.asaltos === 1 ? "asalto" : "asaltos"} · ${esfuerzo}</span>
    </a></li>`;
  }

  async function detalle(clave) {
    const sesiones = await historial.listar().catch(() => []);
    const s = sesiones.find((x) => x.clave === clave);
    if (!s) {
      raiz.innerHTML = `<p class="aviso">Esa sesión no existe.</p><p><a href="#historial">Volver al historial</a></p>`;
      return;
    }
    const combinaciones = s.combinaciones ?? await historial.combinaciones(s.id);
    const v = almacen.valoracion(clave);
    const costosas = new Set(v?.costosas ?? []);
    const asaltos = [...new Set(combinaciones.map((c) => c.asalto))];
    const dato = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
    raiz.innerHTML = `
      <p><a href="#historial" class="volver">← Historial</a></p>
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
      if (await valoracion.abrir({ clave, combinaciones, titulo: "Valoración de la sesión" })) detalle(clave);
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
      lista();
    } catch (error) {
      alert(error instanceof ErrorAlmacen ? error.message : `No se pudo importar: ${error.message}`);
    }
  }

  return {
    mostrar(parametro) {
      if (parametro) detalle(parametro);
      else lista();
    },
  };
}
