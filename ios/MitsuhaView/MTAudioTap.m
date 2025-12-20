/**
 * MTAudioTap.m
 * Implementación de MTAudioProcessingTap para capturar audio real del AVPlayer
 * 
 * Este módulo:
 * 1. Se conecta al AVPlayerItem de expo-av
 * 2. Instala un MTAudioProcessingTap en el audio mix
 * 3. Procesa el audio con FFT usando vDSP (Accelerate framework)
 * 4. Envía los datos de frecuencia al visualizador
 */

#import "MTAudioTap.h"
#import <AudioToolbox/AudioToolbox.h>

// Contexto para los callbacks del tap
typedef struct {
    void *self;
    FFTSetup fftSetup;
    int bufferSize;
    int bufferSizeOver2;
    int log2n;
    float *window;
    float *realBuffer;
    float *imagBuffer;
    DSPSplitComplex splitComplex;
    float *magnitudes;
    float *smoothedMagnitudes;
    float smoothingFactor;
} AudioTapContext;

static MTAudioTap *sharedInstance = nil;

@implementation MTAudioTap {
    AVPlayerItem *_currentPlayerItem;
    MTAudioProcessingTapRef _audioTap;
    AudioTapContext *_tapContext;
}

#pragma mark - Singleton

+ (instancetype)sharedInstance {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[MTAudioTap alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _isAttached = NO;
        _tapContext = NULL;
        
        NSLog(@"[MTAudioTap] 🎵 Inicializado - Captura de audio real habilitada");
    }
    return self;
}

- (void)dealloc {
    [self detach];
}

#pragma mark - MTAudioProcessingTap Callbacks

static void tapInit(MTAudioProcessingTapRef tap, void *clientInfo, void **tapStorageOut) {
    NSLog(@"[MTAudioTap] ✅ Tap inicializado");
    
    // Crear contexto FFT
    AudioTapContext *context = (AudioTapContext *)malloc(sizeof(AudioTapContext));
    
    context->self = clientInfo;
    context->bufferSize = 1024;
    context->bufferSizeOver2 = context->bufferSize / 2;
    context->log2n = (int)log2(context->bufferSize);
    context->smoothingFactor = 0.3;
    
    // Crear FFT setup
    context->fftSetup = vDSP_create_fftsetup(context->log2n, kFFTRadix2);
    
    // Allocar buffers
    context->window = (float *)malloc(sizeof(float) * context->bufferSize);
    context->realBuffer = (float *)malloc(sizeof(float) * context->bufferSizeOver2);
    context->imagBuffer = (float *)malloc(sizeof(float) * context->bufferSizeOver2);
    context->magnitudes = (float *)malloc(sizeof(float) * context->bufferSizeOver2);
    context->smoothedMagnitudes = (float *)calloc(context->bufferSizeOver2, sizeof(float));
    
    context->splitComplex.realp = context->realBuffer;
    context->splitComplex.imagp = context->imagBuffer;
    
    // Crear ventana Hann
    vDSP_hann_window(context->window, context->bufferSize, vDSP_HANN_NORM);
    
    *tapStorageOut = context;
}

static void tapFinalize(MTAudioProcessingTapRef tap) {
    NSLog(@"[MTAudioTap] ⏹ Tap finalizado");
    
    AudioTapContext *context = (AudioTapContext *)MTAudioProcessingTapGetStorage(tap);
    if (context) {
        if (context->fftSetup) {
            vDSP_destroy_fftsetup(context->fftSetup);
        }
        free(context->window);
        free(context->realBuffer);
        free(context->imagBuffer);
        free(context->magnitudes);
        free(context->smoothedMagnitudes);
        free(context);
    }
}

static void tapPrepare(MTAudioProcessingTapRef tap,
                       CMItemCount maxFrames,
                       const AudioStreamBasicDescription *processingFormat) {
    NSLog(@"[MTAudioTap] 🎵 Tap preparado - Sample Rate: %.0f Hz, Channels: %d",
          processingFormat->mSampleRate,
          processingFormat->mChannelsPerFrame);
}

static void tapUnprepare(MTAudioProcessingTapRef tap) {
    NSLog(@"[MTAudioTap] 🎵 Tap desprepared");
}

