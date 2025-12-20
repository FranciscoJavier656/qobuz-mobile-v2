/**
 * RNMitsuhaView.h
 * Puente de React Native para libmitsuha6 ORIGINAL
 */

#import <React/RCTViewManager.h>
#import <React/RCTBridgeModule.h>

@class MSHFJelloView;

@interface RNMitsuhaView : UIView

@property (nonatomic, strong) MSHFJelloView *jelloView;
@property (nonatomic, assign) BOOL isPlaying;
@property (nonatomic, copy) NSString *primaryColor;
@property (nonatomic, copy) NSString *secondaryColor;

@end

@interface RNMitsuhaViewManager : RCTViewManager
@end
