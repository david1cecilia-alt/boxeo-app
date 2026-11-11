"""Espera a que el menú lateral de Entrenar esté abierto y quieto, para las pruebas de navegador.

El panel entra deslizándose (transform, 220 ms en estilos.css). Un clic o una medida durante esa entrada
cae donde el panel aún no está. Quieto = el <dialog> abierto con «visible», sin arrastre, sin
transiciones vivas en el panel y con su transform ya en su sitio (none). Sin esperas fijas: con
prefers-reduced-motion no hay transición y se cumple al momento.
"""

MENU_QUIETO = """() => {
  const menu = document.getElementById('menu');
  const panel = menu?.querySelector('.menu-panel');
  return !!panel && menu.open && menu.classList.contains('visible') && !menu.classList.contains('arrastrando')
    && panel.getAnimations().length === 0 && getComputedStyle(panel).transform === 'none';
}"""


def esperar_menu_quieto(pagina):
    pagina.wait_for_function(MENU_QUIETO)
