#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PerfectLoop, NSObject)
RCT_EXTERN_METHOD(load:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(play:(nonnull NSNumber *)volume)
RCT_EXTERN_METHOD(pause)
RCT_EXTERN_METHOD(stop)
RCT_EXTERN_METHOD(setVolume:(nonnull NSNumber *)volume)
RCT_EXTERN_METHOD(setNowPlaying:(NSString *)title)
@end