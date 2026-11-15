"""Ayuda común de las pruebas de navegador y las herramientas de capturas: abre la app sin la intro «Que
empiece el asalto» y sin la pista del asa, que taparían el primer clic (riesgo 8 del plan del rediseño).

`preparar(pagina)` mete un init script que corre al empezar cada documento:

- marca la intro como vista en `sessionStorage['boxeo.intro']` (como tras verla una vez en esta sesión);
- en la página que siembra el almacén (`__pagina__.html`), lo que se escriba en «boxeo» con versión 9 sale con
  `pistas.asa = true`. Los datos de versiones viejas no se tocan: la migración se prueba tal cual (y quien viene
  de ellas ve la pista, como en la app);
- en la app, si el almacén está vacío (sin «boxeo» ni la v0), escribe uno v9 mínimo con la pista vista;
  `completar()` rellena lo demás igual que con el almacén vacío.

Lo que guarda la propia app no se toca nunca (un v6 recién migrado sigue con `asa: false` aunque se recargue).
La app no lleva parámetros ni claves ocultas para esto: es lo mismo que haría un usuario que ya la ha visto.
`intro=True` deja la intro (para probarla) y `pista=True`, la pista.
"""
import json

CLAVE_INTRO = "boxeo.intro"
# Un almacén v9 vacío con la pista ya vista: lo justo para que las pruebas que leen sus listas no fallen.
VACIO_SIN_PISTA = {"version": 9, "sesiones": [], "valoraciones": {}, "combinacionesPropias": [],
                   "perfil": {"practicar": [], "pistas": {"asa": True}}}


def script(intro=False, pista=False):
    """El init script (texto JS) de `preparar`."""
    return f"""(() => {{
  if (!{json.dumps(intro)}) {{
    try {{ sessionStorage.setItem({json.dumps(CLAVE_INTRO)}, "vista"); }} catch {{ /* sin sessionStorage */ }}
  }}
  if ({json.dumps(pista)}) return;
  try {{
    if (location.pathname.endsWith("/__pagina__.html")) {{
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (clave, valor) {{
        if (this === localStorage && clave === "boxeo") {{
          try {{
            const datos = JSON.parse(valor);
            if (datos?.version === 9) {{
              datos.perfil = {{ ...datos.perfil, pistas: {{ ...datos.perfil?.pistas, asa: true }} }};
              valor = JSON.stringify(datos);
            }}
          }} catch {{ /* datos dañados a propósito: tal cual */ }}
        }}
        return original.call(this, clave, valor);
      }};
    }} else if (localStorage.getItem("boxeo") === null && localStorage.getItem("boxeo.historial") === null) {{
      localStorage.setItem("boxeo", {json.dumps(json.dumps(VACIO_SIN_PISTA))});
    }}
  }} catch {{ /* sin localStorage */ }}
}})();"""


def preparar(pagina, intro=False, pista=False):
    """Antes del primer `goto`: la página (o el contexto) abrirá la app sin intro ni pista."""
    pagina.add_init_script(script(intro, pista))
