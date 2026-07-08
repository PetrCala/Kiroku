//
//  WatchBridge.m
//  Kiroku
//
//  Legacy-bridge export of the Swift WatchBridge module (see WatchBridge.swift).
//  Works under the New Architecture via the interop layer, same as
//  RCTBootSplash; no TurboModule codegen needed for a fire-and-forget module.
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WatchBridge, NSObject)

RCT_EXTERN_METHOD(updateCredential:(NSDictionary *)credential)
RCT_EXTERN_METHOD(clearCredential)

@end
