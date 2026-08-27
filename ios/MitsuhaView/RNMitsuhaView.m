/**
 * RNMitsuhaView.m
 * Puente de React Native para libmitsuha6 ORIGINAL
 * 
 * Este archivo conecta React Native con MSHFJelloView de libmitsuha6
 * Usa el código ORIGINAL de animaciones (MSHFJelloLayer con CABasicAnimation 0.15s)
 * 
 * ACTUALIZADO: Ahora usa MTAudioProcessingTap para capturar audio REAL del AVPlayer
 * vDSP FFT procesa el audio interceptado del player de expo-av
 */

#import "RNMitsuhaView.h"
#import "MTAudioTap.h"
#import "AudioTapBridge.h"
#import <React/RCTViewManager.h>
#import <React/RCTBridge.h>

// Importar el módulo Swift de Mitsuha
#import "qobuzmobilev2-Swift.h"

@interface RNMitsuhaView () <MTAudioTapDelegate>
@end

@implementation RNMitsuhaView {
    CADisplayLink *_displayLink;
    float *_audioBuffer;
    float *_fftBuffer;
    int _bufferLength;
    int _fftLength;
    BOOL _useRealAudio;
    
    // Fallback simulation cuando no hay audio real
    float _phase;
    float _targetAmplitude;
    float _currentAmplitude;
    NSTimeInterval _lastBeatTime;
    float _beatPhase;
    NSTimeInterval _lastRealAudioTime;
    
    // Animación de fade in/out
    BOOL _isAnimatingVisibility;
    BOOL _targetVisibility;
}

- (instancetype)initWithFrame:(CGRect)frame {
    self = [super initWithFrame:frame];
    
    if (self) {
        self.backgroundColor = [UIColor clearColor];
        
        // Buffer para audio
        _bufferLength = 1024;
        _fftLength = 64;
        _audioBuffer = (float *)malloc(sizeof(float) * _bufferLength);
        _fftBuffer = (float *)calloc(_fftLength, sizeof(float));
        memset(_audioBuffer, 0, sizeof(float) * _bufferLength);
        
        _phase = 0;
        _targetAmplitude = 0;
        _currentAmplitude = 0;
        _lastBeatTime = 0;
        _beatPhase = 0;
        _useRealAudio = NO;
        _lastRealAudioTime = 0;
        
        // Crear MSHFJelloView (código original de libmitsuha6)
        _jelloView = [[MSHFJelloView alloc] initWithFrame:self.bounds];
        _jelloView.numberOfPoints = 8;
        _jelloView.gain = 50;
        _jelloView.sensitivity = 1;
        _jelloView.waveOffset = 0;
        _jelloView.disableBatterySaver = YES;
        _jelloView.siriEnabled = NO;
        
        // Iniciar con opacidad 0 para fade in suave
        _jelloView.alpha = 0.0;
        _isAnimatingVisibility = NO;
        _targetVisibility = NO;
        
        [self addSubview:_jelloView];
        
        // Configurar MTAudioTap para capturar audio REAL del AVPlayer
        [MTAudioTap sharedInstance].delegate = self;
        
        // Iniciar display link para actualización continua
        [self startDisplayLink];
        
        NSLog(@"[RNMitsuhaView] 🎵 Inicializado con MTAudioTap para audio REAL");
    }
    
    return self;
}

- (void)dealloc {
    [self stopDisplayLink];
    [MTAudioTap sharedInstance].delegate = nil;
    [[MTAudioTap sharedInstance] detach];
    
    if (_audioBuffer) {
        free(_audioBuffer);
        _audioBuffer = NULL;
    }
    if (_fftBuffer) {
        free(_fftBuffer);
        _fftBuffer = NULL;
    }
}

- (void)layoutSubviews {
    [super layoutSubviews];
    _jelloView.frame = self.bounds;
}

#pragma mark - MTAudioTapDelegate (FFT Real del AVPlayer)

