//
//  AppDelegate.swift
//  kiroku
//

import Expo
import ExpoModulesCore
import React
import React_RCTAppDelegate
import UIKit

@main
class AppDelegate: ExpoAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Note: Firebase is now configured via Web SDK in JavaScript
    // React Native Firebase modules have been removed

    // CRITICAL: Call super.application() FIRST to let Expo handle React Native initialization
    // This prevents double initialization that was causing RCTJSThreadManager crashes
    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    // Force the app to LTR mode.
    RCTI18nUtil.sharedInstance().allowRTL(false)
    RCTI18nUtil.sharedInstance().forceRTL(false)

    // Initialize BootSplash after React Native is fully set up
    if let rootView = self.window?.rootViewController?.view as? RCTRootView {
      RCTBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
    }

    // Start the "js_load" custom performance tracing metric. This timer is
    // stopped by a native module in the JS so we can measure total time starting
    // in the native layer and ending in the JS layer.
    // RCTStartupTimer.start()

    if !UserDefaults.standard.bool(forKey: "isFirstRunComplete") {
      UIApplication.shared.applicationIconBadgeNumber = 0
      UserDefaults.standard.set(true, forKey: "isFirstRunComplete")
    }

    return result
  }

  override func application(
    _ application: UIApplication, open url: URL,
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
      restorationHandler: restorationHandler)
  }

  // This methods is needed to support the hardware keyboard shortcuts
  func keyCommands() -> [Any]? {
    return HardwareShortcuts.sharedInstance().keyCommands()
  }

  func handleKeyCommand(_ keyCommand: UIKeyCommand) {
    HardwareShortcuts.sharedInstance().handleKeyCommand(keyCommand)
  }

  // Override bundle URL to specify custom bundle location
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    #if DEBUG
      return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
    #else
      return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
    #endif
  }
}
