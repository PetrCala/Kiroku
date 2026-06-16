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

    // Override the React root view controller's view backgroundColor so it
    // matches the storyboard yellow. ExpoReactNativeFactory installs an
    // RCTSurfaceHostingProxyRootView whose default background is the system
    // background (white on light mode). Painting it yellow means any frame
    // where the cross-dissolve transition reveals it will not flash white.
    self.window?.rootViewController?.view.backgroundColor =
      UIColor(red: 0.9607843, green: 0.76862745, blue: 0, alpha: 1)

    // Force the app to LTR mode.
    RCTI18nUtil.sharedInstance().allowRTL(false)
    RCTI18nUtil.sharedInstance().forceRTL(false)

    _ = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    // Add the BootSplash storyboard view as a subview of the proxy root view.
    // JS calls BootSplash.hide() with fade=1 — the native cross-dissolve
    // forces iOS to render the React tree underneath BEFORE the storyboard
    // alpha hits 0, masking Fabric's incremental mounting cascade.
    if let rootView = self.window?.rootViewController?.view {
      RCTBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
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
