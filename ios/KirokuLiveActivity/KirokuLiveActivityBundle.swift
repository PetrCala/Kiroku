//
//  KirokuLiveActivityBundle.swift
//  KirokuLiveActivity
//
//  Entry point of the WidgetKit extension. The bundle holds only the drinking
//  session Live Activity; Kiroku ships no home-screen widgets.
//

import SwiftUI
import WidgetKit

@main
struct KirokuLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        KirokuSessionLiveActivity()
    }
}
