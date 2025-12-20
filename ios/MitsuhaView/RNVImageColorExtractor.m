//
//  RNVImageColorExtractor.m
//  qobuzmobilev2
//
//  Extracción de colores ULTRA-RÁPIDA:
//  1. AVFoundation - artwork embebido en audio (sin descarga extra)
//  2. vImage - procesamiento acelerado por hardware
//  3. Triple caché - colores, imágenes, HTTP
//

#import "RNVImageColorExtractor.h"
#import "VImageColorExtractor.h"
#import <React/RCTLog.h>
#import <UIKit/UIKit.h>
#import <AVFoundation/AVFoundation.h>
#import <AudioToolbox/AudioToolbox.h>

// Caché global de imágenes para evitar re-descargas
static NSCache<NSString *, UIImage *> *imageCache = nil;
// Caché de colores extraídos (por URL de audio o imagen)
static NSCache<NSString *, NSDictionary *> *colorResultCache = nil;
// Sesión URL con caché agresivo
static NSURLSession *cachedURLSession = nil;

@implementation RNVImageColorExtractor

RCT_EXPORT_MODULE(VImageColorExtractor);

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

+ (void)initialize {
    if (self == [RNVImageColorExtractor class]) {
        // Caché de imágenes en memoria
        imageCache = [[NSCache alloc] init];
        imageCache.countLimit = 100;
        imageCache.totalCostLimit = 100 * 1024 * 1024; // 100MB
        
        // Caché de colores
        colorResultCache = [[NSCache alloc] init];
        colorResultCache.countLimit = 500;
        
        // Configurar NSURLSession con caché agresivo
        NSURLSessionConfiguration *config = [NSURLSessionConfiguration defaultSessionConfiguration];
        config.requestCachePolicy = NSURLRequestReturnCacheDataElseLoad;
        config.timeoutIntervalForRequest = 10.0;
        config.timeoutIntervalForResource = 15.0;
        
        // Caché de disco de 50MB
        NSURLCache *urlCache = [[NSURLCache alloc] initWithMemoryCapacity:20 * 1024 * 1024
                                                             diskCapacity:50 * 1024 * 1024
                                                                 diskPath:@"ImageColorCache"];
        config.URLCache = urlCache;
        
        cachedURLSession = [NSURLSession sessionWithConfiguration:config];
        
        NSLog(@"[RNVImageColorExtractor] 🚀 Initialized with AVFoundation + vImage!");
    }
}

- (instancetype)init {
    self = [super init];
    if (self) {
        NSLog(@"[RNVImageColorExtractor] ✅ Module ready!");
    }
    return self;
}

#pragma mark - Métodos públicos estáticos

