# 🔧 Solución: Library No Muestra Descargas

## ❌ Problema
- **14 archivos físicos** en carpeta downloads/
- **Library muestra "0 songs"**
- **autoScanDownloads NO se ejecuta** (bundle cacheado)

## ✅ Solución 1: Reinstalación Completa

### Paso 1: Eliminar App del Dispositivo
```
1. En tu dispositivo móvil:
   - Mantén presionada la app "Expo Go"
   - Selecciona "Eliminar App"
   - Confirma eliminación
```

### Paso 2: Limpiar Caches en Computadora
```bash
cd /Users/javierpizano/Desktop/qobuz-mobile-v2

# Limpiar todos los caches
rm -rf .expo
rm -rf node_modules/.cache
rm -rf /tmp/metro-* 2>/dev/null || true
rm -rf /tmp/haste-* 2>/dev/null || true
rm -rf /tmp/react-* 2>/dev/null || true

# Detener todos los procesos
pkill -9 "Expo Go"
pkill -9 "expo"
pkill -9 "node"
```

### Paso 3: Reinstalar Expo Go
```
1. En tu dispositivo:
   - Abre App Store / Play Store
   - Busca "Expo Go"
   - Instala la app nuevamente
```

### Paso 4: Iniciar con Bundle Limpio
```bash
# Iniciar Expo con cache completamente limpio
npx expo start --clear --dev --reset-cache
```

### Paso 5: Escanear QR de Nuevo
```
1. Abre Expo Go en el dispositivo
2. Escanea el código QR que aparece en la terminal
3. Espera a que cargue la app
```

### Paso 6: Verificar Logs
Deberías ver estos logs en la terminal:

```
✅ ESPERADO:
LOG  [AppNavigator] Descargas cargadas
LOG  [AppNavigator] 🔍 Iniciando escaneo automático de descargas...
LOG  [autoScanDownloads] 📁 Archivos encontrados en carpeta: 14
LOG  [autoScanDownloads] 🔍 Procesando archivo: Don Omar - Danza Kuduro.flac
LOG  [autoScanDownloads] 🔍 Procesando archivo: Tren Lokote - Track.mp3
... (más archivos)
LOG  [autoScanDownloads] ✅ Escaneo completado: 14 nuevos, 0 errores
LOG  [downloadSlice] ✅ Descargas guardadas: 14 tracks
LOG  [LibrarySlice] 📥 Descargas completadas encontradas: 14
LOG  [LibrarySlice] 📊 Total de tracks locales a procesar: 14
```

### Paso 7: Verificar Library
```
1. Navega a la pestaña "Library"
2. Ve a tab "Descargas"
3. Deberías ver los 14 tracks con:
   - Nombre de la canción
   - Artista
   - Duración
   - Calidad (FLAC/MP3)
```

---

## ✅ Solución 2: Sincronización Manual (Plan B)

Si la Solución 1 no funciona, usa el botón manual:

### Paso 1: Ir a Settings
```
1. Abre la app
2. Ve a pestaña "Settings"
3. Scroll hacia abajo
```

### Paso 2: Ejecutar Sync Manual
```
1. Busca el botón "Sincronizar Descargas"
2. Presiona el botón
3. Espera a que termine (verás un alert)
```

### Paso 3: Verificar
```
1. Ve a Library → Descargas
2. Deberías ver los 14 tracks
3. Si no aparecen, revisa los logs en la terminal
```

---

## 🔍 Checklist de Verificación

### ✅ Después de Reinstalar
- [ ] Log "Iniciando escaneo automático..." aparece
- [ ] Log "Archivos encontrados: 14" aparece  
- [ ] Log "Escaneo completado: 14 nuevos" aparece
- [ ] Library → Descargas muestra 14 tracks
- [ ] Puedes reproducir los tracks
- [ ] Albums muestra los álbumes de esos tracks
- [ ] Artists muestra Don Omar, Tren Lokote, etc.

### 🔄 Prueba de Persistencia
- [ ] Cierra la app completamente (swipe up)
- [ ] Reabre la app
- [ ] Library → Descargas sigue mostrando 14 tracks
- [ ] No necesita re-escanear (datos en AsyncStorage)

---

## 🏗️ Arquitectura (Para Entender Cómo Funciona)

### Flujo de Datos Completo

