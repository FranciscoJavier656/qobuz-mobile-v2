//
//  VImageColorExtractor.h
//  qobuzmobilev2
//
//  Extractor de colores usando vImage (Accelerate Framework)
//  para máxima eficiencia y precisión
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface VImageColorPalette : NSObject

@property (nonatomic, strong) UIColor *dominantColor;
@property (nonatomic, strong) UIColor *vibrantColor;
@property (nonatomic, strong) UIColor *mutedColor;
@property (nonatomic, strong) UIColor *lightColor;
@property (nonatomic, strong) UIColor *darkColor;
@property (nonatomic, strong) NSArray<UIColor *> *topColors;

- (NSDictionary *)toDictionary;

@end

@interface VImageColorExtractor : NSObject

/**
 * Extrae la paleta de colores de una imagen usando vImage
 * @param image La imagen de la que extraer colores
 * @param completion Callback con la paleta de colores
 */
+ (void)extractColorsFromImage:(UIImage *)image
                    completion:(void (^)(VImageColorPalette * _Nullable palette, NSError * _Nullable error))completion;

/**
 * Extrae colores de forma síncrona (para uso en threads background)
 */
+ (VImageColorPalette * _Nullable)extractColorsFromImageSync:(UIImage *)image;

/**
 * Extrae el color dominante simple usando vImage histogram
 */
+ (UIColor *)dominantColorFromImage:(UIImage *)image;

/**
 * Extrae el color promedio usando vImage (muy rápido)
 */
+ (UIColor *)averageColorFromImage:(UIImage *)image;

/**
 * Extrae colores usando K-means clustering acelerado con vImage
 * @param image La imagen fuente
 * @param numberOfColors Número de colores a extraer (típicamente 5-8)
 */
+ (NSArray<UIColor *> *)extractTopColors:(UIImage *)image count:(NSInteger)numberOfColors;

@end

NS_ASSUME_NONNULL_END