// Extraer colores del artwork embebido en archivo de audio
+ (void)extractColorsFromAudioURL:(NSString *)audioURL
                       completion:(void (^)(NSDictionary *colors, NSError *error))completion
{
    if (!audioURL || audioURL.length == 0) {
        completion(nil, [NSError errorWithDomain:@"VImageColorExtractor" code:-1 userInfo:@{NSLocalizedDescriptionKey: @"Audio URL is empty"}]);
        return;
    }
    
    // Verificar caché primero
    NSDictionary *cached = [colorResultCache objectForKey:audioURL];
    if (cached) {
        NSLog(@"[RNVImageColorExtractor] ⚡ AUDIO COLOR CACHE HIT!");
        completion(cached, nil);
        return;
    }
    
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        CFAbsoluteTime startTime = CFAbsoluteTimeGetCurrent();
        
        NSURL *url = [NSURL URLWithString:audioURL];
        AVAsset *asset = [AVAsset assetWithURL:url];
        
        // Cargar metadatos de forma asíncrona
        [asset loadValuesAsynchronouslyForKeys:@[@"commonMetadata"] completionHandler:^{
            NSError *error = nil;
            AVKeyValueStatus status = [asset statusOfValueForKey:@"commonMetadata" error:&error];
            
            if (status != AVKeyValueStatusLoaded) {
                NSLog(@"[RNVImageColorExtractor] ⚠️ No se pudo cargar metadata: %@", error);
                completion(nil, error);
                return;
            }
            
            // Buscar artwork en metadata
            NSArray *metadata = [asset commonMetadata];
            UIImage *artworkImage = nil;
            
            for (AVMetadataItem *item in metadata) {
                if ([item.commonKey isEqualToString:AVMetadataCommonKeyArtwork]) {
                    NSData *imageData = nil;
                    
                    if ([item.value isKindOfClass:[NSData class]]) {
                        imageData = (NSData *)item.value;
                    } else if ([item.value isKindOfClass:[NSDictionary class]]) {
                        NSDictionary *dict = (NSDictionary *)item.value;
                        imageData = dict[@"data"];
                    }
                    
                    if (imageData) {
                        artworkImage = [UIImage imageWithData:imageData];
                        break;
                    }
                }
            }
            
            if (!artworkImage) {
                NSLog(@"[RNVImageColorExtractor] ⚠️ No artwork found in audio metadata");
                completion(nil, [NSError errorWithDomain:@"VImageColorExtractor" code:-2 userInfo:@{NSLocalizedDescriptionKey: @"No artwork in audio"}]);
                return;
            }
            
            CFAbsoluteTime loadTime = CFAbsoluteTimeGetCurrent() - startTime;
            NSLog(@"[RNVImageColorExtractor] 🎵 Artwork extraído de audio en %.0fms (%.0fx%.0f)", loadTime * 1000, artworkImage.size.width, artworkImage.size.height);
            
            // Extraer colores con vImage
            [VImageColorExtractor extractColorsFromImage:artworkImage completion:^(VImageColorPalette *palette, NSError *extractError) {
                if (extractError || !palette) {
                    completion(nil, extractError);
                    return;
                }
                
                NSDictionary *result = [palette toDictionary];
                [colorResultCache setObject:result forKey:audioURL];
                
                CFAbsoluteTime totalTime = CFAbsoluteTimeGetCurrent() - startTime;
                NSLog(@"[RNVImageColorExtractor] ✅ AUDIO COLORS DONE in %.0fms! %@", totalTime * 1000, result[@"dominant"]);
                
                completion(result, nil);
            }];
        }];
    });
}

#pragma mark - React Native Methods

// Método de prueba simple sin promesas
RCT_EXPORT_METHOD(ping) {
    NSLog(@"[RNVImageColorExtractor] 🏓 PING received!");
}

// Extraer colores de artwork embebido en audio stream
RCT_REMAP_METHOD(extractColorsFromAudio,
                 extractColorsFromAudioWithUri:(NSString *)audioUri
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[RNVImageColorExtractor] 🎵 extractColorsFromAudio: ...%@", [audioUri substringFromIndex:MAX(0, (NSInteger)audioUri.length - 40)]);
    
    [RNVImageColorExtractor extractColorsFromAudioURL:audioUri completion:^(NSDictionary *colors, NSError *error) {
        if (error || !colors) {
            reject(@"AUDIO_EXTRACT_ERROR", error.localizedDescription ?: @"Failed to extract colors from audio", error);
        } else {
            resolve(colors);
        }
    }];
}

