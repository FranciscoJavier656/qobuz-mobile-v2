/**
 * RNMitsuhaMetalView.h
 * Puente de React Native para Mitsuha con Metal
 */

#import <UIKit/UIKit.h>
#import <React/RCTViewManager.h>

@class MitsuhaMetalView;

NS_ASSUME_NONNULL_BEGIN

@interface RNMitsuhaMetalView : UIView

@property (nonatomic, strong, readonly) MitsuhaMetalView *metalView;
@property (nonatomic, assign) BOOL isPlaying;
@property (nonatomic, copy, nullable) NSString *primaryColor;
@property (nonatomic, copy, nullable) NSString *secondaryColor;
@property (nonatomic, assign) BOOL useMetal;

@end

@interface RNMitsuhaMetalViewManager : RCTViewManager

@end

NS_ASSUME_NONNULL_END
