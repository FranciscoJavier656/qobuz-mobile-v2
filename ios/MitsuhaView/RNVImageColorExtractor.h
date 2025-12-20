//
//  RNVImageColorExtractor.h
//  qobuzmobilev2
//
//  Módulo React Native para extracción de colores usando vImage
//  + Extracción de artwork desde audio streams via AVFoundation
//

#import <React/RCTBridgeModule.h>

@interface RNVImageColorExtractor : NSObject <RCTBridgeModule>

// Extraer colores del artwork embebido en un archivo de audio
+ (void)extractColorsFromAudioURL:(NSString *)audioURL
                       completion:(void (^)(NSDictionary *colors, NSError *error))completion;

@end
