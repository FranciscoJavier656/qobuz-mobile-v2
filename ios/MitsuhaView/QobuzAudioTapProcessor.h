/**
 * QobuzAudioTapProcessor.h
 * Captura audio real usando AVAudioEngine para FFT
 * Renombrado de AudioTapProcessor para evitar conflicto con expo-audio
 */

#import <Foundation/Foundation.h>
#import <AVFoundation/AVFoundation.h>
#import <Accelerate/Accelerate.h>

@protocol QobuzAudioTapProcessorDelegate <NSObject>
- (void)audioTapDidReceiveBuffer:(float *)buffer length:(int)length;
@end

@interface QobuzAudioTapProcessor : NSObject

@property (nonatomic, weak) id<QobuzAudioTapProcessorDelegate> delegate;
@property (nonatomic, assign) BOOL isRunning;

+ (instancetype)sharedInstance;

- (void)startCapturing;
- (void)stopCapturing;

// FFT Processing
- (void)processAudioBuffer:(AVAudioPCMBuffer *)buffer;

@end
