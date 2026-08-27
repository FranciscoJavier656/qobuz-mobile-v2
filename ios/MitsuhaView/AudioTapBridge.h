/**
 * AudioTapBridge.h
 * Puente de React Native para conectar MTAudioTap con expo-av
 * 
 * Este módulo expone métodos a JavaScript para:
 * 1. Notificar cuando hay un nuevo AVPlayerItem
 * 2. Conectar/desconectar el tap de audio
 */

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

NS_ASSUME_NONNULL_BEGIN

@interface AudioTapBridge : RCTEventEmitter <RCTBridgeModule>

/**
 * Conecta el tap al player actual de expo-av
 * Busca automáticamente el AVPlayer activo
 */
- (void)connectToActivePlayer;

@end

NS_ASSUME_NONNULL_END
