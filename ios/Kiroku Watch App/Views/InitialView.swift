import SwiftUI

/// The top-level state router (Phase 4, docs/apple-watch-mvp.md). It owns the
/// `SessionViewModel` and picks one of the four UI states:
///   - active session  -> the session tabs
///   - disconnected    -> "Open Kiroku on your phone"
///   - connecting       -> a brief loading splash while WCSession activates
///   - idle             -> the start screen
///
/// Connectivity changes are pushed in via `.onReceive` (delivered on the main
/// thread), keeping the view model free of its own Combine subscriptions.
struct InitialView: View {
    @StateObject private var viewModel = SessionViewModel()
    private let connectivity = SessionConnectivity.shared

    var body: some View {
        NavigationStack {
            content
        }
        .onReceive(connectivity.$ongoingSession) { session in
            viewModel.reflect(session)
        }
        .onReceive(connectivity.$credential) { _ in
            viewModel.refreshConnectivity()
        }
        .onReceive(connectivity.$isActivated) { _ in
            viewModel.refreshConnectivity()
        }
    }

    @ViewBuilder
    private var content: some View {
        if viewModel.isActive {
            SessionTabView(viewModel: viewModel, initialTab: 1)
        } else if viewModel.needsReconnect {
            DisconnectedView()
        } else if viewModel.isConnecting {
            LoadingView()
        } else {
            StartSessionContent(viewModel: viewModel)
        }
    }
}

/// Brief splash shown while WCSession finishes activating on launch.
struct LoadingView: View {
    var body: some View {
        VStack(spacing: 8) {
            ProgressView()
            Text(Translate.getText(for: "connecting"))
                .font(.footnote)
                .foregroundColor(.white)
        }
    }
}

/// Shown when there is no usable phone credential: the watch cannot talk to the
/// backend until the phone app is opened to hand over a fresh token.
struct DisconnectedView: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "iphone.slash")
                .font(.title2)
                .foregroundColor(.white)
            Text(Translate.getText(for: "openPhoneToReconnect"))
                .font(.footnote)
                .multilineTextAlignment(.center)
                .foregroundColor(.white)
        }
        .padding(.horizontal, 8)
    }
}

/// A compact non-blocking banner pinned to the bottom, used to warn during an
/// active session that the token has gone stale (so a save will need the phone).
struct ReconnectBanner: View {
    var body: some View {
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

struct InitialView_Previews: PreviewProvider {
    static var previews: some View {
        InitialView()
    }
}
