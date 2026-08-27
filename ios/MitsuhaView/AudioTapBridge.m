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
        [self setupPlayerObserver];
        NSLog(@"[AudioTapBridge] 🎵 Inicializado - Escuchando cambios de player de forma global");
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

- (void)setupPlayerObserver {
    // Observar cuando se crea un nuevo AVPlayerItem o cambia su estado
    
    // NewAccessLogEntry
    [[NSNotificationCenter defaultCenter] addObserverForName:AVPlayerItemNewAccessLogEntryNotification
                                                      object:nil
                                                       queue:[NSOperationQueue mainQueue]
                                                  usingBlock:^(NSNotification * _Nonnull note) {
        AVPlayerItem *item = note.object;
        if ([item isKindOfClass:[AVPlayerItem class]]) {
            NSLog(@"[AudioTapBridge] 🔔 AVPlayerItem detectado (AccessLog)");
            [[MTAudioTap sharedInstance] attachToPlayerItem:item];
            if (self->_hasListeners) [self sendEventWithName:@"onAudioTapAttached" body:@{}];
        }
    }];
    
    // TimeJumped (Play/Seek)
    [[NSNotificationCenter defaultCenter] addObserverForName:AVPlayerItemTimeJumpedNotification
                                                      object:nil
                                                       queue:[NSOperationQueue mainQueue]
                                                  usingBlock:^(NSNotification * _Nonnull note) {
        AVPlayerItem *item = note.object;
        if ([item isKindOfClass:[AVPlayerItem class]]) {
            NSLog(@"[AudioTapBridge] 🔔 AVPlayerItem detectado (TimeJumped)");
            [[MTAudioTap sharedInstance] attachToPlayerItem:item];
            if (self->_hasListeners) [self sendEventWithName:@"onAudioTapAttached" body:@{}];
        }
    }];
    
    // DidPlayToEndTime
    [[NSNotificationCenter defaultCenter] addObserverForName:AVPlayerItemDidPlayToEndTimeNotification
                                                      object:nil
                                                       queue:[NSOperationQueue mainQueue]
                                                  usingBlock:^(NSNotification * _Nonnull note) {
        NSLog(@"[AudioTapBridge] 🔔 AVPlayerItem terminó");
    }];
}

#pragma mark - React Native Methods

RCT_EXPORT_METHOD(attachToPlayer:(NSString *)playerId) {
    NSLog(@"[AudioTapBridge] 📎 attachToPlayer ignorado: usando observadores globales");
}

RCT_EXPORT_METHOD(detach) {
    NSLog(@"[AudioTapBridge] 🔌 Desconectando tap");
    [[MTAudioTap sharedInstance] detach];
    
    if (_hasListeners) {
        [self sendEventWithName:@"onAudioTapDetached" body:@{}];
    }
}

RCT_EXPORT_METHOD(notifyPlayerItemReady:(NSDictionary *)playerInfo) {
    NSLog(@"[AudioTapBridge] 🔔 notifyPlayerItemReady - esperando a los eventos nativos");
}

#pragma mark - Find expo-av Player

- (void)findAndAttachToExpoAVPlayer {
    // Obsoleto: Usamos observadores globales en su lugar
}

- (AVPlayer *)findActiveAVPlayer {
    return nil;
}

@end
