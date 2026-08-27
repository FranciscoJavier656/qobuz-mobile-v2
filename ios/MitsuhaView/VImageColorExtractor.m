//
//  VImageColorExtractor.m
//  qobuzmobilev2
//
//  Extractor de colores usando vImage (Accelerate Framework)
//  para máxima eficiencia y precisión en la extracción de colores
//

#import "VImageColorExtractor.h"
#import <Accelerate/Accelerate.h>

#pragma mark - VImageColorPalette Implementation

@implementation VImageColorPalette

- (instancetype)init {
    self = [super init];
    if (self) {
        _dominantColor = [UIColor grayColor];
        _vibrantColor = [UIColor grayColor];
        _mutedColor = [UIColor grayColor];
        _lightColor = [UIColor whiteColor];
        _darkColor = [UIColor blackColor];
        _topColors = @[];
    }
    return self;
}

- (NSDictionary *)toDictionary {
    return @{
        @"dominant": [self hexStringFromColor:self.dominantColor],
        @"vibrant": [self hexStringFromColor:self.vibrantColor],
        @"muted": [self hexStringFromColor:self.mutedColor],
        @"light": [self hexStringFromColor:self.lightColor],
        @"dark": [self hexStringFromColor:self.darkColor],
        @"topColors": [self hexArrayFromColors:self.topColors]
    };
}

- (NSString *)hexStringFromColor:(UIColor *)color {
    CGFloat r, g, b, a;
    [color getRed:&r green:&g blue:&b alpha:&a];
    return [NSString stringWithFormat:@"#%02X%02X%02X",
            (int)(r * 255), (int)(g * 255), (int)(b * 255)];
}

- (NSArray<NSString *> *)hexArrayFromColors:(NSArray<UIColor *> *)colors {
    NSMutableArray *hexArray = [NSMutableArray arrayWithCapacity:colors.count];
    for (UIColor *color in colors) {
        [hexArray addObject:[self hexStringFromColor:color]];
    }
    return [hexArray copy];
}

@end

#pragma mark - Color Bucket for Histogram Analysis

typedef struct {
    CGFloat r, g, b;
    NSInteger count;
    CGFloat saturation;
    CGFloat brightness;
} ColorBucket;

#pragma mark - VImageColorExtractor Implementation

@implementation VImageColorExtractor

#pragma mark - Public Methods

+ (void)extractColorsFromImage:(UIImage *)image
                    completion:(void (^)(VImageColorPalette * _Nullable, NSError * _Nullable))completion {
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        VImageColorPalette *palette = [self extractColorsFromImageSync:image];
        dispatch_async(dispatch_get_main_queue(), ^{
            if (palette) {
                completion(palette, nil);
            } else {
                NSError *error = [NSError errorWithDomain:@"VImageColorExtractor"
                                                     code:-1
                                                 userInfo:@{NSLocalizedDescriptionKey: @"Failed to extract colors"}];
                completion(nil, error);
            }
        });
    });
}

+ (VImageColorPalette * _Nullable)extractColorsFromImageSync:(UIImage *)image {
    if (!image) return nil;
    
    VImageColorPalette *palette = [[VImageColorPalette alloc] init];
    
    // Escalar a 50x50 para procesamiento ultra-rápido (suficiente para colores)
    UIImage *scaledImage = [self scaleImage:image toSize:CGSizeMake(50, 50)];
    if (!scaledImage) scaledImage = image;
    
    // Extraer colores principales usando histograma vImage
    NSArray<UIColor *> *topColors = [self extractTopColors:scaledImage count:8];
    palette.topColors = topColors;
    
    if (topColors.count > 0) {
        // Clasificar colores por características
        UIColor *mostVibrant = nil;
        UIColor *mostMuted = nil;
        UIColor *lightest = nil;
        UIColor *darkest = nil;
        UIColor *dominant = topColors.firstObject;
        
        CGFloat maxSaturation = 0;
        CGFloat minSaturation = 1;
        CGFloat maxBrightness = 0;
        CGFloat minBrightness = 1;
        
        for (UIColor *color in topColors) {
            CGFloat h, s, b, a;
            [color getHue:&h saturation:&s brightness:&b alpha:&a];
            
            // Más vibrante (mayor saturación con brillo medio)
            CGFloat vibrancy = s * (1 - fabs(b - 0.5) * 2);
            if (vibrancy > maxSaturation && s > 0.3) {
                maxSaturation = vibrancy;
                mostVibrant = color;
            }
            
            // Más apagado (menor saturación)
            if (s < minSaturation && s > 0.05) {
                minSaturation = s;
                mostMuted = color;
            }
            
            // Más claro
            if (b > maxBrightness) {
                maxBrightness = b;
                lightest = color;
            }
            
            // Más oscuro
            if (b < minBrightness) {
                minBrightness = b;
                darkest = color;
            }
        }
        
        palette.dominantColor = dominant ?: [UIColor grayColor];
        palette.vibrantColor = mostVibrant ?: dominant ?: [UIColor grayColor];
        palette.mutedColor = mostMuted ?: dominant ?: [UIColor grayColor];
        palette.lightColor = lightest ?: [UIColor whiteColor];
        palette.darkColor = darkest ?: [UIColor blackColor];
    }
    
    return palette;
}

