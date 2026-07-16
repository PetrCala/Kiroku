//
//  ContentView.swift
//  Kiroku Watch App
//
//  Created by PetrCala on 29.06.2024.
//

import SwiftUI

/// Root container: paints the background and hosts the state-driven session UI.
/// All of loading / no-session / disconnected / active routing lives in
/// `InitialView`, driven by `SessionViewModel` (Phase 4, docs/apple-watch-mvp.md).
struct ContentView: View {
    var body: some View {
        ZStack {
            AppColors.backgroundColor
                .edgesIgnoringSafeArea(.all)

            InitialView()
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