- (void)audioTapDidReceiveFFTData:(float *)fftData length:(int)length {
    // Recibimos datos FFT REALES del MTAudioTap (audio interceptado del AVPlayer)
    _useRealAudio = YES;
    _lastRealAudioTime = CACurrentMediaTime();
    
    // Copiar datos FFT
    int copyLength = MIN(length, _fftLength);
    memcpy(_fftBuffer, fftData, sizeof(float) * copyLength);
    
    // Log ocasional para confirmar que estamos recibiendo audio real
    static int frameCount = 0;
    if (++frameCount % 300 == 0) {
        float avgLevel = 0;
        for (int i = 0; i < copyLength; i++) avgLevel += fftData[i];
        avgLevel /= copyLength;
        NSLog(@"[RNMitsuhaView] 🎵 Audio REAL - Nivel promedio: %.4f", avgLevel);
    }
}

#pragma mark - Display Link

- (void)startDisplayLink {
    if (_displayLink) return;
    
    _displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(updateVisualization)];
    _displayLink.preferredFramesPerSecond = 60;
    [_displayLink addToRunLoop:[NSRunLoop mainRunLoop] forMode:NSRunLoopCommonModes];
}

- (void)stopDisplayLink {
    [_displayLink invalidate];
    _displayLink = nil;
}

- (void)updateVisualization {
    if (!self.isPlaying) {
        // Cuando no reproduce, llevar amplitud a 0 suavemente
        _targetAmplitude = 0;
        _currentAmplitude *= 0.92;
        _useRealAudio = NO;
        
        if (_currentAmplitude < 0.0001) {
            return;
        }
    }
    
    // Verificar si tenemos datos de audio reales recientes
    NSTimeInterval now = CACurrentMediaTime();
    BOOL hasRecentRealAudio = _useRealAudio && (now - _lastRealAudioTime < 0.1);
    
    if (hasRecentRealAudio) {
        // Usar datos FFT reales - convertir bandas a buffer para visualizador
        for (int i = 0; i < _bufferLength; i++) {
            int bandIndex = (i * _fftLength) / _bufferLength;
            bandIndex = MIN(bandIndex, _fftLength - 1);
            
            float fftValue = _fftBuffer[bandIndex];
            
            // Agregar variación basada en posición
            float positionFactor = sinf((float)i / (float)_bufferLength * M_PI);
            
            // Combinar valor FFT con variación posicional
            _audioBuffer[i] = fftValue * positionFactor * 2.0;
        }
    } else {
        // Fallback a simulación cuando no hay audio real
        [self generateSimulatedAudio];
    }
    
    // Enviar datos a MSHFJelloView usando el método ORIGINAL
    [_jelloView updateBuffer:_audioBuffer withLength:_bufferLength];
}

#pragma mark - Simulated Audio (Fallback)

- (void)generateSimulatedAudio {
    NSTimeInterval now = CACurrentMediaTime();
    
    // Beats aleatorios
    if (now - _lastBeatTime > (0.3 + (float)arc4random_uniform(100) / 100.0)) {
        _lastBeatTime = now;
        _targetAmplitude = 0.5 + (float)arc4random_uniform(50) / 100.0;
        _beatPhase = 0;
    }
    
    // Decay del beat
    _beatPhase += 0.025;
    float beatMultiplier = 1.0 + (0.6 * expf(-_beatPhase * 2.5));
    
    // Interpolación suave
    _currentAmplitude += (_targetAmplitude * beatMultiplier - _currentAmplitude) * 0.12;
    
    // Decay natural
    _targetAmplitude *= 0.97;
    
    // Generar datos de audio
    _phase += 0.06;
    
    for (int i = 0; i < _bufferLength; i++) {
        float normalizedIndex = (float)i / (float)_bufferLength;
        
        // Múltiples ondas
        float wave1 = sinf(_phase + normalizedIndex * M_PI * 2.0) * 0.35;
        float wave2 = sinf(_phase * 1.5 + normalizedIndex * M_PI * 3.0) * 0.25;
        float wave3 = sinf(_phase * 0.7 + normalizedIndex * M_PI * 1.5) * 0.2;
        float wave4 = sinf(_phase * 2.1 + normalizedIndex * M_PI * 5.0) * 0.15;
        
        // Ruido
        float noise = ((float)arc4random_uniform(100) / 100.0 - 0.5) * 0.08;
        
        // Combinar
        float combined = (wave1 + wave2 + wave3 + wave4 + noise) * _currentAmplitude;
        
        _audioBuffer[i] = combined;
    }
}

#pragma mark - React Native Properties

