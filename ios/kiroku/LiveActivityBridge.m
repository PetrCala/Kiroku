//
//  LiveActivityBridge.m
//  Kiroku
//
//  Legacy-bridge export of the Swift LiveActivityBridge module (see
//  LiveActivityBridge.swift). Works under the New Architecture via the interop
//  layer, same as WatchBridge; no TurboModule codegen needed. Declared against
//  RCTEventEmitter because ActivityKit's push token comes back asynchronously,
//  as the `liveActivityPushToken` event; everything JS sends is fire and
//  forget.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(LiveActivityBridge, RCTEventEmitter)

RCT_EXTERN_METHOD(start:(NSDictionary *)payload)
RCT_EXTERN_METHOD(update:(NSDictionary *)payload)
RCT_EXTERN_METHOD(end:(NSDictionary *)payload)

@end
