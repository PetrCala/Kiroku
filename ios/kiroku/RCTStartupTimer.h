//
//  RCTStartupTimer.h
//  NewExpensify
//
//  Created by Marc Glasser on 7/21/21.
//
#import <React/RCTBridgeModule.h>
// REMOVED: Firebase Performance module no longer available
// #import <FirebasePerformance/FIRPerformance.h>

#ifndef RCTStartupTimer_h
#define RCTStartupTimer_h


#endif /* RCTStartupTimer_h */

@interface RCTStartupTimer : NSObject <RCTBridgeModule>
+ (void)start;

@end