- (void)setIsPlaying:(BOOL)isPlaying {
    _isPlaying = isPlaying;
    
    if (isPlaying) {
        _targetAmplitude = 0.4;
        _lastBeatTime = CACurrentMediaTime();
        [_jelloView start];
        
        // Animación de fade in suave (300ms)
        [self animateVisibilityTo:YES];
        
        // MTAudioTap ya está conectado al AVPlayer de expo-av
        // El tap se conecta automáticamente cuando hay un playerItem
        NSLog(@"[RNMitsuhaView] ▶️ Reproducción iniciada - MTAudioTap activo: %@", 
              [MTAudioTap sharedInstance].isAttached ? @"SÍ" : @"NO");
    } else {
        // Animación de fade out suave (400ms)
        [self animateVisibilityTo:NO];
        
        _useRealAudio = NO;
        NSLog(@"[RNMitsuhaView] ⏸ Reproducción pausada");
    }
}

#pragma mark - Visibility Animation

- (void)animateVisibilityTo:(BOOL)visible {
    if (_targetVisibility == visible && _isAnimatingVisibility) {
        return; // Ya animando al mismo estado
    }
    
    _targetVisibility = visible;
    _isAnimatingVisibility = YES;
    
    // Duración diferente para fade in vs fade out
    CGFloat duration = visible ? 0.3 : 0.4;
    
    [UIView animateWithDuration:duration
                          delay:0.0
                        options:UIViewAnimationOptionCurveEaseInOut
                     animations:^{
                         self->_jelloView.alpha = visible ? 1.0 : 0.0;
                     }
                     completion:^(BOOL finished) {
                         self->_isAnimatingVisibility = NO;
                         if (!visible && finished) {
                             [self->_jelloView stop];
                         }
                     }];
}

- (void)setPrimaryColor:(NSString *)primaryColor {
    _primaryColor = [primaryColor copy];
    [self updateColors];
}

- (void)setSecondaryColor:(NSString *)secondaryColor {
    _secondaryColor = [secondaryColor copy];
    [self updateColors];
}

- (void)updateColors {
    if (!_primaryColor) return;
    
    UIColor *primary = [self colorFromHexString:_primaryColor];
    UIColor *secondary = _secondaryColor ? [self colorFromHexString:_secondaryColor] : [primary colorWithAlphaComponent:0.6];
    
    if (primary && secondary) {
        [_jelloView updateWaveColor:primary.CGColor subwaveColor:secondary.CGColor];
    }
}

- (UIColor *)colorFromHexString:(NSString *)hexString {
    if (!hexString || hexString.length < 6) return nil;
    
    unsigned rgbValue = 0;
    NSScanner *scanner = [NSScanner scannerWithString:hexString];
    
    if ([hexString hasPrefix:@"#"]) {
        [scanner setScanLocation:1];
    }
    
    [scanner scanHexInt:&rgbValue];
    
    return [UIColor colorWithRed:((rgbValue & 0xFF0000) >> 16) / 255.0
                           green:((rgbValue & 0x00FF00) >> 8) / 255.0
                            blue:(rgbValue & 0x0000FF) / 255.0
                           alpha:0.85];
}

@end

#pragma mark - React Native View Manager

@implementation RNMitsuhaViewManager

RCT_EXPORT_MODULE()

- (UIView *)view {
    return [[RNMitsuhaView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(isPlaying, BOOL)
RCT_EXPORT_VIEW_PROPERTY(primaryColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(secondaryColor, NSString)

RCT_CUSTOM_VIEW_PROPERTY(numberOfPoints, NSNumber, RNMitsuhaView) {
    if (json) {
        view.jelloView.numberOfPoints = [json integerValue];
    }
}

RCT_CUSTOM_VIEW_PROPERTY(gain, NSNumber, RNMitsuhaView) {
    if (json) {
        view.jelloView.gain = [json floatValue];
    }
}

RCT_CUSTOM_VIEW_PROPERTY(sensitivity, NSNumber, RNMitsuhaView) {
    if (json) {
        view.jelloView.sensitivity = [json floatValue];
    }
}

RCT_CUSTOM_VIEW_PROPERTY(waveOffset, NSNumber, RNMitsuhaView) {
    if (json) {
        view.jelloView.waveOffset = [json floatValue];
    }
}

@end
