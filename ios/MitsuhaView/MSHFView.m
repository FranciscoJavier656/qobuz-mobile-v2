/**
 * MSHFView.m - Versión adaptada para React Native (sin jailbreak)
 * 
 * Código original de libmitsuha6 por Ryan Nair / Nepeta / Andy Shin
 * Adaptado para funcionar sin jailbreak
 * 
 * MANTIENE: Toda la lógica de setSampleData, layoutSubviews y física original
 * QUITA: Dependencias de SBMediaController (jailbreak)
 */

#import "MSHFView.h"
#import <Accelerate/Accelerate.h>

@implementation MSHFView

- (instancetype)initWithFrame:(CGRect)frame {
    self = [self initWithFrame:frame audioSource:nil];
    return self;
}

- (instancetype)initWithFrame:(CGRect)frame audioSource:(MSHFAudioSource *)audioSource {
    self = [super initWithFrame:frame];
    
    if (self) {
        _numberOfPoints = 8;
        self.userInteractionEnabled = NO;
        self.gain = 50;
        self.sensitivity = 1;
        self.waveOffset = 0;
        self.limiter = 0;
        self.disableBatterySaver = YES; // Siempre visible en nuestra app
        [self setAlpha:1.0f]; // Empezar visible
        
        // Audio source puede ser nil - lo manejamos desde React Native
        if (audioSource) {
            self.audioSource = audioSource;
            self.audioSource.delegate = self;
        }
        
        self.audioProcessing = [[MSHFAudioProcessing alloc] initWithBufferSize:1024];
        self.audioProcessing.delegate = self;
        
        [self initializeWaveLayers];
        self.points = (CGPoint *)malloc(sizeof(CGPoint) * _numberOfPoints);
        
        // Inicializar puntos
        float const pixelFixer = self.bounds.size.width / _numberOfPoints;
        for (int i = 0; i < _numberOfPoints; i++) {
            _points[i].x = i * pixelFixer;
            _points[i].y = 0;
        }
        
        silentSince = (long long)[NSDate timeIntervalSinceReferenceDate];
        MSHFHidden = NO;
    }
    
    return self;
}

- (void)dealloc {
    [_displayLink invalidate];
    if (self.points) {
        free(self.points);
        self.points = NULL;
    }
}

- (void)setNumberOfPoints:(NSInteger)numberOfPoints {
    if (_numberOfPoints != numberOfPoints) {
        free(self.points);
        self.points = (CGPoint *)malloc(sizeof(CGPoint) * numberOfPoints);
        _numberOfPoints = numberOfPoints;
        
        // Reinicializar puntos
        float const pixelFixer = self.bounds.size.width / _numberOfPoints;
        for (int i = 0; i < _numberOfPoints; i++) {
            _points[i].x = i * pixelFixer;
            _points[i].y = 0;
        }
    }
}

- (void)stop {
    if (self.audioSource && self.audioSource.isRunning && !self.disableBatterySaver) {
        [self.audioSource stop];
        [self.displayLink setPaused:true];
        silentSince = -2;
        [self redraw];
    }
}

- (void)start {
    // Sin SBMediaController - empezamos directamente
    if (self.audioSource) {
        [self.audioSource start];
    }
    [self.displayLink setPaused:false];
}

- (void)initializeWaveLayers {
    // Implementado por subclases (MSHFJelloView, etc.)
}

- (void)resetWaveLayers {
    // Implementado por subclases
}

- (void)configureDisplayLink {
    self.displayLink = [CADisplayLink displayLinkWithTarget:self selector:@selector(redraw)];
    [self.displayLink addToRunLoop:[NSRunLoop currentRunLoop] forMode:NSDefaultRunLoopMode];
    [self.displayLink setPaused:false]; // Empezar activo
    self.displayLink.preferredFramesPerSecond = 60;
}

- (void)updateWaveColor:(CGColorRef)waveColor subwaveColor:(CGColorRef)subwaveColor {
    // Implementado por subclases
}

- (void)updateWaveColor:(CGColorRef)waveColor subwaveColor:(CGColorRef)subwaveColor subSubwaveColor:(CGColorRef)subSubwaveColor {
    // Implementado por subclases
}

- (void)redraw {
    // Auto-hide basado en silencio (comportamiento original)
    if (!self.disableBatterySaver) {
        if (silentSince < ((long long)[NSDate timeIntervalSinceReferenceDate] - 1)) {
            if (!MSHFHidden) {
                MSHFHidden = true;
                [UIView animateWithDuration:0.5 animations:^{
                    [self setAlpha:0.0f];
                }];
            }
        } else if (MSHFHidden) {
            MSHFHidden = false;
            [UIView animateWithDuration:0.5 animations:^{
                [self setAlpha:1.0f];
            }];
        }
    }
}

- (void)updateBuffer:(float *)bufferData withLength:(int)length {
    for (int i = 0; i < length / 4; i++) {
        if (bufferData[i] > 0.000005) {
            silentSince = (long long)[NSDate timeIntervalSinceReferenceDate];
            break;
        }
    }
    
    [self.audioProcessing process:bufferData withLength:length];
}

- (void)layoutSubviews {
    [super layoutSubviews];
    
    // CÓDIGO ORIGINAL - Recalcular posiciones X
    float const pixelFixer = self.bounds.size.width / _numberOfPoints;
    for (int i = 0; i < _numberOfPoints; i++) {
        _points[i].x = i * pixelFixer;
    }
}

// CÓDIGO ORIGINAL EXACTO - La física de las ondas
- (void)setSampleData:(float *)data length:(int)length {
    if (!self.points || length == 0) return;
    
    NSUInteger const compressionRate = MAX(1, length / _numberOfPoints);
    float gainAdjusted = self.gain * self.sensitivity;
    
    // Ajuste especial para 480 samples (comportamiento original)
    if (length == 480) {
        float meanLevel = 0.0;
        vDSP_measqv(data, 1, &meanLevel, _numberOfPoints);
        gainAdjusted *= 256 * (meanLevel + 1);
    }
    
    // Aplicar ganancia con vDSP (aceleración por hardware)
    vDSP_vsmul(data, compressionRate, &gainAdjusted, data, 1, _numberOfPoints);
    
    // Aplicar limiter si está configurado
    if (_limiter > 0) {
        float upperBound = _limiter;
        float lowerBound = -upperBound;
        vDSP_vclip(data, 1, &lowerBound, &upperBound, data, 1, _numberOfPoints);
    }
    
    // Aplicar offset
    if (_waveOffset != 0) {
        float waveOffset = _waveOffset;
        vDSP_vsadd(data, 1, &waveOffset, data, 1, _numberOfPoints);
    }
    
    // Actualizar puntos Y
    for (int i = 0; i < _numberOfPoints; i++) {
        _points[i].y = data[i];
    }
}

@end
