# Notas pendientes

## Maniquí 3D (rama `wip-maniqui-blender`)

- [ ] Revisar la hoja `docs/referencias/hoja-maniqui-glb.png` (reposo; guardia, jab_salida y
      jab_impacto en frente real, 3/4 delantero, lado, espalda y cenital; recortes de cabeza y
      guantes). No se versiona: `python herramientas/hoja_maniqui.py`. Las posturas siguen
      `REVISAR CON ENTRENADOR`.
- [ ] REVISAR CON ENTRENADOR — guardia: guantes cerrados hacia el centro (a ±10 cm de la cara y
      1,5 cm bajo los pómulos) para tapar nariz y barbilla sin tocarse; los ojos se ven por encima.
- [ ] REVISAR CON ENTRENADOR — guardia y jab: base más estrecha (tobillos a 40 cm, 0,92 × la
      anchura de los hombros: de frente, con el tronco girado, como los hombros), rodillas sobre la
      línea de la punta del pie (sin abrirse) y flexión menos profunda (pelvis 8,6 cm bajo el reposo).
      El test admite 0,9–1,1 × los hombros: más estrecho habría que cambiar ese margen.
- [ ] REVISAR CON ENTRENADOR — jab_impacto: cabeza recta (sin inclinarse de lado), barbilla baja
      (32°) y metida hacia el hombro adelantado, que sube (pecho girado 11° de lado) hasta quedar
      por encima de la mandíbula. Para llevar la barbilla al hombro el cuello se dobla 34° de lado:
      ver si es mucho. Vista desde el rival, la barbilla aún queda a ~8 cm del hombro.
- [ ] Cinturilla: en guardia, de espaldas, el borde de arriba hace un pequeño escalón (los pesos
      de la piel pasan de golpe de la pelvis a la columna). Suavizar los pesos solo del pantalón
      hace que asome la piel: habría que suavizar los dos.
- [ ] REVISAR CON ENTRENADOR — posturas rehechas para el esqueleto de Quaternius (rama
      `maniqui-quaternius`): pecho más alto y cuello más atrás que el de MPFB, así que columna 9°
      y pecho +6/+8° (antes 17° y −9°), cabeza 6° menos flexionada, pelvis a 0,897 m (misma
      flexión que antes: 8,6 cm bajo el reposo), tobillos a 40 cm (0,92 × los hombros) y guantes
      en la misma posición respecto a la cara. Brazos 6 cm más cortos: el jab llega menos lejos.
- [ ] Bajo del pantalón: al flexionar el muslo asoman unas marcas oscuras pequeñas en el borde.
- [ ] Instalar Blender 4.5 LTS en otro PC para regenerar el maniquí (MPFB solo para `crear_maniqui.py`):
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
