//
//  LiveActivityBridge.m
//  Kiroku
//
//  Legacy-bridge export of the Swift LiveActivityBridge module (see
//  LiveActivityBridge.swift). Works under the New Architecture via the interop
//  layer, same as WatchBridge; no TurboModule codegen needed for a
//  fire-and-forget module.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveActivityBridge, NSObject)

RCT_EXTERN_METHOD(start:(NSDictionary *)payload)
RCT_EXTERN_METHOD(update:(NSDictionary *)payload)
RCT_EXTERN_METHOD(end:(NSDictionary *)payload)

@end
