//
//  SessionHeaderView.swift
//  Kiroku Watch App
//
//  Watch parity for the live session (Sessions v2 RFC §8): the session's name
//  and how long it has been running, above the unit counter.
//
//  The timer is `Text(timerInterval:)`, the same rule as the phone's Live
//  Activity and the Android notification: watchOS ticks it in its own process,
//  so it stays right while the app is inactive and nothing has to publish a
//  clock string on a timer.
//
//  The name is shown only when the session has one. A session started on the
//  phone carries the localized default (RFC §9); one started here does not, and
//  the watch has no translations to mint one with, so it shows the timer alone
//  rather than a name in the wrong language.
//

import SwiftUI

struct SessionHeaderView: View {
    let name: String?
    let startedAt: Date?

    /// `timerInterval` needs a closed range, so a running session is given an
    /// end far enough out that it can never be reached.
    private static let runningSessionCeiling: TimeInterval = 60 * 60 * 24 * 7

    var body: some View {
        VStack(spacing: 0) {
            if let name, !name.isEmpty {
                Text(name)
                    .font(.caption)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            if let startedAt {
                Text(
                    timerInterval: startedAt ... startedAt.addingTimeInterval(
                        Self.runningSessionCeiling
                    ),
                    countsDown: false
                )
                .font(.caption2.monospacedDigit())
                .foregroundColor(.secondary)
            }
        }
        .multilineTextAlignment(.center)
    }
}

struct SessionHeaderView_Previews: PreviewProvider {
    static var previews: some View {
        SessionHeaderView(name: "Friday evening", startedAt: Date())
    }
}