```
┌─────────────────────────────────────┐
│ 1. ARCHIVOS FÍSICOS                 │
│    /downloads/                      │
│    ├── Don Omar - Danza.flac        │
│    ├── Tren Lokote - Track.mp3      │
│    └── ... (14 archivos total)      │
└─────────────────────────────────────┘
              ↓
    autoScanDownloads() escanea
              ↓
┌─────────────────────────────────────┐
│ 2. BÚSQUEDA EN QOBUZ API            │
│    searchTracks("Don Omar Danza")   │
│    → Obtiene metadata completa      │
│    → ID, álbum, duración, etc.      │
└─────────────────────────────────────┘
              ↓
    addSyncedDownload(track, path)
              ↓
┌─────────────────────────────────────┐
│ 3. REDUX STATE (downloadSlice)      │
│    downloads: [                     │
│      {                              │
│        track: { id, title, artist },│
│        localPath: "downloads/...",  │
│        status: "completed",         │
│        quality: "FLAC"              │
│      },                             │
│      ... (14 items)                 │
│    ]                                │
└─────────────────────────────────────┘
              ↓
    saveDownloads() → AsyncStorage
              ↓
┌─────────────────────────────────────┐
│ 4. ASYNCSTORAGE (Persistencia)      │
│    Key: 'downloads'                 │
│    Value: JSON con 14 downloads     │
│    → Sobrevive al reinicio de app   │
└─────────────────────────────────────┘
              ↓
    En próximo inicio: loadDownloads()
              ↓
┌─────────────────────────────────────┐
│ 5. LIBRARY PROCESSING               │
│    processExistingDownloads()       │
│    ├── Lee downloadSlice.downloads  │
│    ├── Agrupa por álbum             │
│    └── Agrupa por artista           │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│ 6. UI (LibraryScreen)               │
│    Tab "Descargas"                  │
│    → Muestra los 14 tracks          │
│                                     │
│    Tab "Albums"                     │
│    → Muestra álbumes agrupados      │
│                                     │
│    Tab "Artists"                    │
│    → Muestra artistas agrupados     │
└─────────────────────────────────────┘
```

### ⚠️ Lo Que NO Funciona

```
❌ LibraryScreen NO lee archivos físicos directamente
❌ FileSystem API NO se usa en LibraryScreen
❌ La UI NO escanea la carpeta downloads/

✅ LibraryScreen SOLO lee: downloadSlice.downloads[]
✅ downloadSlice.downloads[] se puebla con: autoScanDownloads()
✅ autoScanDownloads() corre en: App.tsx al iniciar
```

---

## 🐛 Debug: Si Sigue Sin Funcionar

### Ver Estado de AsyncStorage
Agrega en Settings → Debug Section:

```typescript
const handleCheckAsyncStorage = async () => {
  const downloads = await AsyncStorage.getItem('downloads');
  const parsed = JSON.parse(downloads || '[]');
  console.log('📦 AsyncStorage downloads:', parsed.length, 'items');
  Alert.alert('AsyncStorage', `${parsed.length} downloads guardadas`);
};
```

### Ver Estado de Redux
```typescript
const handleCheckRedux = () => {
  const state = store.getState();
  console.log('📦 Redux downloads:', state.download.downloads.length);
  console.log('📦 Redux library albums:', state.library.albums.length);
  Alert.alert('Redux', `${state.download.downloads.length} downloads en memoria`);
};
```

### Forzar Re-escaneo
```typescript
const handleForceRescan = async () => {
  if (!authToken) {
    Alert.alert('Error', 'No hay token de autenticación');
    return;
  }
  
  const result = await dispatch(autoScanDownloads({ authToken }));
  if (result.payload) {
    const { syncedCount, errorCount } = result.payload;
    Alert.alert('Escaneo', `${syncedCount} nuevos, ${errorCount} errores`);
  }
};
```

---

## 📝 Resumen

**Problema:** Library muestra 0 descargas aunque hay 14 archivos físicos

**Causa Raíz:** autoScanDownloads() no se ejecuta (bundle JavaScript cacheado)

**Solución:** Reinstalación completa de Expo Go + cache limpio

**Verificación:** Log "Iniciando escaneo automático..." debe aparecer

**Plan B:** Botón manual "Sincronizar Descargas" en Settings