+ (UIColor *)dominantColorFromImage:(UIImage *)image {
    NSArray<UIColor *> *colors = [self extractTopColors:image count:1];
    return colors.firstObject ?: [UIColor grayColor];
}

+ (UIColor *)averageColorFromImage:(UIImage *)image {
    if (!image) return [UIColor grayColor];
    
    CGImageRef cgImage = image.CGImage;
    if (!cgImage) return [UIColor grayColor];
    
    // Configurar buffer de entrada
    vImage_Buffer inputBuffer;
    vImage_CGImageFormat format = {
        .bitsPerComponent = 8,
        .bitsPerPixel = 32,
        .colorSpace = NULL, // Usar espacio de color de la imagen
        .bitmapInfo = kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big,
        .version = 0,
        .decode = NULL,
        .renderingIntent = kCGRenderingIntentDefault
    };
    
    vImage_Error error = vImageBuffer_InitWithCGImage(&inputBuffer, &format, NULL, cgImage, kvImageNoFlags);
    if (error != kvImageNoError) {
        return [UIColor grayColor];
    }
    
    // Escalar a 1x1 píxel para obtener color promedio
    vImage_Buffer outputBuffer;
    outputBuffer.width = 1;
    outputBuffer.height = 1;
    outputBuffer.rowBytes = 4;
    outputBuffer.data = malloc(4);
    
    if (!outputBuffer.data) {
        free(inputBuffer.data);
        return [UIColor grayColor];
    }
    
    error = vImageScale_ARGB8888(&inputBuffer, &outputBuffer, NULL, kvImageHighQualityResampling);
    
    UIColor *result = [UIColor grayColor];
    if (error == kvImageNoError) {
        uint8_t *pixel = (uint8_t *)outputBuffer.data;
        result = [UIColor colorWithRed:pixel[0] / 255.0
                                 green:pixel[1] / 255.0
                                  blue:pixel[2] / 255.0
                                 alpha:1.0];
    }
    
    free(inputBuffer.data);
    free(outputBuffer.data);
    
    return result;
}

+ (NSArray<UIColor *> *)extractTopColors:(UIImage *)image count:(NSInteger)numberOfColors {
    if (!image || numberOfColors <= 0) return @[];
    
    CGImageRef cgImage = image.CGImage;
    if (!cgImage) return @[];
    
    // Escalar a 32x32 para máxima velocidad
    UIImage *scaledImage = [self scaleImage:image toSize:CGSizeMake(32, 32)];
    cgImage = scaledImage.CGImage;
    if (!cgImage) cgImage = image.CGImage;
    
    // Configurar buffer vImage
    vImage_Buffer buffer;
    vImage_CGImageFormat format = {
        .bitsPerComponent = 8,
        .bitsPerPixel = 32,
        .colorSpace = CGColorSpaceCreateDeviceRGB(),
        .bitmapInfo = kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big,
        .version = 0,
        .decode = NULL,
        .renderingIntent = kCGRenderingIntentDefault
    };
    
    vImage_Error error = vImageBuffer_InitWithCGImage(&buffer, &format, NULL, cgImage, kvImageNoFlags);
    CGColorSpaceRelease(format.colorSpace);
    
    if (error != kvImageNoError) {
        return @[];
    }
    
    // Calcular histogramas RGB usando vImage
    vImagePixelCount redHist[256] = {0};
    vImagePixelCount greenHist[256] = {0};
    vImagePixelCount blueHist[256] = {0};
    vImagePixelCount alphaHist[256] = {0};
    
    vImagePixelCount *histograms[4] = {redHist, greenHist, blueHist, alphaHist};
    
    error = vImageHistogramCalculation_ARGB8888(&buffer, histograms, kvImageNoFlags);
    
    if (error != kvImageNoError) {
        free(buffer.data);
        return @[];
    }
    
    // Usar cuantización de color para encontrar colores dominantes
    NSArray<UIColor *> *colors = [self quantizeColorsFromBuffer:&buffer
                                                   numberOfColors:numberOfColors];
    
    free(buffer.data);
    
    return colors;
}