static void tapProcess(MTAudioProcessingTapRef tap,
                       CMItemCount numberFrames,
                       MTAudioProcessingTapFlags flags,
                       AudioBufferList *bufferListInOut,
                       CMItemCount *numberFramesOut,
                       MTAudioProcessingTapFlags *flagsOut) {
    
    // Obtener el audio del tap
    OSStatus status = MTAudioProcessingTapGetSourceAudio(tap,
                                                          numberFrames,
                                                          bufferListInOut,
                                                          flagsOut,
                                                          NULL,
                                                          numberFramesOut);
    
    if (status != noErr) {
        return;
    }
    
    AudioTapContext *context = (AudioTapContext *)MTAudioProcessingTapGetStorage(tap);
    if (!context) return;
    
    MTAudioTap *self = (__bridge MTAudioTap *)context->self;
    if (!self.delegate) return;
    
    // Obtener datos del primer canal
    AudioBuffer audioBuffer = bufferListInOut->mBuffers[0];
    float *samples = (float *)audioBuffer.mData;
    UInt32 frameCount = audioBuffer.mDataByteSize / sizeof(float);
    
    if (frameCount < context->bufferSize) return;
    
    // Aplicar ventana Hann
    float windowedBuffer[context->bufferSize];
    vDSP_vmul(samples, 1, context->window, 1, windowedBuffer, 1, context->bufferSize);
    
    // Convertir a formato split complex para FFT
    vDSP_ctoz((DSPComplex *)windowedBuffer, 2, &context->splitComplex, 1, context->bufferSizeOver2);
    
    // Ejecutar FFT real in-place
    vDSP_fft_zrip(context->fftSetup, &context->splitComplex, 1, context->log2n, FFT_FORWARD);
    
    // Calcular magnitudes
    vDSP_zvabs(&context->splitComplex, 1, context->magnitudes, 1, context->bufferSizeOver2);
    
    // Normalizar
    float scale = 1.0 / (float)context->bufferSize;
    vDSP_vsmul(context->magnitudes, 1, &scale, context->magnitudes, 1, context->bufferSizeOver2);
    
    // Suavizado exponencial
    for (int i = 0; i < context->bufferSizeOver2; i++) {
        context->smoothedMagnitudes[i] = context->smoothingFactor * context->magnitudes[i] +
                                         (1.0 - context->smoothingFactor) * context->smoothedMagnitudes[i];
    }
    
    // Reducir a 64 bandas de frecuencia
    static const int numBands = 64;
    float bands[64];  // Tamaño fijo para evitar VLA
    int bandsPerBin = context->bufferSizeOver2 / numBands;
    
    for (int i = 0; i < numBands; i++) {
        float sum = 0;
        int start = i * bandsPerBin;
        int end = start + bandsPerBin;
        
        for (int j = start; j < end && j < context->bufferSizeOver2; j++) {
            sum += context->smoothedMagnitudes[j];
        }
        
        bands[i] = sum / bandsPerBin;
        
        // Escalar logarítmicamente
        bands[i] = log10f(1.0f + bands[i] * 100.0f) / 2.0f;
        
        // Limitar rango
        if (bands[i] > 1.0f) bands[i] = 1.0f;
        if (bands[i] < 0.0f) bands[i] = 0.0f;
    }
    
    // Copiar datos para el bloque (evitar referencia a VLA)
    float *bandsCopy = (float *)malloc(sizeof(float) * numBands);
    memcpy(bandsCopy, bands, sizeof(float) * numBands);
    
    // Enviar al delegate en main thread
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.delegate audioTapDidReceiveFFTData:bandsCopy length:numBands];
        free(bandsCopy);
    });
}

#pragma mark - Public Methods

- (void)attachToPlayerItem:(AVPlayerItem *)playerItem {
    if (!playerItem) {
        NSLog(@"[MTAudioTap] ⚠️ PlayerItem es nil");
        return;
    }
    
    // Primero desconectar si ya hay uno
    [self detach];
    
    _currentPlayerItem = playerItem;
    
    // Crear callbacks
    MTAudioProcessingTapCallbacks callbacks;
    callbacks.version = kMTAudioProcessingTapCallbacksVersion_0;
    callbacks.clientInfo = (__bridge void *)self;
    callbacks.init = tapInit;
    callbacks.finalize = tapFinalize;
    callbacks.prepare = tapPrepare;
    callbacks.unprepare = tapUnprepare;
    callbacks.process = tapProcess;
    
    // Crear el tap
    OSStatus status = MTAudioProcessingTapCreate(kCFAllocatorDefault,
                                                  &callbacks,
                                                  kMTAudioProcessingTapCreationFlag_PreEffects,
                                                  &_audioTap);
    
    if (status != noErr) {
        NSLog(@"[MTAudioTap] ❌ Error creando tap: %d", (int)status);
        return;
    }
    
    // Obtener el asset y tracks de audio
    AVAsset *asset = playerItem.asset;
    if (!asset) {
        NSLog(@"[MTAudioTap] ⚠️ Asset no disponible");
        return;
    }
    
    // Cargar tracks de audio
    [asset loadTracksWithMediaType:AVMediaTypeAudio completionHandler:^(NSArray<AVAssetTrack *> * _Nullable tracks, NSError * _Nullable error) {
        if (error || !tracks || tracks.count == 0) {
            NSLog(@"[MTAudioTap] ⚠️ No hay tracks de audio: %@", error);
            return;
        }
        
        dispatch_async(dispatch_get_main_queue(), ^{
            [self setupMixWithTracks:tracks forPlayerItem:playerItem];
        });
    }];
}

- (void)setupMixWithTracks:(NSArray<AVAssetTrack *> *)audioTracks forPlayerItem:(AVPlayerItem *)playerItem {
    if (!_audioTap) return;
    
    // Crear audio mix
    AVMutableAudioMix *audioMix = [AVMutableAudioMix audioMix];
    NSMutableArray *inputParams = [NSMutableArray array];
    
    for (AVAssetTrack *track in audioTracks) {
        AVMutableAudioMixInputParameters *params = [AVMutableAudioMixInputParameters audioMixInputParametersWithTrack:track];
        params.audioTapProcessor = _audioTap;
        [inputParams addObject:params];
    }
    
    audioMix.inputParameters = inputParams;
    
    // Aplicar al player item
    playerItem.audioMix = audioMix;
    
    _isAttached = YES;
    NSLog(@"[MTAudioTap] ✅ Tap conectado al AVPlayerItem - Capturando audio REAL");
}

- (void)detach {
    if (_currentPlayerItem) {
        _currentPlayerItem.audioMix = nil;
        _currentPlayerItem = nil;
    }
    
    if (_audioTap) {
        CFRelease(_audioTap);
        _audioTap = NULL;
    }
    
    _isAttached = NO;
    NSLog(@"[MTAudioTap] ⏹ Tap desconectado");
}

- (void)playerItemDidChange:(AVPlayerItem *)playerItem {
    NSLog(@"[MTAudioTap] 🔄 Nuevo PlayerItem detectado");
    [self attachToPlayerItem:playerItem];
}

@end
