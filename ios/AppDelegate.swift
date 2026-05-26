//
//  AppDelegate.swift
//  kiroku
//

import Expo
import ExpoModulesCore
import FirebaseCore
import React
import ReactAppDependencyProvider
import React_RCTAppDelegate
import UIKit

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: ExpoReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Initialize the native Firebase iOS SDK before any JS code runs.
    // @react-native-firebase modules (crashlytics, perf, app) call into the
    // native default app at JS module-load time; without this configure call
    // they throw "No Firebase App '[DEFAULT]' has been created", which aborts
    // module evaluation before AppRegistry.registerComponent and leaves the
    // app stuck on a white screen.
    FirebaseApp.configure()

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    window = UIWindow(frame: UIScreen.main.bounds)
    // Match BootSplash.storyboard background so there is never a white frame
    // peeking through during the OS LaunchScreen → RCTBootSplash overlay handoff.
    window?.backgroundColor = UIColor(red: 0.9607843, green: 0.76862745, blue: 0, alpha: 1)
    factory.startReactNative(
      withModuleName: "kiroku",
      in: window,
      launchOptions: launchOptions
    )

    // DIAGNOSTIC v8 — DO NOT MERGE.
    // Tag the proxy root view background HOT PINK instead of yellow. If
    // during the gap we see hot pink, the surface view (_surfaceView) is
    // genuinely transparent/empty — meaning RN's "Running" stage adds
    // _surfaceView before its React-mounted children's CALayers are
    // rendered, exposing the proxy beneath. If we see orange (yellow)
    // still, the proxy isn't what we're seeing; the gap color comes from
    // iPhoneXSafeArea's override, the guard layer, or the storyboard
    // activity indicator at low alpha.
    self.window?.rootViewController?.view.backgroundColor =
      UIColor(red: 1, green: 0.08, blue: 0.58, alpha: 1)

    // Force the app to LTR mode.
    RCTI18nUtil.sharedInstance().allowRTL(false)
    RCTI18nUtil.sharedInstance().forceRTL(false)

    _ = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    // DIAGNOSTIC v6 — DO NOT MERGE.
    // Use RN's built-in RCTSurfaceHostingProxyRootView.loadingView API to
    // cover the gap between iOS LaunchScreen fade-out and the React
    // surface transitioning to "Running". RN adds the loadingView during
    // the surface's "Preparing" stage and removes it atomically in the
    // same setStage: call that adds the _surfaceView when the surface
    // transitions to "Running" — closing the gap inside one CALayer
    // commit.
    //
    // Crucially, do NOT call disableActivityIndicatorAutoHide(). That
    // was the source of the deadlock in f618d0a2 — it required JS to
    // manually trigger the removal. With auto-hide enabled (the
    // default), RN's surface lifecycle controls removal, no JS
    // intervention needed.
    //
    // Safety timeout (10s) force-removes the loadingView if the surface
    // never transitions to Running — preventing the f618d0a2 deadlock
    // even if the lifecycle integration breaks for any reason.
    if let proxyRootView = self.window?.rootViewController?.view
      as? RCTSurfaceHostingProxyRootView
    {
      let storyboard = UIStoryboard(name: "BootSplash", bundle: nil)
      if let loadingView = storyboard.instantiateInitialViewController()?.view {
        proxyRootView.loadingView = loadingView
        DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
          loadingView.removeFromSuperview()
        }
      }
    }

    if !UserDefaults.standard.bool(forKey: "isFirstRunComplete") {
      UIApplication.shared.applicationIconBadgeNumber = 0
      UserDefaults.standard.set(true, forKey: "isFirstRunComplete")
    }

    return true
  }

  override func application(
    _ application: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return RCTLinkingManager.application(application, open: url, options: options)
  }

  override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    return RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }

  // This methods is needed to support the hardware keyboard shortcuts
  func keyCommands() -> [Any]? {
    return HardwareShortcuts.sharedInstance().keyCommands()
  }

  func handleKeyCommand(_ keyCommand: UIKeyCommand) {
    HardwareShortcuts.sharedInstance().handleKeyCommand(keyCommand)
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    return self.bundleURL()
  }

  override func bundleURL() -> URL? {
    #if DEBUG
      return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
      return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
