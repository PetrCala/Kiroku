#import "RCTBootSplash.h"

#import <React/RCTUtils.h>

#import <React/RCTRootView.h>
#import <React/RCTSurfaceHostingProxyRootView.h>
#import <React/RCTSurfaceHostingView.h>

static RCTSurfaceHostingProxyRootView *_rootView = nil;

static UIView *_loadingView = nil;
static NSMutableArray<RCTPromiseResolveBlock> *_resolveQueue =
    [[NSMutableArray alloc] init];
static bool _fade = false;
static bool _nativeHidden = false;

@implementation RCTBootSplash

RCT_EXPORT_MODULE();

- (dispatch_queue_t)methodQueue {
  return dispatch_get_main_queue();
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

+ (bool)isLoadingViewVisible {
  return _loadingView != nil && ![_loadingView isHidden];
}

+ (BOOL)isInitialized {
  return _loadingView && _rootView;
}

+ (bool)hasResolveQueue {
  return _resolveQueue != nil;
}

+ (void)clearResolveQueue {
  if (![self hasResolveQueue])
    return;

  while ([_resolveQueue count] > 0) {
    RCTPromiseResolveBlock resolve = [_resolveQueue objectAtIndex:0];
    [_resolveQueue removeObjectAtIndex:0];
    resolve(@(true));
  }
}

+ (void)hideAndClearPromiseQueue {
  if (![self isLoadingViewVisible]) {
    return [RCTBootSplash clearResolveQueue];
  }

  if (_fade) {
    dispatch_async(dispatch_get_main_queue(), ^{
      // DIAGNOSTIC — DO NOT MERGE.
      // 1500ms cross-dissolve (6× slower than production 250ms) so the
      // user can visually pinpoint when the logo blinks during the
      // transition. Production duration is 0.250.
      [UIView transitionWithView:_rootView
          duration:1.500
          options:UIViewAnimationOptionTransitionCrossDissolve
          animations:^{
            _loadingView.hidden = YES;
          }
          completion:^(__unused BOOL finished) {
            [_loadingView removeFromSuperview];
            _loadingView = nil;

            return [RCTBootSplash clearResolveQueue];
          }];
    });
  } else {
    _loadingView.hidden = YES;
    [_loadingView removeFromSuperview];
    _loadingView = nil;

    return [RCTBootSplash clearResolveQueue];
  }
}

+ (void)initWithStoryboard:(NSString *_Nonnull)storyboardName
                  rootView:(UIView *_Nullable)rootView {
  if (RCTRunningInAppExtension() || [self isInitialized]) {
    return;
  }

  [NSTimer scheduledTimerWithTimeInterval:0.35
                                  repeats:NO
                                    block:^(NSTimer *_Nonnull timer) {
                                      // wait for native iOS launch screen to
                                      // fade out
                                      _nativeHidden = true;

                                      // hide has been called before native
                                      // launch screen fade out
                                      if ([_resolveQueue count] > 0) {
                                        [self hideAndClearPromiseQueue];
                                      }
                                    }];

  if (rootView != nil) {
    _rootView = (RCTSurfaceHostingProxyRootView *)rootView;

    UIStoryboard *storyboard = [UIStoryboard storyboardWithName:storyboardName
                                                         bundle:nil];

    _loadingView = [[storyboard instantiateInitialViewController] view];
    _loadingView.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;

    // _rootView is RCTSurfaceHostingProxyRootView (New Arch). Its bounds are
    // CGRectZero until React reports a measured surface size — which on cold
    // launch happens only after the JS bundle is parsed and the first render
    // commits. If we size the loadingView from _rootView.bounds at that
    // moment, the view is added zero-sized; the autoresizing mask only
    // inflates it later when _rootView finally gets a real size. Between OS
    // LaunchScreen dismissal and that first React measure, the user sees the
    // window's yellow backgroundColor *without the logo* — the "logo
    // disappears then reappears" gap that's especially visible in dev mode
    // (Metro fetch + parse extends the gap to several hundred ms).
    //
    // Fall back to UIScreen.mainScreen.bounds so the loadingView is
    // screen-sized from frame zero. The autoresizing mask still keeps it
    // matched to _rootView for any later size change.
    CGRect initialFrame = !CGRectIsEmpty(_rootView.bounds)
                              ? _rootView.bounds
                              : [UIScreen mainScreen].bounds;
    _loadingView.frame = initialFrame;
    _loadingView.center = (CGPoint){CGRectGetMidX(initialFrame),
                                    CGRectGetMidY(initialFrame)};
    _loadingView.hidden = NO;

    [_rootView addSubview:_loadingView];

    // Intentionally do NOT call -disableActivityIndicatorAutoHide: or
    // -setLoadingView: here. On the New Arch (RCTSurfaceHostingProxyRootView)
    // those hooks register _loadingView with the React Surface lifecycle,
    // which on RN 0.81+ holds the loadingView until the surface itself reports
    // ready. If the JS-side gating condition (e.g. hasCheckedAutoLogin) never
    // fires, the lifecycle never releases the view — the same deadlock that
    // pinned f618d0a2 in production. We add _loadingView as a plain subview
    // and rely on JS calling BootSplash.hide() (with a safety timeout) to
    // remove it.

    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(onJavaScriptDidLoad)
               name:RCTJavaScriptDidLoadNotification
             object:nil];

    [[NSNotificationCenter defaultCenter]
        addObserver:self
           selector:@selector(onJavaScriptDidFailToLoad)
               name:RCTJavaScriptDidFailToLoadNotification
             object:nil];
  }
}

+ (void)onJavaScriptDidLoad {
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

+ (void)onJavaScriptDidFailToLoad {
  [self hideAndClearPromiseQueue];
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

- (NSDictionary *)constantsToExport {
  UIWindow *window = RCTKeyWindow();
  __block bool darkModeEnabled = false;

  RCTUnsafeExecuteOnMainQueueSync(^{
    darkModeEnabled =
        window != nil &&
        window.traitCollection.userInterfaceStyle == UIUserInterfaceStyleDark;
  });

  return @{@"darkModeEnabled" : @(darkModeEnabled)};
}

+ (void)bringSubviewToFrontIfInitialized {
  if (![self isInitialized]) {
    return;
  }

  [_rootView bringSubviewToFront:_loadingView];
}

+ (void)hide:(BOOL)fade {
  if (![RCTBootSplash isLoadingViewVisible] || RCTRunningInAppExtension())
    return [RCTBootSplash clearResolveQueue];

  _fade = fade;

  return [RCTBootSplash hideAndClearPromiseQueue];
}

- (void)hideImpl:(BOOL)fade resolve:(RCTPromiseResolveBlock)resolve {
  if (_resolveQueue == nil)
    _resolveQueue = [[NSMutableArray alloc] init];

  [_resolveQueue addObject:resolve];

  [RCTBootSplash hide:fade];
}

RCT_EXPORT_METHOD(hide : (RCTPromiseResolveBlock)
                      resolve reject : (RCTPromiseRejectBlock)reject) {
  // fade=1 → 250ms UIView crossDissolve. iOS has to compute the AFTER
  // state (the React tree without the loadingView) to crossfade to it,
  // which forces rendering of layers that were previously occluded.
  // Bridges Fabric's incremental mounting so the React tree is on the
  // framebuffer by the time the storyboard alpha hits 0.
  [self hideImpl:1 resolve:resolve];
}

@end
