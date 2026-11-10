// Arranque: carga los datos del motor y el almacén, decide de dónde salen las sesiones
// (servidor o este dispositivo) y monta las tres pestañas y Ajustes. Sin reglas de boxeo.

// rutas.js TIENE QUE SER LA PRIMERA IMPORTACIÓN: al cargarse redirige las rutas viejas de «Mis
// combinaciones» y registra su oyente de hashchange, que debe ir antes que el de vistas/ajustes.js
// (se registra al importarse) y el del creador (al iniciar Entrenar). Si no, verían la ruta vieja.
import { iniciarRutas } from "./rutas.js";
import { opcionesVoz } from "./ajustes.js";
import { claveSesion, crearAlmacen } from "./almacen.js";
import { crearHistorial } from "./historial.js";
import { cargarDatos } from "./motor/datos.js";
import { iniciarAjustes } from "./vistas/ajustes.js";
import { iniciarAprende } from "./vistas/aprende.js";
import { atajosEntrenar, iniciarEntrenar } from "./vistas/entrenar.js";
import { iniciarHistorial } from "./vistas/historial.js";
import { iniciarPerfil } from "./vistas/perfil.js";
import { crearValoracion } from "./vistas/postsesion.js";
import { crearVoz } from "./voz.js";

function avisar(texto) {
  const aviso = document.getElementById("aviso-almacen");
  aviso.textContent = texto;
  aviso.hidden = false;
}

async function arrancar() {
  // Primero los datos: migrar un almacén v8 necesita el nivel de la General (data/perfil.json).
  await cargarDatos();
  const almacen = crearAlmacen({ alFallar: avisar, alAvisar: avisar });
  const historial = await crearHistorial(almacen);
  const voz = crearVoz(opcionesVoz(almacen.datos.perfil));
  const valoracion = crearValoracion({ almacen });

  const entrenar = iniciarEntrenar({
    almacen, historial, voz,
    // Al terminar o parar: formulario post-sesión (se puede saltar y rellenar desde el historial).
    alTerminar: ({ id, combinaciones }) =>
      valoracion.abrir({ clave: claveSesion(historial.origen, id), combinaciones }),
  });
  atajosEntrenar();

  iniciarRutas({
    entrenar,
    aprende: iniciarAprende(),
    historial: iniciarHistorial({ almacen, historial, valoracion }),
    perfil: iniciarPerfil({ almacen }),
    ajustes: iniciarAjustes({ almacen, voz }),
  }, "entrenar");
}

arrancar().catch((e) => avisar(`Error al arrancar la app: ${e.message}`));

// Service worker (uso offline). En localhost no, para no servir ficheros viejos al desarrollar.
if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(location.hostname)) {
  navigator.serviceWorker.register("sw.js");
}
