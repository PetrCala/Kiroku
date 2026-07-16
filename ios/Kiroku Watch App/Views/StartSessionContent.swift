//
//  StartSessionContent.swift
//  Kiroku Watch App
//
//  Created by PetrCala on 07.07.2024.
//

import Foundation
import SwiftUI

/// The idle (no-active-session) state: a big tap target that starts a live
/// session. Navigation into the session is state-driven (InitialView switches to
/// the session tabs when `viewModel.isActive` flips), so this view only fires the
/// action.
struct StartSessionContent: View {
    @ObservedObject var viewModel: SessionViewModel

    var body: some View {
        VStack {
            Spacer()

            Button(action: {
                viewModel.startSession()
            }) {
                VStack {
                    Image(ImageAssets.AppImage)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 100, height: 100)
                        .clipShape(Circle())

                    Text(Translate.getText(for: "tapToStartSession"))
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.top, 8)
                }
            }
            .frame(width: 200, height: 200)
            .cornerRadius(100)
            .buttonStyle(PlainButtonStyle())

            Spacer()
        }
    }
}

struct StartSessionContent_Previews: PreviewProvider {
    static var previews: some View {
        StartSessionContent(viewModel: SessionViewModel())
    }
}
