/**
 * MTAudioTap.h
 * Captura audio REAL del AVPlayer usando MTAudioProcessingTap
 * 
 * MTAudioProcessingTap intercepta el audio directamente del pipeline
 * de AVPlayer, permitiendo procesar el audio que realmente se reproduce
 */

#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <MediaToolbox/MediaToolbox.h>
#import <Accelerate/Accelerate.h>

NS_ASSUME_NONNULL_BEGIN

@protocol MTAudioTapDelegate <NSObject>
- (void)audioTapDidReceiveFFTData:(float *)fftData length:(int)length;
@end

@interface MTAudioTap : NSObject

@property (nonatomic, weak) id<MTAudioTapDelegate> delegate;
@property (nonatomic, assign, readonly) BOOL isAttached;

+ (instancetype)sharedInstance;

/**
 * Conecta el tap al AVPlayerItem actual
 * @param playerItem El AVPlayerItem de expo-av
 */
- (void)attachToPlayerItem:(AVPlayerItem *)playerItem;

/**
 * Desconecta el tap del player actual
 */
- (void)detach;

/**
 * Notifica que hay un nuevo AVPlayerItem disponible
 * Llamar desde JavaScript cuando cambia la pista
 */
- (void)playerItemDidChange:(AVPlayerItem *)playerItem;

@end

NS_ASSUME_NONNULL_END