#pragma mark - Private Methods

+ (UIImage *)scaleImage:(UIImage *)image toSize:(CGSize)size {
    if (!image) return nil;
    
    CGImageRef cgImage = image.CGImage;
    if (!cgImage) return nil;
    
    vImage_Buffer sourceBuffer;
    vImage_CGImageFormat format = {
        .bitsPerComponent = 8,
        .bitsPerPixel = 32,
        .colorSpace = CGColorSpaceCreateDeviceRGB(),
        .bitmapInfo = kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big,
        .version = 0,
        .decode = NULL,
        .renderingIntent = kCGRenderingIntentDefault
    };
    
    vImage_Error error = vImageBuffer_InitWithCGImage(&sourceBuffer, &format, NULL, cgImage, kvImageNoFlags);
    
    if (error != kvImageNoError) {
        CGColorSpaceRelease(format.colorSpace);
        return nil;
    }
    
    vImage_Buffer destBuffer;
    destBuffer.width = (vImagePixelCount)size.width;
    destBuffer.height = (vImagePixelCount)size.height;
    destBuffer.rowBytes = (size_t)size.width * 4;
    destBuffer.data = malloc(destBuffer.rowBytes * (size_t)size.height);
    
    if (!destBuffer.data) {
        free(sourceBuffer.data);
        CGColorSpaceRelease(format.colorSpace);
        return nil;
    }
    
    error = vImageScale_ARGB8888(&sourceBuffer, &destBuffer, NULL, kvImageHighQualityResampling);
    
    UIImage *result = nil;
    if (error == kvImageNoError) {
        CGImageRef scaledImage = vImageCreateCGImageFromBuffer(&destBuffer, &format, NULL, NULL, kvImageNoFlags, &error);
        if (scaledImage) {
            result = [UIImage imageWithCGImage:scaledImage];
            CGImageRelease(scaledImage);
        }
    }
    
    free(sourceBuffer.data);
    free(destBuffer.data);
    CGColorSpaceRelease(format.colorSpace);
    
    return result;
}

