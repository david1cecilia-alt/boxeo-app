# Notas pendientes

## Maniquí 3D (rama `wip-maniqui-blender`)

- [ ] Revisar la hoja de capturas `docs/referencias/hoja-maniqui-glb.png` (guardia, jab_salida y
      jab_impacto en 3/4, frente, lado y perfil puro, junto a `guardia.png`). No se versiona: se
      repinta con el sitio montado y la escena 3D. Las posturas siguen `REVISAR CON ENTRENADOR`.
- [ ] Bajo de la pernera trasera del pantalón: se abre un poco al echar la pierna atrás (se ve en
      la vista de lado).
- [ ] Línea de unión del cuello: llega a tocar la nuca de la cabeza lisa (zona de la línea en
      `static/maniqui/escena.js`).
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
