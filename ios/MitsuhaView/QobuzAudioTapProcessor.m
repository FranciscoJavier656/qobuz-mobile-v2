/**
 * QobuzAudioTapProcessor.m
 * Captura audio real usando AVAudioEngine y procesa con vDSP FFT
 * Renombrado de AudioTapProcessor para evitar conflicto con expo-audio
 * 
 * Este módulo:
 * 1. Se conecta al AVAudioEngine del sistema
 * 2. Instala un tap en el nodo de salida
 * 3. Procesa el audio con FFT usando vDSP (Accelerate framework)
 * 4. Envía los datos de frecuencia al visualizador
 */

#import "QobuzAudioTapProcessor.h"
#import <Accelerate/Accelerate.h>

static QobuzAudioTapProcessor *sharedInstance = nil;

@implementation QobuzAudioTapProcessor {
    AVAudioEngine *_audioEngine;
    AVAudioMixerNode *_mixerNode;
    
    // FFT Setup (vDSP)
    FFTSetup _fftSetup;
    int _bufferSize;
    int _bufferSizeOver2;
    int _log2n;
    
    // FFT Buffers
    float *_window;
    float *_realBuffer;
    float *_imagBuffer;
    DSPSplitComplex _splitComplex;
    float *_magnitudes;
    float *_smoothedMagnitudes;
    
    // Smoothing
    float _smoothingFactor;
}

+ (instancetype)sharedInstance {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [[QobuzAudioTapProcessor alloc] init];
    });
    return sharedInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _isRunning = NO;
        _smoothingFactor = 0.3; // Suavizado para animación fluida
        
        // Configurar FFT
        _bufferSize = 1024;
        _bufferSizeOver2 = _bufferSize / 2;
        _log2n = (int)log2(_bufferSize);
        
        // Crear FFT setup
        _fftSetup = vDSP_create_fftsetup(_log2n, kFFTRadix2);
        
        // Allocar buffers
        _window = (float *)malloc(sizeof(float) * _bufferSize);
        _realBuffer = (float *)malloc(sizeof(float) * _bufferSizeOver2);
        _imagBuffer = (float *)malloc(sizeof(float) * _bufferSizeOver2);
        _magnitudes = (float *)malloc(sizeof(float) * _bufferSizeOver2);
        _smoothedMagnitudes = (float *)calloc(_bufferSizeOver2, sizeof(float));
        
        _splitComplex.realp = _realBuffer;
        _splitComplex.imagp = _imagBuffer;
        
        // Crear ventana Hann para reducir artifacts
        vDSP_hann_window(_window, _bufferSize, vDSP_HANN_NORM);
        
        [self setupAudioEngine];
    }
    return self;
}

- (void)dealloc {
    [self stopCapturing];
    
    if (_fftSetup) {
        vDSP_destroy_fftsetup(_fftSetup);
    }
    
    free(_window);
    free(_realBuffer);
    free(_imagBuffer);
    free(_magnitudes);
    free(_smoothedMagnitudes);
}

- (void)setupAudioEngine {
    _audioEngine = [[AVAudioEngine alloc] init];
    _mixerNode = [_audioEngine mainMixerNode];
}