// Usar RCT_REMAP_METHOD para promesas - nombre JS : nombre interno
RCT_REMAP_METHOD(extractColors,
                 extractColorsWithUri:(NSString *)imageUri
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)
{
    CFAbsoluteTime startTime = CFAbsoluteTimeGetCurrent();
    NSLog(@"[RNVImageColorExtractor] 🎨 extractColors: ...%@", [imageUri substringFromIndex:MAX(0, (NSInteger)imageUri.length - 35)]);
    
    if (!imageUri || imageUri.length == 0) {
        reject(@"INVALID_URI", @"Image URI is empty", nil);
        return;
    }
    
    // 1. Verificar caché de colores primero (instantáneo)
    NSDictionary *cachedColors = [colorResultCache objectForKey:imageUri];
    if (cachedColors) {
        NSLog(@"[RNVImageColorExtractor] ⚡ COLOR CACHE HIT! (0ms)");
        resolve(cachedColors);
        return;
    }
    
    // 2. Verificar caché de imagen en memoria
    UIImage *cachedImage = [imageCache objectForKey:imageUri];
    if (cachedImage) {
        NSLog(@"[RNVImageColorExtractor] 📦 IMAGE CACHE HIT!");
        [self extractColorsFromCachedImage:cachedImage forUri:imageUri startTime:startTime resolve:resolve reject:reject];
        return;
    }
    
    // 3. Descargar imagen
    [self loadImageFromUri:imageUri completion:^(UIImage *image, NSError *error) {
        if (error || !image) {
            NSLog(@"[RNVImageColorExtractor] ❌ Failed to load image: %@", error);
            reject(@"IMAGE_LOAD_ERROR", @"Failed to load image", error);
            return;
        }
        
        // Guardar en caché de imágenes
        [imageCache setObject:image forKey:imageUri cost:image.size.width * image.size.height * 4];
        
        CFAbsoluteTime downloadTime = CFAbsoluteTimeGetCurrent() - startTime;
        NSLog(@"[RNVImageColorExtractor] ✅ Downloaded (%.0fx%.0f) in %.0fms", image.size.width, image.size.height, downloadTime * 1000);
        [self extractColorsFromCachedImage:image forUri:imageUri startTime:startTime resolve:resolve reject:reject];
    }];
}

// Helper para extraer colores de imagen cacheada
- (void)extractColorsFromCachedImage:(UIImage *)image
                              forUri:(NSString *)imageUri
                           startTime:(CFAbsoluteTime)startTime
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
    [VImageColorExtractor extractColorsFromImage:image completion:^(VImageColorPalette *palette, NSError *extractError) {
        if (extractError || !palette) {
            reject(@"EXTRACTION_ERROR", @"Failed to extract colors", extractError);
            return;
        }
        
        NSDictionary *result = [palette toDictionary];
        
        // Guardar en caché de colores
        [colorResultCache setObject:result forKey:imageUri];
        
        CFAbsoluteTime totalTime = CFAbsoluteTimeGetCurrent() - startTime;
        NSLog(@"[RNVImageColorExtractor] ✅ DONE in %.0fms! Dominant: %@", totalTime * 1000, result[@"dominant"]);
        resolve(result);
    }];
}

RCT_REMAP_METHOD(getDominantColor,
                 getDominantColorWithUri:(NSString *)imageUri
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[RNVImageColorExtractor] 🎨 getDominantColor called");
    
    if (!imageUri || imageUri.length == 0) {
        reject(@"INVALID_URI", @"Image URI is empty", nil);
        return;
    }
    
    [self loadImageFromUri:imageUri completion:^(UIImage *image, NSError *error) {
        if (error || !image) {
            reject(@"IMAGE_LOAD_ERROR", @"Failed to load image", error);
            return;
        }
        
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
            UIColor *dominantColor = [VImageColorExtractor dominantColorFromImage:image];
            
            CGFloat r, g, b, a;
            [dominantColor getRed:&r green:&g blue:&b alpha:&a];
            
            NSString *hexColor = [NSString stringWithFormat:@"#%02X%02X%02X",
                                  (int)(r * 255), (int)(g * 255), (int)(b * 255)];
            
            NSDictionary *result = @{
                @"hex": hexColor,
                @"r": @(r * 255),
                @"g": @(g * 255),
                @"b": @(b * 255)
            };
            
            dispatch_async(dispatch_get_main_queue(), ^{
                resolve(result);
            });
        });
    }];
}

RCT_REMAP_METHOD(getAverageColor,
                 getAverageColorWithUri:(NSString *)imageUri
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[RNVImageColorExtractor] 🎨 getAverageColor called");
    
    if (!imageUri || imageUri.length == 0) {
        reject(@"INVALID_URI", @"Image URI is empty", nil);
        return;
    }
    
    [self loadImageFromUri:imageUri completion:^(UIImage *image, NSError *error) {
        if (error || !image) {
            reject(@"IMAGE_LOAD_ERROR", @"Failed to load image", error);
            return;
        }
        
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
            UIColor *avgColor = [VImageColorExtractor averageColorFromImage:image];
            
            CGFloat r, g, b, a;
            [avgColor getRed:&r green:&g blue:&b alpha:&a];
            
            NSString *hexColor = [NSString stringWithFormat:@"#%02X%02X%02X",
                                  (int)(r * 255), (int)(g * 255), (int)(b * 255)];
            
            NSDictionary *result = @{
                @"hex": hexColor,
                @"r": @(r * 255),
                @"g": @(g * 255),
                @"b": @(b * 255)
            };
            
            dispatch_async(dispatch_get_main_queue(), ^{
                resolve(result);
            });
        });
    }];
}

