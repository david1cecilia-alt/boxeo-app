// Pestaña Historial: resumen y gráfico, las sesiones como una galería de fotos (Semana → Día →
// sesión, Mes → Semana, Año → Mes; lógica en galeria.js), detalle con valoración (editable),
// borrado y copia de seguridad (exportar / importar).
// La vista va en la ruta (#historial/semana/…, /dia/…, /mes/…, /ano/…, /<clave>): bajar de nivel
// añade una entrada al historial del navegador y las flechas o el selector la sustituyen, así el
// gesto atrás sube un nivel. En PC la galería y el detalle van en dos columnas; en móvil el CSS
// muestra solo la galería o, si hay una sesión elegida, solo su detalle.
import { ErrorAlmacen } from "../almacen.js";
import { datos } from "../motor/datos.js";
import { $, aFecha, anunciar, diaCorto, esc, fechaLarga, hoyIso, minutos } from "./dom.js";
import {
  alCambiarDeNivel, diaDeLaVista, diasDeSemana, escribirRuta, leerRuta, mesesDelAno, rutaDeArriba, rutaDelDia,
  semanaDeLaVista, semanasDelMes, vecinos,
} from "./galeria.js";
import { activarGrafico, graficoSemanas } from "./grafico.js";
import { SENSACION } from "./opciones.js";
import { AGRUPACIONES, inicioPeriodo, lunes, minutosDeAsalto, porPeriodo, textoMinutos, tituloGrupo, totales } from "./resumen.js";

const MES = new Intl.DateTimeFormat("es-ES", { month: "short" });
const MES_LARGO = new Intl.DateTimeFormat("es-ES", { month: "long" });
const DIA_SEMANA = new Intl.DateTimeFormat("es-ES", { weekday: "short" });
const DIA_LARGO = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const mesYAno = (d) => `${MES_LARGO.format(d)} ${d.getFullYear()}`; // "octubre 2026", sin el "de"
const mayuscula = (t) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
const fmt = (n) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const plural = (n, una, varias) => `${n} ${n === 1 ? una : varias}`;
const NOMBRE_NIVEL = { semana: "Semana", mes: "Mes", ano: "Año" };
const FLECHAS = {
  semana: ["Semana anterior", "Semana siguiente"], mes: ["Mes anterior", "Mes siguiente"], ano: ["Año anterior", "Año siguiente"],
};
const ICONO = {
  anterior: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  siguiente: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
};

// «Miércoles 28 de octubre» (con el año si no es el actual).
function diaLargo(fecha, hoy = new Date()) {
  const ano = fecha.getFullYear() === hoy.getFullYear() ? "" : ` de ${fecha.getFullYear()}`;
  return mayuscula(DIA_LARGO.format(fecha).replace(",", "")) + ano;
}
const resumenSesiones = (lista) =>
  (lista.length ? `${plural(lista.length, "sesión", "sesiones")} · ${textoMinutos(minutosDeAsalto(lista))}` : "sin sesiones");

// Nombre del preset con el que se hizo la sesión (por su asalto y descanso), o "Personalizado".
function nombrePreset(s) {
  const p = datos().presets.presets.find((x) => x.duracion_asalto === s.duracion_asalto && x.descanso === s.descanso);
  return p?.nombre ?? "Personalizado";
}

