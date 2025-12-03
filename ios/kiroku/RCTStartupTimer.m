//
//  RCTStartupTimer.m
//  NewExpensify
//
//  Created by Marc Glasser on 7/21/21.
//

#import "RCTStartupTimer.h"

@implementation RCTStartupTimer

// REMOVED: Firebase Performance module no longer available
// This module is now a no-op stub since Firebase Performance was removed

+ (void)start {
// No-op: Firebase Performance module removed
#if DEBUG
  NSLog(@"[StartupTimer] Firebase Performance disabled - module removed");
#endif
}

- (void)stop {
// No-op: Firebase Performance module removed
#if DEBUG
  NSLog(@"[StartupTimer] Firebase Performance disabled - module removed");
#endif
}

// To export a module named StartupTimer
RCT_EXPORT_MODULE(StartupTimer);

@end
