# Qobuz Mobile v2

Aplicación móvil multiplataforma para streaming y descarga de música de alta calidad desde Qobuz.

## 🚀 Características

- **Streaming de alta calidad**: Reproducción de música en calidad lossless FLAC
- **Descargas offline**: Guarda tus álbumes y playlists favoritos para escuchar sin conexión
- **Búsqueda avanzada**: Explora álbumes, artistas, playlists y tracks
- **Biblioteca local**: Sincronización automática con favoritos de Qobuz
- **Reproductor completo**: Auto-advance, repeat, shuffle y gestión de cola
- **Multiplataforma**: iOS 13+ y Android 24+

## 📱 Versiones Compiladas

### iOS (IPA)
- **Tamaño**: 9.6 MB
- **Ubicación**: `ios/build/qobuzmobilev2.ipa`
- **Instalación**: AltStore o sideload
- **Requisitos**: iOS 13.0 o superior

### Android (APK)
- **Tamaño**: 106 MB
- **Ubicación**: `android/app/build/outputs/apk/release/app-release.apk`
- **Arquitecturas**: arm64-v8a, armeabi-v7a, x86, x86_64
- **Requisitos**: Android 7.0 (API 24) o superior

## 🛠️ Tecnologías

- **Framework**: React Native + Expo SDK 54
- **Lenguaje**: TypeScript
- **Estado**: Redux Toolkit
- **Navegación**: React Navigation
- **Audio**: expo-av
- **Storage**: AsyncStorage + FileSystem

## 📦 Instalación para Desarrollo

### Prerrequisitos

- Node.js 18+
- npm o yarn
- Xcode 16+ (para iOS)
- Android Studio (para Android)
- Java 17 (para Android)

### Configuración

```bash
# Clonar repositorio
git clone https://github.com/Yagami072/qobuz-mobile-v2.git
cd qobuz-mobile-v2

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Qobuz
```

### Ejecutar en Desarrollo

```bash
# Iniciar Expo
npx expo start

# iOS
npx expo run:ios

# Android
npx expo run:android
```

## 🔨 Compilación

### iOS

```bash
# Generar proyecto nativo
npx expo prebuild --platform ios --clean

# Instalar pods
cd ios && pod install && cd ..

# Compilar con Xcode
xcodebuild -workspace ios/qobuzmobilev2.xcworkspace \
  -scheme qobuzmobilev2 \
  -configuration Release \
  archive -archivePath build/qobuz.xcarchive \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO

# Empaquetar IPA manualmente
cd ios/build
mkdir Payload
cp -r qobuz.xcarchive/Products/Applications/qobuzmobilev2.app Payload/
zip -r qobuzmobilev2.ipa Payload
```

### Android

```bash
# Generar proyecto nativo
npx expo prebuild --platform android --clean

# Compilar APK
cd android
export JAVA_HOME=/usr/local/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
./gradlew assembleRelease
```

El APK estará en: `android/app/build/outputs/apk/release/app-release.apk`

## 📝 Credenciales de Qobuz

La aplicación requiere credenciales de API de Qobuz. Configura las siguientes variables en tu archivo `.env`:

```env
QOBUZ_APP_ID=tu_app_id
QOBUZ_APP_SECRET=tu_app_secret
```

## 🔐 Instalación de Binarios

### iOS (AltStore)

1. Descarga e instala [AltStore](https://altstore.io/)
2. Conecta tu iPhone por USB
3. Abre AltStore en Mac/PC y selecciona "Install IPA"
4. Navega a `ios/build/qobuzmobilev2.ipa`
5. La app se instalará con certificado de 7 días

### Android

1. Habilita "Fuentes desconocidas" en ajustes
2. Transfiere el APK a tu dispositivo
3. Abre el APK y confirma instalación

## 📄 Estructura del Proyecto

```
qobuz-mobile-v2/
├── src/
│   ├── components/        # Componentes reutilizables
│   ├── contexts/          # Context providers
│   ├── hooks/             # Custom hooks
│   ├── screens/           # Pantallas de navegación
│   ├── services/          # API y servicios
│   ├── store/             # Redux store y slices
│   └── types/             # TypeScript types
├── android/               # Proyecto nativo Android
├── ios/                   # Proyecto nativo iOS
├── assets/                # Imágenes y recursos
└── app.json              # Configuración Expo
```

## 🐛 Problemas Conocidos

- **iOS**: Certificado de cuenta gratuita expira cada 7 días (requiere reinstalación)
- **Android**: APK no firmado para producción (solo debug keystore)
- **expo-av**: Warnings de deprecación (requiere migración futura)

## 📈 Próximas Mejoras

- [ ] Migrar de expo-av a audio API más moderna
- [ ] Implementar cache de imágenes mejorado
- [ ] Soporte para calidad de audio configurable
- [ ] Lyrics sincronizadas
- [ ] Ecualizador integrado
- [ ] Soporte para Chromecast/AirPlay

## 📜 Changelog

### v1.0.0-beta (1 Nov 2025)
- ✨ Compilaciones nativas iOS y Android
- ✨ Auto-advance en reproductor
- ✨ Descargas optimizadas con gestión de errores
- ✨ Biblioteca local sincronizada
- 🐛 Correcciones de reproducción en playlists/álbumes
- 🔧 Configuración iOS 13.0 deployment target
- 🔧 Desactivado NDK en Android para reducir tamaño

## 📄 Licencia

Este proyecto es de uso personal y educativo. Qobuz y sus APIs son propiedad de Qobuz SA.

## 👨‍💻 Autor

**Yagami072**
- GitHub: [@Yagami072](https://github.com/Yagami072)
- Repositorio: [qobuz-mobile-v2](https://github.com/Yagami072/qobuz-mobile-v2)

---

**Nota**: Esta aplicación requiere una suscripción activa de Qobuz para funcionar correctamente.
