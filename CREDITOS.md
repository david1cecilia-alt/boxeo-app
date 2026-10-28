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
`static/maniqui/maniqui.glb` sale de `herramientas/blender/crear_maniqui.py` con MPFB 2.0.18
(MakeHuman para Blender): la malla base, los targets (macros y forma del cuerpo) y el esqueleto
«game engine» de MakeHuman tienen licencia **CC0 1.0** (dominio público). El código de MPFB
(GPL-3.0) solo se usa en Blender para generarlo: no se distribuye con la app. Guantes, botas,
pantalón, cabeza y cuello de maniquí y puntos rojos los añade el script.

## Bibliotecas
Three.js r170, con licencia MIT (`static/vendor/three/LICENSE`), y sus módulos `GLTFLoader`,
`DRACOLoader` y `BufferGeometryUtils` (`static/vendor/three/addons/`, MIT).
El decodificador Draco de Google (`static/vendor/three/addons/libs/draco/`), con licencia
Apache 2.0 (`static/vendor/three/addons/libs/draco/LICENSE`).
