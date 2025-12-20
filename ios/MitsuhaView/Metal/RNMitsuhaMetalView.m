/**
 * RNMitsuhaMetalView.m
 * Puente de React Native para Mitsuha con Metal GPU Rendering
 * 
 * Este módulo proporciona renderizado GPU acelerado para las animaciones de onda.
 * Características:
 * - Renderizado en GPU a 60fps usando Metal
 * - Fallback automático a Core Animation si Metal no está disponible
 * - Integración con MTAudioTap para datos de audio reales
 * - Shaders optimizados para curvas Bézier
 */

#import "RNMitsuhaMetalView.h"
#import "../MTAudioTap.h"
#import "../AudioTapBridge.h"
#import <React/RCTViewManager.h>
#import <React/RCTBridge.h>
#import <Metal/Metal.h>

// Importar el módulo Swift
#import "qobuzmobilev2-Swift.h"

@interface RNMitsuhaMetalView () <MTAudioTapDelegate>
@end

@implementation RNMitsuhaMetalView {
    CADisplayLink *_displayLink;
    float *_audioBuffer;
    float *_fftBuffer;
    int _bufferLength;
    int _fftLength;
    BOOL _useRealAudio;
    
    // Simulación de audio cuando no hay audio real
    float _phase;
    float _targetAmplitude;
    float _currentAmplitude;
    NSTimeInterval _lastBeatTime;
    float _beatPhase;
    NSTimeInterval _lastRealAudioTime;
    
    // Control de visibilidad
    BOOL _isAnimatingVisibility;
    BOOL _targetVisibility;
    
    // Metal
    BOOL _metalAvailable;
}

@synthesize metalView = _metalView;

