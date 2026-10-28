# Notas pendientes

## Maniquí 3D (rama `wip-maniqui-blender`)

- [ ] Revisar la hoja `docs/referencias/hoja-maniqui-glb.png` (reposo; guardia, jab_salida y
      jab_impacto en frente real, 3/4 delantero, lado, espalda y cenital; recortes de cabeza y
      guantes). No se versiona: `python herramientas/hoja_maniqui.py`. Las posturas siguen
      `REVISAR CON ENTRENADOR`.
- [ ] REVISAR CON ENTRENADOR — guardia: guantes cerrados hacia el centro (a ±10 cm de la cara y
      1,5 cm bajo los pómulos) para tapar nariz y barbilla sin tocarse; los ojos se ven por encima.
- [ ] Cinturilla: en guardia, de espaldas, el borde de arriba hace un pequeño escalón (los pesos
      de la piel pasan de golpe de la pelvis a la columna). Suavizar los pesos solo del pantalón
      hace que asome la piel: habría que suavizar los dos.
- [ ] Vista inicial de la app (`tres_cuartos`, acimut 55°): con el tronco girado de la guardia
      enseña sobre todo la espalda. Valorar ponerla del lado de la mano trasera (≈ −40°).
- [ ] Instalar Blender 4.5 LTS + MPFB en otro PC para regenerar el maniquí:
  1. Blender 4.5 LTS: `winget install --id BlenderFoundation.Blender.LTS.4.5 --exact`
     (pide administrador) o, sin administrador, el ZIP portátil de
     `https://download.blender.org/release/Blender4.5/` (comprobar su `.sha256`) descomprimido
     en `%LOCALAPPDATA%\Programs\Blender-4.5`.
  2. MPFB desde extensions.blender.org:
     `blender --online-mode --command extension sync` y
     `blender --online-mode --command extension install mpfb --enable`.
  3. `blender --background --python herramientas\blender\crear_maniqui.py`
     (sin `--factory-startup`, que apaga MPFB; necesita `node` para recalcular las posturas).
     En este PC ya está en `%LOCALAPPDATA%\Programs\Blender-4.5` con MPFB.