export function iniciarHistorial({ almacen, historial, valoracion }) {
  const raiz = $("#historial-contenido");
  const mesActual = mesYAno(new Date());
  $("#antetitulo-historial").textContent = mesActual;
  let ruta = "";            // la que se ve (#historial/<ruta>)
  let rutaPrevia = null;    // la anterior en el historial del navegador, si era del Historial
  let reemplazando = false;
  let focoPendiente = null; // qué enfocar al repintar tras una flecha o el selector
  let sesiones = [];
  let vista = null;

  // Bajar de nivel añade una entrada; las flechas y el selector la sustituyen.
  function navegar(destino, { reemplazar = false } = {}) {
    const hash = destino ? `#historial/${destino}` : "#historial";
    if (location.hash === hash) {
      pintar({ enfocar: true });
    } else if (reemplazar) {
      reemplazando = true;
      location.replace(hash);
    } else {
      location.hash = hash;
    }
  }

  // «Volver»: si lo de arriba es lo anterior en el navegador, se vuelve atrás (no se apila).
  function subir() {
    const arriba = rutaDeArriba(vista, sesiones);
    if (arriba === null) return;
    if (arriba === rutaPrevia) history.back();
    else navegar(arriba);
  }

  async function pintar({ enfocar = false } = {}) {
    try {
      sesiones = await historial.listar();
    } catch {
      raiz.innerHTML = `<p class="aviso">No se pudo leer el historial del servidor.</p>`;
      return;
    }
    const v = almacen.datos.valoraciones;
    const { mes } = totales(sesiones, v);
    const series = Object.fromEntries(AGRUPACIONES.map((e) => [e, porPeriodo(sesiones, v, e)]));
    vista = leerRuta(ruta, nivelElegido());
    const clave = vista.nivel === "sesion" ? vista.clave : "";
    raiz.classList.toggle("con-detalle", Boolean(clave));
    raiz.innerHTML = `
      <div class="resumen-historial">
        <h2 class="solo-lectores">Resumen de ${esc(mesActual)}</h2>
        <dl class="cifras">
          <div class="destacada"><dt>sesiones / mes</dt><dd>${mes.sesiones}</dd></div>
          <div><dt>asaltos / mes</dt><dd>${mes.asaltos}</dd></div>
          <div><dt>RPE medio</dt><dd>${mes.rpe == null ? "–" : `${fmt(mes.rpe)}<small>/10</small>`}</dd></div>
        </dl>
        ${graficoSemanas(series)}
      </div>

      <div class="maestro-detalle">
      <div class="col-lista">
      ${galeria(v)}

      <section class="tarjeta copia" aria-labelledby="t-copia">
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
        <p class="nota vacio">Elige una sesión para ver su detalle.</p>
      </div>
      </div>`;
    activarGrafico(raiz, series);
    activarGaleria();
    $("#exportar").addEventListener("click", exportar);
    $("#importar").addEventListener("change", importar);
    if (clave) {
      await detalle(sesiones.find((x) => x.clave === clave), clave);
    } else if (enfocar) {
      const foco = (focoPendiente && raiz.querySelector(focoPendiente)) || (raiz.querySelector("#t-dia") ?? raiz.querySelector("#t-periodo"));
      (foco?.disabled ? raiz.querySelector("#t-periodo") : foco)?.focus();
    }
    focoPendiente = null;
  }

  function nivelElegido() {
    const elegido = almacen.datos.perfil.historial?.agrupar;
    return AGRUPACIONES.includes(elegido) ? elegido : "semana";
  }

  // El periodo que se pinta: el de la ruta; en un día o un detalle, su semana.
  function periodoVisible() {
    const semana = semanaDeLaVista(vista, sesiones);
    if (semana) return { nivel: "semana", inicio: semana };
    if (vista.nivel === "sesion") return { nivel: "semana", inicio: lunes(new Date()) }; // la sesión no existe
    return vista;
  }

  function galeria(v) {
    const { nivel, inicio } = periodoVisible();
    const { anterior, siguiente } = vecinos(sesiones, nivel, inicio);
    const delPeriodo = sesiones.filter((s) => inicioPeriodo(aFecha(s.fecha), nivel).getTime() === inicio.getTime());
    const dia = diaDeLaVista(vista, sesiones);
    const flecha = (id, destino, etiqueta) => `<button type="button" class="flecha" data-ir="${id}"
      ${destino ? `data-ruta="${escribirRuta(nivel, destino)}"` : "disabled"} aria-label="${etiqueta}">${ICONO[id]}</button>`;
    const celdas = { semana: celdasSemana, mes: celdasMes, ano: celdasAno }[nivel];
    return `
      <section class="sesiones galeria" aria-labelledby="t-sesiones">
        <div class="cabeza-sesiones">
          <h2 id="t-sesiones">Sesiones</h2>
          <div class="selector" role="group" aria-label="Ver las sesiones por">
            ${AGRUPACIONES.map((a) => `<button type="button" data-nivel="${a}" aria-pressed="${a === nivel}">${NOMBRE_NIVEL[a]}</button>`).join("")}
          </div>
        </div>
        <div class="periodo">
          ${flecha("anterior", anterior, FLECHAS[nivel][0])}
          <div class="titulo-periodo">
            <h3 id="t-periodo" tabindex="-1">${esc(tituloGrupo(inicio, nivel))}</h3>
            <p>${resumenSesiones(delPeriodo)}</p>
          </div>
          ${flecha("siguiente", siguiente, FLECHAS[nivel][1])}
        </div>
        ${celdas(inicio, dia)}
        ${dia ? diaAbierto(dia, v) : ""}
        ${sesiones.length ? "" : `<p class="nota">Aún no hay sesiones. Las que termines aparecerán aquí.</p>`}
        <p class="nota">Guardado ${esc(historial.descripcion)}. Las valoraciones y notas, en este navegador.</p>
      </section>`;
  }

  // Los 7 días: con sesiones, un enlace (a la lista del día o, si solo hay una, a su detalle).
  function celdasSemana(inicio, abierto) {
    return `<ol class="celdas dias">${diasDeSemana(sesiones, inicio).map((d) => {
      const elegido = abierto?.getTime() === d.fecha.getTime();
      const clases = ["celda", d.hoy ? "hoy" : "", elegido ? "elegida" : ""].filter(Boolean).join(" ");
      const visible = `<span class="dia-semana" aria-hidden="true">${esc(DIA_SEMANA.format(d.fecha).replace(".", ""))}</span>
        <b aria-hidden="true">${d.fecha.getDate()}</b>`;
      const nombre = `${diaLargo(d.fecha)}${d.hoy ? " (hoy)" : ""}`;
      const destino = rutaDelDia(d);
      if (!destino) {
        return `<li><span class="${clases} vacia">${visible}<span class="solo-lectores">${esc(nombre)}: sin sesiones</span></span></li>`;
      }
      const actual = elegido ? ' aria-current="true"' : d.hoy ? ' aria-current="date"' : "";
      const enlace = destino.includes(":") ? encodeURIComponent(destino) : destino;
      return `<li><a class="${clases}" href="#historial/${enlace}"${actual}>${visible}
        <span class="cuenta" aria-hidden="true">${d.sesiones.length}</span>
        <span class="solo-lectores">${esc(nombre)}: ${plural(d.sesiones.length, "sesión", "sesiones")}</span></a></li>`;
    }).join("")}</ol>`;
  }

  // Las semanas del mes con su resumen; con sesiones, un enlace a su vista de semana.
  function celdasMes(inicio) {
    return `<ol class="celdas filas">${semanasDelMes(sesiones, inicio).map((s) => {
      const clases = ["celda", s.actual ? "hoy" : "", s.sesiones.length ? "" : "vacia"].filter(Boolean).join(" ");
      const texto = `<b>${esc(`${diaCorto(s.inicio)} – ${diaCorto(s.fin)}`)}</b>
        <span>${s.actual ? "Esta semana · " : ""}${resumenSesiones(s.sesiones)}</span>`;
      return s.sesiones.length
        ? `<li><a class="${clases}" href="#historial/${escribirRuta("semana", s.inicio)}"${s.actual ? ' aria-current="date"' : ""}>${texto}</a></li>`
        : `<li><span class="${clases}">${texto}</span></li>`;
    }).join("")}</ol>`;
  }

  // Los 12 meses con su resumen; con sesiones, un enlace a su vista de mes.
  function celdasAno(inicio) {
    return `<ol class="celdas meses">${mesesDelAno(sesiones, inicio).map((m) => {
      const clases = ["celda", m.actual ? "hoy" : "", m.sesiones.length ? "" : "vacia"].filter(Boolean).join(" ");
      const resumen = m.sesiones.length
        ? `<span>${plural(m.sesiones.length, "sesión", "sesiones")}</span><span>${textoMinutos(m.minutos)}</span>`
        : "<span>sin sesiones</span>";
      const texto = `<b>${esc(mayuscula(MES_LARGO.format(m.inicio)))}</b>${resumen}`;
      return m.sesiones.length
        ? `<li><a class="${clases}" href="#historial/${escribirRuta("mes", m.inicio)}"${m.actual ? ' aria-current="date"' : ""}>${texto}</a></li>`
        : `<li><span class="${clases}">${texto}</span></li>`;
    }).join("")}</ol>`;
  }

  // Las sesiones del día abierto; en la vista de día, con «Volver a la semana».
  function diaAbierto(dia, v) {
    const delDia = diasDeSemana(sesiones, dia).find((d) => d.fecha.getTime() === dia.getTime())?.sesiones ?? [];
    const elegida = vista.nivel === "sesion" ? vista.clave : "";
    return `
      <section class="dia-abierto" aria-labelledby="t-dia">
        <div class="cabeza-dia">
          <h3 id="t-dia" tabindex="-1">${esc(diaLargo(dia))}</h3>
          ${vista.nivel === "dia" ? '<button type="button" class="volver" data-subir>← Volver a la semana</button>' : ""}
        </div>
        ${delDia.length ? `<ul class="lista-sesiones">${delDia.map((s) => fila(s, v[s.clave], elegida)).join("")}</ul>`
          : `<p class="nota">Este día no hay sesiones.</p>`}
      </section>`;
  }

  function activarGaleria() {
    for (const b of raiz.querySelectorAll("[data-nivel]")) {
      b.addEventListener("click", () => {
        if (b.getAttribute("aria-pressed") === "true") return;
        const perfil = structuredClone(almacen.datos.perfil);
        perfil.historial = { ...perfil.historial, agrupar: b.dataset.nivel };
        almacen.guardarPerfil(perfil);
        focoPendiente = `[data-nivel="${b.dataset.nivel}"]`;
        navegar(alCambiarDeNivel(periodoVisible(), b.dataset.nivel), { reemplazar: true });
        anunciar(`Sesiones por ${NOMBRE_NIVEL[b.dataset.nivel].toLowerCase()}`);
      });
    }
    for (const b of raiz.querySelectorAll(".periodo [data-ruta]")) {
      b.addEventListener("click", () => {
        focoPendiente = `[data-ir="${b.dataset.ir}"]`;
        navegar(b.dataset.ruta, { reemplazar: true });
      });
    }
    for (const b of raiz.querySelectorAll(".galeria [data-subir]")) b.addEventListener("click", subir);
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
    const alDia = rutaDeArriba(vista, sesiones)?.startsWith("dia/");
    panel.innerHTML = `
      <p class="volver-detalle"><button type="button" class="volver" data-subir>${alDia ? "← Volver al día" : "← Volver a la semana"}</button></p>
      <section class="tarjeta" aria-labelledby="t-detalle">
        <h2 id="t-detalle" tabindex="-1">${esc(fechaLarga(s.fecha))}</h2>
        <dl class="datos">
          ${dato("Nivel", s.nivel)}
          ${dato("Guardia", s.zurdo ? "Zurda" : "Ortodoxa")}
          ${dato("Asaltos completados", s.asaltos)}
          ${dato("Asalto / descanso", `${minutos(s.duracion_asalto)} / ${minutos(s.descanso)}`)}
          ${s.pausa != null ? dato("Pausa entre combos", `${s.pausa} s`) : ""}
          ${s.ritmo != null ? dato("Ritmo", `${s.ritmo} de 5`) : ""}
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
    panel.querySelector("[data-subir]").addEventListener("click", subir);
    $("#valorar").addEventListener("click", async () => {
      if (await valoracion.abrir({ clave, combinaciones, titulo: "Valoración de la sesión" })) pintar();
    });
    $("#borrar").addEventListener("click", async () => {
      if (!confirm("¿Borrar esta sesión y su valoración? No se puede deshacer.")) return;
      try {
        const arriba = rutaDeArriba(vista, sesiones);
        await historial.borrar(s.id);
        anunciar("Sesión borrada");
        navegar(arriba, { reemplazar: true }); // atrás ya no lleva a la sesión borrada
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
    // Al abrir el Historial (#historial) se ve siempre el periodo actual del nivel elegido.
    mostrar(parametro, { mismaVista = false } = {}) {
      if (!reemplazando) rutaPrevia = mismaVista ? ruta : null;
      reemplazando = false;
      ruta = parametro;
      pintar({ enfocar: mismaVista });
    },
  };
}
