//
//  KirokuApp.swift
//  Kiroku Watch App
//
//  Created by PetrCala on 29.06.2024.
//
import SwiftUI

@main
struct KirokuApp: App {
    init() {
        // Touch the singleton at launch so WCSession starts activating (and the
        // last phone-delivered credential/session is restored) before any view
        // model action needs it.
        _ = SessionConnectivity.shared
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