+ (NSArray<UIColor *> *)quantizeColorsFromBuffer:(vImage_Buffer *)buffer numberOfColors:(NSInteger)count {
    if (!buffer || !buffer->data) return @[];
    
    // Usar menos cubos para mayor velocidad: 16 niveles = 4096 cubos total
    const int bucketSize = 16;
    const int bucketsPerChannel = 256 / bucketSize; // 16
    const int totalBuckets = bucketsPerChannel * bucketsPerChannel * bucketsPerChannel; // 4096
    
    // Crear cubos de color
    ColorBucket *buckets = calloc(totalBuckets, sizeof(ColorBucket));
    if (!buckets) return @[];
    
    uint8_t *pixels = (uint8_t *)buffer->data;
    size_t totalPixels = buffer->width * buffer->height;
    
    // Llenar cubos con píxeles
    for (size_t i = 0; i < totalPixels; i++) {
        size_t offset = i * 4;
        uint8_t r = pixels[offset];
        uint8_t g = pixels[offset + 1];
        uint8_t b = pixels[offset + 2];
        uint8_t a = pixels[offset + 3];
        
        // Ignorar píxeles transparentes
        if (a < 128) continue;
        
        int rBucket = r / bucketSize;
        int gBucket = g / bucketSize;
        int bBucket = b / bucketSize;
        
        int bucketIndex = rBucket * bucketsPerChannel * bucketsPerChannel +
                          gBucket * bucketsPerChannel + bBucket;
        
        if (bucketIndex >= 0 && bucketIndex < totalBuckets) {
            buckets[bucketIndex].r += r;
            buckets[bucketIndex].g += g;
            buckets[bucketIndex].b += b;
            buckets[bucketIndex].count++;
        }
    }
    
    // Crear array de índices de cubos no vacíos para ordenar (MUCHO más rápido)
    int *nonEmptyIndices = malloc(totalBuckets * sizeof(int));
    CGFloat *scores = malloc(totalBuckets * sizeof(CGFloat));
    int nonEmptyCount = 0;
    
    for (int i = 0; i < totalBuckets; i++) {
        if (buckets[i].count > 0) {
            // Calcular color promedio
            buckets[i].r /= buckets[i].count;
            buckets[i].g /= buckets[i].count;
            buckets[i].b /= buckets[i].count;
            
            // Calcular saturación
            CGFloat maxC = MAX(MAX(buckets[i].r, buckets[i].g), buckets[i].b);
            CGFloat minC = MIN(MIN(buckets[i].r, buckets[i].g), buckets[i].b);
            buckets[i].saturation = (maxC > 0) ? (maxC - minC) / maxC : 0;
            
            // Score = popularidad * (0.5 + saturación)
            scores[nonEmptyCount] = buckets[i].count * (0.5 + buckets[i].saturation * 0.5);
            nonEmptyIndices[nonEmptyCount] = i;
            nonEmptyCount++;
        }
    }
    
    // Ordenar solo los cubos no vacíos (típicamente < 500 cubos en una imagen)
    // Usar selection sort parcial - solo necesitamos los top N
    NSInteger colorsNeeded = MIN(count * 3, nonEmptyCount); // Extra para filtrar similares
    
    for (int i = 0; i < colorsNeeded && i < nonEmptyCount - 1; i++) {
        int maxIdx = i;
        for (int j = i + 1; j < nonEmptyCount; j++) {
            if (scores[j] > scores[maxIdx]) {
                maxIdx = j;
            }
        }
        if (maxIdx != i) {
            // Swap
            int tempIdx = nonEmptyIndices[i];
            nonEmptyIndices[i] = nonEmptyIndices[maxIdx];
            nonEmptyIndices[maxIdx] = tempIdx;
            
            CGFloat tempScore = scores[i];
            scores[i] = scores[maxIdx];
            scores[maxIdx] = tempScore;
        }
    }
    
    // Extraer los N colores principales
    NSMutableArray<UIColor *> *colors = [NSMutableArray arrayWithCapacity:count];
    
    for (int i = 0; i < colorsNeeded && (NSInteger)colors.count < count; i++) {
        int bucketIdx = nonEmptyIndices[i];
        ColorBucket *bucket = &buckets[bucketIdx];
        
        UIColor *newColor = [UIColor colorWithRed:bucket->r / 255.0
                                            green:bucket->g / 255.0
                                             blue:bucket->b / 255.0
                                            alpha:1.0];
        
        // Verificar diferencia con colores existentes
        BOOL isDifferent = YES;
        for (UIColor *existingColor in colors) {
            if ([self colorDistance:newColor to:existingColor] < 0.15) {
                isDifferent = NO;
                break;
            }
        }
        
        if (isDifferent) {
            [colors addObject:newColor];
        }
    }
    
    free(nonEmptyIndices);
    free(scores);
    free(buckets);
    
    return [colors copy];
}

+ (CGFloat)colorDistance:(UIColor *)color1 to:(UIColor *)color2 {
    CGFloat r1, g1, b1, a1;
    CGFloat r2, g2, b2, a2;
    
    [color1 getRed:&r1 green:&g1 blue:&b1 alpha:&a1];
    [color2 getRed:&r2 green:&g2 blue:&b2 alpha:&a2];
    
    CGFloat dr = r1 - r2;
    CGFloat dg = g1 - g2;
    CGFloat db = b1 - b2;
    
    return sqrt(dr * dr + dg * dg + db * db);
}

@end
