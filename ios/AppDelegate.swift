//
//  AppDelegate.swift
//  kiroku
//

import Expo
import ExpoModulesCore
import Firebase
import React
import ReactAppDependencyProvider
import React_RCTAppDelegate
import UIKit

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    window = UIWindow(frame: UIScreen.main.bounds)

    // Set up observer to initialize Firebase after React Native is ready
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(onJavaScriptDidLoad),
      name: NSNotification.Name("RCTJavaScriptDidLoadNotification"),
      object: nil
    )

    NotificationCenter.default.addObserver(
      self,
      selector: #selector(onJavaScriptDidFailToLoad),
      name: NSNotification.Name("RCTJavaScriptDidFailToLoadNotification"),
      object: nil
    )

    factory.startReactNative(
      withModuleName: "kiroku",
      in: window,
      launchOptions: launchOptions
    )

    // Firebase is now initialized in onJavaScriptDidLoad() after React Native is ready

    // Force the app to LTR mode.
    RCTI18nUtil.sharedInstance().allowRTL(false)
    RCTI18nUtil.sharedInstance().forceRTL(false)

    _ = super.application(application, didFinishLaunchingWithOptions: launchOptions)

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

    return true
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

  @objc private func onJavaScriptDidLoad() {
    // Initialize Firebase now that React Native JS bridge is ready
    FirebaseApp.configure()

    // Clean up observers
    NotificationCenter.default.removeObserver(
      self,
      name: NSNotification.Name("RCTJavaScriptDidLoadNotification"),
      object: nil
    )
    NotificationCenter.default.removeObserver(
      self,
      name: NSNotification.Name("RCTJavaScriptDidFailToLoadNotification"),
      object: nil
    )
  }

  @objc private func onJavaScriptDidFailToLoad() {
    // Still initialize Firebase even if JS fails to load
    // (Firebase functionality should work independently)
    FirebaseApp.configure()

    // Clean up observers
    NotificationCenter.default.removeObserver(
      self,
      name: NSNotification.Name("RCTJavaScriptDidLoadNotification"),
      object: nil
    )
    NotificationCenter.default.removeObserver(
      self,
      name: NSNotification.Name("RCTJavaScriptDidFailToLoadNotification"),
      object: nil
    )
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