RCT_REMAP_METHOD(getTopColors,
                 getTopColorsWithUri:(NSString *)imageUri
                 count:(nonnull NSNumber *)count
                 withResolver:(RCTPromiseResolveBlock)resolve
                 withRejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[RNVImageColorExtractor] 🎨 getTopColors called");
    
    if (!imageUri || imageUri.length == 0) {
        reject(@"INVALID_URI", @"Image URI is empty", nil);
        return;
    }
    
    NSInteger colorCount = [count integerValue];
    if (colorCount <= 0) colorCount = 5;
    if (colorCount > 20) colorCount = 20;
    
    [self loadImageFromUri:imageUri completion:^(UIImage *image, NSError *error) {
        if (error || !image) {
            reject(@"IMAGE_LOAD_ERROR", @"Failed to load image", error);
            return;
        }
        
        dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
            NSArray<UIColor *> *colors = [VImageColorExtractor extractTopColors:image count:colorCount];
            
            NSMutableArray<NSDictionary *> *colorDicts = [NSMutableArray arrayWithCapacity:colors.count];
            
            for (UIColor *color in colors) {
                CGFloat r, g, b, a;
                [color getRed:&r green:&g blue:&b alpha:&a];
                
                NSString *hexColor = [NSString stringWithFormat:@"#%02X%02X%02X",
                                      (int)(r * 255), (int)(g * 255), (int)(b * 255)];
                
                [colorDicts addObject:@{
                    @"hex": hexColor,
                    @"r": @(r * 255),
                    @"g": @(g * 255),
                    @"b": @(b * 255)
                }];
            }
            
            dispatch_async(dispatch_get_main_queue(), ^{
                resolve(colorDicts);
            });
        });
    }];
}

#pragma mark - Helper Methods

- (void)loadImageFromUri:(NSString *)imageUri
              completion:(void (^)(UIImage *image, NSError *error))completion
{
    if (!imageUri || imageUri.length == 0) {
        NSError *error = [NSError errorWithDomain:@"RNVImageColorExtractor"
                                             code:-1
                                         userInfo:@{NSLocalizedDescriptionKey: @"Image URI is empty"}];
        completion(nil, error);
        return;
    }
    
    // Si es una URL remota - usar sesión con caché
    if ([imageUri hasPrefix:@"http://"] || [imageUri hasPrefix:@"https://"]) {
        NSURL *url = [NSURL URLWithString:imageUri];
        
        // Usar la sesión con caché configurado
        NSURLSessionDataTask *task = [cachedURLSession dataTaskWithURL:url completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
            if (error || !data) {
                completion(nil, error);
                return;
            }
            
            // Crear imagen en background thread
            UIImage *image = [UIImage imageWithData:data];
            completion(image, nil);
        }];
        
        [task resume];
        return;
    }
    
    // Si es una URI de archivo local - cargar en background
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_HIGH, 0), ^{
        NSString *filePath = imageUri;
        
        if ([filePath hasPrefix:@"file://"]) {
            filePath = [filePath substringFromIndex:7];
        }
        
        filePath = [filePath stringByRemovingPercentEncoding];
        
        UIImage *image = [UIImage imageWithContentsOfFile:filePath];
        
        if (image) {
            completion(image, nil);
        } else {
            image = [UIImage imageNamed:imageUri];
            if (image) {
                completion(image, nil);
            } else {
                NSError *error = [NSError errorWithDomain:@"RNVImageColorExtractor"
                                                     code:-2
                                                 userInfo:@{NSLocalizedDescriptionKey: @"Failed to load image"}];
                completion(nil, error);
            }
        }
    });
}

@end
