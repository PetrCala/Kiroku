//
//  SessionTabView.swift
//  Kiroku Watch App
//
//  Created by PetrCala on 07.07.2024.
//

import Foundation
import SwiftUI

/// The active-session UI: paged tabs for save/discard, the unit counter, and the
/// (decorative, MVP) unit picker. A reconnect banner overlays the session when
/// the token goes stale mid-session, so the user knows a save will need the
/// phone (Phase 4, docs/apple-watch-mvp.md).
struct SessionTabView: View {
    @ObservedObject var viewModel: SessionViewModel
    @State private var selectedTab = 0
    let initialTab: Int

    init(viewModel: SessionViewModel, initialTab: Int) {
        self.viewModel = viewModel
        self.initialTab = initialTab
        self._selectedTab = State(initialValue: initialTab)
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            SessionControlView(viewModel: viewModel)
                .tag(0)
                .tabItem {
                    Text("Session Control")
                }
            MainScreenView(viewModel: viewModel)
                .tag(1)
                .tabItem {
                    Text("Main Screen")
                }
            UnitSelectionView()
                .tag(2)
                .tabItem {
                    Text("Unit Selection")
                }
        }
        .tabViewStyle(PageTabViewStyle())
        .navigationBarBackButtonHidden(true)
        .overlay {
            if viewModel.needsReconnect {
                ReconnectBanner()
            }
        }
    }
}

struct SessionTabView_Previews: PreviewProvider {
    static var previews: some View {
        SessionTabView(viewModel: SessionViewModel(), initialTab: 1)
    }
}
