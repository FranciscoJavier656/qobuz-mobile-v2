# 🎯 Plan de Integración del Reproductor Nativo

## ✅ COMPLETADO

1. ✅ Módulo nativo Swift creado (RNEqualizer.swift)
2. ✅ Bridge Objective-C creado (RNEqualizer.m)
3. ✅ AudioPlayerService.ts wrapper JavaScript creado
4. ✅ Bridging header configurado
5. ✅ Archivos listos en /ios/

## 🔄 EN PROCESO (Tú estás aquí)

### Paso Actual: Agregar archivos nativos a Xcode

**En Xcode (que acabas de abrir):**

1. Busca la carpeta amarilla **"qobuzmobilev2"** en el navegador izquierdo
2. **Clic derecho** → "Add Files to qobuzmobilev2..."
3. Navega a: `/Users/javierpizano/Desktop/qobuz-mobile-v2/ios/`
4. Selecciona **AMBOS**:
   - RNEqualizer.swift
   - RNEqualizer.m
5. Marca:
   - ✅ "Copy items if needed"
   - ✅ "Add to targets: qobuzmobilev2"
6. Click **"Add"**

7. **Verificar Build Settings:**
   - Click en proyecto (ícono azul arriba)
   - Tab "Build Settings"
   - Buscar: "Objective-C Bridging Header"
   - Debe decir: `qobuzmobilev2/qobuzmobilev2-Bridging-Header.h`

## ⏳ SIGUIENTE (Después del rebuild)

Una vez agregados los archivos y hecho el rebuild:

### 1. Verificar que el módulo nativo funciona

```bash
npx expo run:ios
```

Buscar en logs:
```
✅ [RNEqualizer] ✅ Audio engine configurado con 10 bandas
✅ [AudioPlayerService] ✅ Módulo nativo cargado
```

### 2. Actualizar PlayerContext

Reemplazar expo-av con AudioPlayerService:

**Cambios principales:**
- ❌ `import { Audio } from 'expo-av'`
- ✅ `import AudioPlayerService from '../services/AudioPlayerService'`
- ❌ `Audio.Sound.createAsync()`
- ✅ `await playerService.loadAsync(uri)`
- ✅ Integración automática del ecualizador

### 3. Probar reproducción

1. Abrir app
2. Ir a Library
3. Seleccionar un track
4. Verificar que reproduce
5. Abrir ecualizador
6. Cambiar preset Bass Boost
7. **¡ESCUCHAR LA DIFERENCIA!** 🎵

### 4. Probar todas las funcionalidades

- ✅ Play/Pause
- ✅ Siguiente/Anterior
- ✅ Seek (barra de progreso)
- ✅ Volumen
- ✅ Repeat modes (off/all/one)
- ✅ Shuffle
- ✅ **Ecualizador en tiempo real** ⭐

## 🎨 Ventajas del Nuevo Sistema

### Antes (expo-av):
```
JavaScript → expo-av → AVAudioSession
                       (sin control del EQ)
```

### Ahora (Nativo):
```
JavaScript → AudioPlayerService → RNEqualizer.swift
                                   ↓
                         AVAudioEngine + AVAudioUnitEQ
                                   ↓
                         AVAudioPlayerNode → Speaker
                                   ↑
                         🎛️ ECUALIZADOR INTEGRADO
```

## 🔧 Troubleshooting

### Si el módulo no se carga:

```bash
# Limpiar build
cd ios
rm -rf build Pods
pod install
cd ..

# Rebuild
npx expo run:ios
```

### Si Xcode da error de Swift:

1. Build Settings → Swift Language Version → Swift 5
2. Clean Build Folder (Cmd+Shift+K)
3. Rebuild

### Si el bridging header no se encuentra:

1. Build Settings → "Objective-C Bridging Header"
2. Establecer: `qobuzmobilev2/qobuzmobilev2-Bridging-Header.h`
3. Verificar que el archivo existe en esa ruta

## 📊 Logs Esperados

### Al inicializar:
```
[RNEqualizer] ✅ Audio engine configurado con 10 bandas
[AudioPlayerService] ✅ Módulo nativo cargado
[AudioPlayerService] ✅ Inicializado
[EqualizerService] ✅ Inicializado correctamente
[EqualizerService] 🎛️ Bandas configuradas: 10 (32Hz - 16kHz)
```

### Al cargar audio:
```
[RNEqualizer] 📂 Cargando: track.flac
[RNEqualizer] ✅ Audio cargado - Duración: 180.5s
[AudioPlayerService] ✅ Audio cargado: 180500 ms
```

### Al reproducir:
```
[RNEqualizer] ▶️ Reproduciendo
[AudioPlayerService] ▶️ Reproduciendo
```

### Al cambiar EQ:
```
[RNEqualizer] 🎛️ Banda 1 (55Hz) -> 20.0dB
[AudioPlayerService] 🎛️ Preset aplicado: 0.0dB, 20.0dB, 15.0dB...
```

## 🎯 Meta Final

**Ecualizador funcional en tiempo real que afecta el audio MIENTRAS se reproduce.**

El usuario podrá:
1. Reproducir cualquier track
2. Abrir ecualizador
3. Mover sliders o cambiar preset
4. **Escuchar cambios INMEDIATAMENTE** 🎵
5. Bass Boost realmente aumentará los bajos
6. Todos los presets tendrán efecto audible

---

**Estado actual:** Esperando que agregues archivos en Xcode...

Una vez hecho, ejecuta: `npx expo run:ios`
