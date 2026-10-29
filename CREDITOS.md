# Créditos

## Fotos de fondo
Generadas con IA por David (autor del proyecto) para esta app. En el repo solo están las WebP de
`static/imagenes/`; los PNG originales (`static/imagenes/originales/`, fuera de git) se convierten
con `herramientas/convertir_imagenes.py`.

| Fichero | Dónde va |
|---|---|
| `entrenar-cabecera` | Cabecera de Entrenar |
| `aprende-hero` | Cabecera de Aprende |
| `cat-golpes`, `cat-defensas`, `cat-pies`, `cat-estrategia` | Carrusel de categorías de Aprende |
| `historial-cabecera` | Cabecera de Historial |
| `perfil-cabecera` | Cabecera de Perfil |

## Fuentes
Anton e Inter, con licencia SIL Open Font License 1.1 (`static/fuentes/OFL-*.txt`), tomadas de Fontsource.

## Maniquí 3D
Personaje base: Quaternius, Universal Base Characters (CC0).
`static/maniqui/maniqui.glb` sale de `herramientas/blender/crear_maniqui_quaternius.py` a partir del
hombre Superhero del kit (licencia **CC0 1.0**, dominio público; el glTF original no va en el repo).
Guantes, botas, pantalón y puntos rojos los añade el script, con las piezas de `crear_maniqui.py`.

`herramientas/blender/crear_maniqui.py` sigue sirviendo para el maniquí anterior, hecho con MPFB
2.0.18 (MakeHuman para Blender): su malla base, targets y esqueleto «game engine» son **CC0 1.0** y
el código de MPFB (GPL-3.0) solo se usa en Blender para generarlo.

## Bibliotecas
Three.js r170, con licencia MIT (`static/vendor/three/LICENSE`), y sus módulos `GLTFLoader`,
`DRACOLoader` y `BufferGeometryUtils` (`static/vendor/three/addons/`, MIT).
El decodificador Draco de Google (`static/vendor/three/addons/libs/draco/`), con licencia
Apache 2.0 (`static/vendor/three/addons/libs/draco/LICENSE`).
