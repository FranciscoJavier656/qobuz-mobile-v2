/**
 * AudioTapBridge.m
 * Puente de React Native para conectar MTAudioTap con expo-av
 * 
 * expo-av usa AVPlayer internamente. Este módulo:
 * 1. Recibe notificaciones de JavaScript cuando hay un nuevo Sound
 * 2. Busca el AVPlayer de expo-av usando reflection
 * 3. Conecta el MTAudioTap al AVPlayerItem
 */

#import "AudioTapBridge.h"
#import "MTAudioTap.h"
#import <AVFoundation/AVFoundation.h>
#import <objc/runtime.h>

// Notificación interna de expo-av cuando hay un nuevo player
static NSString *const kEXAVPlayerDidCreateNotification = @"EXAVPlayerDidCreate";

@implementation AudioTapBridge {
    BOOL _hasListeners;
    AVPlayer *_currentPlayer;
}

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        // Observar cambios en el AVPlayer de expo-av
        [[NSNotificationCenter defaultCenter] addObserver:self
                                                 selector:@selector(handlePlayerNotification:)
                                                     name:AVPlayerItemDidPlayToEndTimeNotification
                                                   object:nil];
        
        // Observar cuando expo-av crea un nuevo player
        [[NSNotificationCenter defaultCenter] addObserver:self
                                                 selector:@selector(handleNewPlayer:)
                                                     name:@"EXAVDidCreateNewPlayer"
                                                   object:nil];
        
        NSLog(@"[AudioTapBridge] 🎵 Inicializado - Escuchando cambios de player");
    }
    return self;
}

- (void)dealloc {
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"onAudioTapAttached", @"onAudioTapDetached", @"onFFTData"];
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

#pragma mark - Notifications

- (void)handlePlayerNotification:(NSNotification *)notification {
    NSLog(@"[AudioTapBridge] 🔔 Player notification: %@", notification.name);
}

- (void)handleNewPlayer:(NSNotification *)notification {
    AVPlayer *player = notification.object;
    if ([player isKindOfClass:[AVPlayer class]]) {
        NSLog(@"[AudioTapBridge] 🎵 Nuevo AVPlayer detectado");
        [self attachTapToPlayer:player];
    }
}

#pragma mark - React Native Methods

RCT_EXPORT_METHOD(attachToPlayer:(NSString *)playerId) {
    NSLog(@"[AudioTapBridge] 📎 Intentando conectar al player: %@", playerId);
    
    // Buscar el AVPlayer activo de expo-av
    dispatch_async(dispatch_get_main_queue(), ^{
        [self findAndAttachToExpoAVPlayer];
    });
}

RCT_EXPORT_METHOD(detach) {
    NSLog(@"[AudioTapBridge] 🔌 Desconectando tap");
    [[MTAudioTap sharedInstance] detach];
    
    if (_hasListeners) {
        [self sendEventWithName:@"onAudioTapDetached" body:@{}];
    }
}

RCT_EXPORT_METHOD(notifyPlayerItemReady:(NSDictionary *)playerInfo) {
    NSLog(@"[AudioTapBridge] 🔔 PlayerItem listo - buscando AVPlayer de expo-av");
    
    dispatch_async(dispatch_get_main_queue(), ^{
        // Pequeño delay para asegurar que expo-av haya creado el player
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.3 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            [self findAndAttachToExpoAVPlayer];
        });
    });
}

#pragma mark - Find expo-av Player

- (void)findAndAttachToExpoAVPlayer {
    NSLog(@"[AudioTapBridge] 🔍 Buscando AVPlayer de expo-av...");
    
    // Método 1: Buscar en todas las instancias de AVPlayer activas
    // expo-av usa AVPlayer internamente, lo buscamos usando KVO
    
    // Obtener todos los objetos AVPlayer registrados en la sesión de audio
    AVAudioSession *session = [AVAudioSession sharedInstance];
    
    // Buscar por reflection en el runtime
    AVPlayer *foundPlayer = [self findActiveAVPlayer];
    
    if (foundPlayer && foundPlayer.currentItem) {
        NSLog(@"[AudioTapBridge] ✅ AVPlayer encontrado!");
        [self attachTapToPlayer:foundPlayer];
    } else {
        NSLog(@"[AudioTapBridge] ⚠️ No se encontró AVPlayer activo");
        
        // Intentar con observer de cambios
        [self setupPlayerObserver];
    }
}