- (void)startCapturing {
    if (_isRunning) return;
    
    NSError *error = nil;
    AVAudioSession *session = [AVAudioSession sharedInstance];
    
    // Configurar sesión de audio
    [session setCategory:AVAudioSessionCategoryPlayback 
                    mode:AVAudioSessionModeDefault 
                 options:AVAudioSessionCategoryOptionMixWithOthers 
                   error:&error];
    
    if (error) {
        NSLog(@"[QobuzAudioTapProcessor] Error configurando sesión: %@", error);
        return;
    }
    
    [session setActive:YES error:&error];
    if (error) {
        NSLog(@"[QobuzAudioTapProcessor] Error activando sesión: %@", error);
        return;
    }
    
    // Instalar tap en el mixer node
    AVAudioFormat *format = [_mixerNode outputFormatForBus:0];
    
    __weak typeof(self) weakSelf = self;
    [_mixerNode installTapOnBus:0 
                     bufferSize:_bufferSize 
                         format:format 
                          block:^(AVAudioPCMBuffer * _Nonnull buffer, AVAudioTime * _Nonnull when) {
        [weakSelf processAudioBuffer:buffer];
    }];
    
    // Iniciar engine
    [_audioEngine prepare];
    [_audioEngine startAndReturnError:&error];
    
    if (error) {
        NSLog(@"[QobuzAudioTapProcessor] Error iniciando engine: %@", error);
        return;
    }
    
    _isRunning = YES;
    NSLog(@"[QobuzAudioTapProcessor] ✅ Captura de audio iniciada");
}

- (void)stopCapturing {
    if (!_isRunning) return;
    
    [_mixerNode removeTapOnBus:0];
    [_audioEngine stop];
    
    _isRunning = NO;
    NSLog(@"[QobuzAudioTapProcessor] ⏹ Captura de audio detenida");
}

- (void)processAudioBuffer:(AVAudioPCMBuffer *)buffer {
    if (!self.delegate) return;
    
    // Obtener datos del canal 0
    float *channelData = buffer.floatChannelData[0];
    UInt32 frameLength = buffer.frameLength;
    
    if (frameLength < _bufferSize) return;
    
    // Aplicar ventana Hann
    float windowedBuffer[_bufferSize];
    vDSP_vmul(channelData, 1, _window, 1, windowedBuffer, 1, _bufferSize);
    
    // Convertir a formato split complex para FFT
    vDSP_ctoz((DSPComplex *)windowedBuffer, 2, &_splitComplex, 1, _bufferSizeOver2);
    
    // Ejecutar FFT
    vDSP_fft_zrip(_fftSetup, &_splitComplex, 1, _log2n, FFT_FORWARD);
    
    // Calcular magnitudes
    vDSP_zvabs(&_splitComplex, 1, _magnitudes, 1, _bufferSizeOver2);
    
    // Normalizar (escalar a rango útil para visualización)
    float scale = 1.0 / (float)_bufferSize;
    vDSP_vsmul(_magnitudes, 1, &scale, _magnitudes, 1, _bufferSizeOver2);
    
    // Aplicar suavizado exponencial para animación fluida
    for (int i = 0; i < _bufferSizeOver2; i++) {
        _smoothedMagnitudes[i] = _smoothingFactor * _magnitudes[i] + 
                                 (1.0 - _smoothingFactor) * _smoothedMagnitudes[i];
    }
    
    // Reducir a bandas de frecuencia para el visualizador (64 bandas)
    static const int numBands = 64;
    float bands[64];  // Tamaño fijo para evitar VLA
    int bandsPerBin = _bufferSizeOver2 / numBands;
    
    for (int i = 0; i < numBands; i++) {
        float sum = 0;
        int start = i * bandsPerBin;
        int end = start + bandsPerBin;
        
        for (int j = start; j < end && j < _bufferSizeOver2; j++) {
            sum += _smoothedMagnitudes[j];
        }
        
        bands[i] = sum / bandsPerBin;
        
        // Escalar logarítmicamente para mejor visualización
        bands[i] = log10f(1.0f + bands[i] * 100.0f) / 2.0f;
        
        // Limitar rango
        if (bands[i] > 1.0f) bands[i] = 1.0f;
        if (bands[i] < 0.0f) bands[i] = 0.0f;
    }
    
    // Copiar datos para el bloque (evitar referencia a array local)
    float *bandsCopy = (float *)malloc(sizeof(float) * numBands);
    memcpy(bandsCopy, bands, sizeof(float) * numBands);
    
    // Enviar al delegate
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.delegate audioTapDidReceiveBuffer:bandsCopy length:numBands];
        free(bandsCopy);
    });
}

@end
