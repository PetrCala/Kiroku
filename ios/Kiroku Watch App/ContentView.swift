//
//  ContentView.swift
//  Kiroku Watch App
//
//  Created by PetrCala on 29.06.2024.
//

import SwiftUI
import Foundation

struct ContentView: View {
    // Instantiating the singleton here guarantees WCSession activates at watch
    // app launch, before any view-model action needs the credential.
    @ObservedObject private var connectivity = SessionConnectivity.shared

    var body: some View {
        ZStack {
            AppColors.backgroundColor
                .edgesIgnoringSafeArea(.all) // This ensures the color covers the entire screen

            InitialView()

            if connectivity.needsPhoneReconnect {
                VStack {
                    Spacer()
                    Text(Translate.getText(for: "openPhoneToReconnect"))
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .padding(8)
                        .background(Color.black.opacity(0.75))
                        .cornerRadius(8)
                        .padding(.horizontal, 8)
                }
                .allowsHitTesting(false)
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