- (AVPlayer *)findActiveAVPlayer {
    // Buscar en las clases de expo-av usando runtime introspection
    Class exAVClass = NSClassFromString(@"EXAV");
    if (!exAVClass) {
        NSLog(@"[AudioTapBridge] ⚠️ Clase EXAV no encontrada");
        return nil;
    }
    
    // Alternativa: buscar AVPlayerLayer en la jerarquía de vistas
    UIWindow *keyWindow = nil;
    for (UIScene *scene in [UIApplication sharedApplication].connectedScenes) {
        if (scene.activationState == UISceneActivationStateForegroundActive &&
            [scene isKindOfClass:[UIWindowScene class]]) {
            UIWindowScene *windowScene = (UIWindowScene *)scene;
            for (UIWindow *window in windowScene.windows) {
                if (window.isKeyWindow) {
                    keyWindow = window;
                    break;
                }
            }
        }
    }
    
    if (keyWindow) {
        AVPlayer *player = [self findAVPlayerInView:keyWindow];
        if (player) return player;
    }
    
    return nil;
}

- (AVPlayer *)findAVPlayerInView:(UIView *)view {
    // Buscar AVPlayerLayer recursivamente
    if ([view.layer isKindOfClass:[AVPlayerLayer class]]) {
        AVPlayerLayer *playerLayer = (AVPlayerLayer *)view.layer;
        if (playerLayer.player) {
            return playerLayer.player;
        }
    }
    
    for (UIView *subview in view.subviews) {
        AVPlayer *player = [self findAVPlayerInView:subview];
        if (player) return player;
    }
    
    return nil;
}

- (void)setupPlayerObserver {
    // Observar cuando se crea un nuevo AVPlayerItem
    [[NSNotificationCenter defaultCenter] addObserverForName:AVPlayerItemNewAccessLogEntryNotification
                                                      object:nil
                                                       queue:[NSOperationQueue mainQueue]
                                                  usingBlock:^(NSNotification * _Nonnull note) {
        AVPlayerItem *item = note.object;
        if (item) {
            NSLog(@"[AudioTapBridge] 🔔 Nuevo AVPlayerItem detectado por log entry");
            [[MTAudioTap sharedInstance] attachToPlayerItem:item];
            
            if (self->_hasListeners) {
                [self sendEventWithName:@"onAudioTapAttached" body:@{}];
            }
        }
    }];
}

#pragma mark - Attach Tap

- (void)attachTapToPlayer:(AVPlayer *)player {
    if (!player) return;
    
    _currentPlayer = player;
    
    // Observar cambios en el currentItem
    [player addObserver:self
             forKeyPath:@"currentItem"
                options:NSKeyValueObservingOptionNew | NSKeyValueObservingOptionInitial
                context:nil];
    
    if (player.currentItem) {
        [[MTAudioTap sharedInstance] attachToPlayerItem:player.currentItem];
        
        if (_hasListeners) {
            [self sendEventWithName:@"onAudioTapAttached" body:@{}];
        }
    }
}

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary<NSKeyValueChangeKey,id> *)change
                       context:(void *)context {
    
    if ([keyPath isEqualToString:@"currentItem"]) {
        AVPlayerItem *newItem = change[NSKeyValueChangeNewKey];
        if (newItem && [newItem isKindOfClass:[AVPlayerItem class]]) {
            NSLog(@"[AudioTapBridge] 🔄 CurrentItem cambió - reconectando tap");
            [[MTAudioTap sharedInstance] attachToPlayerItem:newItem];
            
            if (_hasListeners) {
                [self sendEventWithName:@"onAudioTapAttached" body:@{}];
            }
        }
    }
}

- (void)connectToActivePlayer {
    [self findAndAttachToExpoAVPlayer];
}

@end