- (instancetype)initWithFrame:(CGRect)frame {
    self = [super initWithFrame:frame];
    
    if (self) {
        self.backgroundColor = [UIColor clearColor];
        _useMetal = YES; // Metal por defecto
        
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
        
        // Verificar disponibilidad de Metal
        _metalAvailable = (MTLCreateSystemDefaultDevice() != nil);
        
        // Crear vista de Metal
        _metalView = [[MitsuhaMetalView alloc] initWithFrame:self.bounds];
        _metalView.numberOfPoints = 12;
        _metalView.gain = 35;
        _metalView.sensitivity = 1.2;
        _metalView.waveOffset = 0;
        _metalView.alpha = 0.0;
        
        _isAnimatingVisibility = NO;
        _targetVisibility = NO;
        
        [self addSubview:_metalView];
        
        // Configurar MTAudioTap para capturar audio REAL
        [MTAudioTap sharedInstance].delegate = self;
        
        // Iniciar display link
        [self startDisplayLink];
        
        NSLog(@"[RNMitsuhaMetalView] 🎨 Inicializado con Metal GPU Rendering");
        NSLog(@"[RNMitsuhaMetalView] 📱 Metal disponible: %@", _metalAvailable ? @"SÍ" : @"NO");
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
    
    NSLog(@"[RNMitsuhaMetalView] 🗑 Deallocated");
}

- (void)layoutSubviews {
    [super layoutSubviews];
    _metalView.frame = self.bounds;
}

#pragma mark - MTAudioTapDelegate

- (void)audioTapDidReceiveFFTData:(float *)fftData length:(int)length {
    _useRealAudio = YES;
    _lastRealAudioTime = CACurrentMediaTime();
    
    int copyLength = MIN(length, _fftLength);
    memcpy(_fftBuffer, fftData, sizeof(float) * copyLength);
    
    // Log ocasional
    static int frameCount = 0;
    if (++frameCount % 300 == 0) {
        float avgLevel = 0;
        for (int i = 0; i < copyLength; i++) avgLevel += fftData[i];
        avgLevel /= copyLength;
        NSLog(@"[RNMitsuhaMetalView] 🎵 Metal Audio REAL - Nivel: %.4f", avgLevel);
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
        _targetAmplitude = 0;
        _currentAmplitude *= 0.92;
        _useRealAudio = NO;
        
        if (_currentAmplitude < 0.0001) {
            return;
        }
    }
    
    NSTimeInterval now = CACurrentMediaTime();
    BOOL hasRecentRealAudio = _useRealAudio && (now - _lastRealAudioTime < 0.1);
    
    if (hasRecentRealAudio) {
        // Usar datos FFT reales
        for (int i = 0; i < _bufferLength; i++) {
            int bandIndex = (i * _fftLength) / _bufferLength;
            bandIndex = MIN(bandIndex, _fftLength - 1);
            
            float fftValue = _fftBuffer[bandIndex];
            float positionFactor = sinf((float)i / (float)_bufferLength * M_PI);
            
            _audioBuffer[i] = fftValue * positionFactor * 2.0;
        }
    } else {
        // Simulación de audio
        [self generateSimulatedAudio];
    }
    
    // Actualizar vista Metal
    [_metalView updateBuffer:_audioBuffer length:_bufferLength];
}

#pragma mark - Simulated Audio

- (void)generateSimulatedAudio {
    NSTimeInterval now = CACurrentMediaTime();
    
    if (now - _lastBeatTime > (0.3 + (float)arc4random_uniform(100) / 100.0)) {
        _lastBeatTime = now;
        _targetAmplitude = 0.5 + (float)arc4random_uniform(50) / 100.0;
        _beatPhase = 0;
    }
    
    _beatPhase += 0.1;
    float beatEnvelope = expf(-_beatPhase * 2.0);
    _targetAmplitude *= beatEnvelope;
    
    _currentAmplitude += (_targetAmplitude - _currentAmplitude) * 0.15;
    
    _phase += 0.08;
    
    for (int i = 0; i < _bufferLength; i++) {
        float x = (float)i / (float)_bufferLength;
        
        float wave1 = sinf(_phase + x * 3.0) * 0.3;
        float wave2 = sinf(_phase * 1.3 + x * 5.0) * 0.2;
        float wave3 = sinf(_phase * 0.7 + x * 7.0) * 0.15;
        
        float positionEnvelope = sinf(x * M_PI);
        float combined = (wave1 + wave2 + wave3) * _currentAmplitude * positionEnvelope;
        
        _audioBuffer[i] = fabsf(combined);
    }
}

#pragma mark - Properties

- (void)setIsPlaying:(BOOL)isPlaying {
    if (_isPlaying == isPlaying) return;
    
    _isPlaying = isPlaying;
    
    if (isPlaying) {
        [self animateVisibility:YES];
        [_metalView start];
        // MTAudioTap se conecta automáticamente cuando hay un AVPlayerItem
        NSLog(@"[RNMitsuhaMetalView] ▶️ Metal rendering iniciado");
    } else {
        [self animateVisibility:NO];
        // MTAudioTap se desconecta automáticamente
        NSLog(@"[RNMitsuhaMetalView] ⏸ Metal rendering pausado");
    }
}

- (void)animateVisibility:(BOOL)visible {
    if (_isAnimatingVisibility && _targetVisibility == visible) return;
    
    _isAnimatingVisibility = YES;
    _targetVisibility = visible;
    
    if (visible) {
        _metalView.hidden = NO;
    }
    
    [UIView animateWithDuration:0.4
                          delay:0
                        options:UIViewAnimationOptionCurveEaseInOut
                     animations:^{
                         self->_metalView.alpha = visible ? 1.0 : 0.0;
                     }
                     completion:^(BOOL finished) {
                         self->_isAnimatingVisibility = NO;
                         if (!visible && finished) {
                             [self->_metalView stop];
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
    
    if (primary) {
        _metalView.waveColor = primary;
        _metalView.subwaveColor = secondary ?: [primary colorWithAlphaComponent:0.6];
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

@implementation RNMitsuhaMetalViewManager

RCT_EXPORT_MODULE(RNMitsuhaMetalView)

- (UIView *)view {
    return [[RNMitsuhaMetalView alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(isPlaying, BOOL)
RCT_EXPORT_VIEW_PROPERTY(primaryColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(secondaryColor, NSString)
RCT_EXPORT_VIEW_PROPERTY(useMetal, BOOL)

RCT_CUSTOM_VIEW_PROPERTY(numberOfPoints, NSNumber, RNMitsuhaMetalView) {
    if (json) {
        view.metalView.numberOfPoints = [json integerValue];
    }
}

RCT_CUSTOM_VIEW_PROPERTY(gain, NSNumber, RNMitsuhaMetalView) {
    if (json) {
        view.metalView.gain = [json floatValue];
    }
}

RCT_CUSTOM_VIEW_PROPERTY(sensitivity, NSNumber, RNMitsuhaMetalView) {
    if (json) {
        view.metalView.sensitivity = [json floatValue];
    }
}

RCT_CUSTOM_VIEW_PROPERTY(waveOffset, NSNumber, RNMitsuhaMetalView) {
    if (json) {
        view.metalView.waveOffset = [json floatValue];
    }
}

// visualizerStyle removido - usar configuración por defecto (jello)

@end
