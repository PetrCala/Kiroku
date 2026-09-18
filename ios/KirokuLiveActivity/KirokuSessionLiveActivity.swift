//
//  KirokuSessionLiveActivity.swift
//  KirokuLiveActivity
//
//  Placeholder presentation for the live drinking session (Sessions v2 RFC §8).
//  This step exists to prove the extension target builds, signs and uploads;
//  the real lock-screen and Dynamic Island layouts, and the bridge that drives
//  them, land in the next PR of the W4 train.
//
//  The elapsed time is rendered by `Text(timerInterval:)`, which ticks in the
//  system process. JS never sends a formatted clock string, so the timer keeps
//  running while the app is suspended.
//

import ActivityKit
import SwiftUI
import WidgetKit

struct KirokuSessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: KirokuSessionAttributes.self) { context in
            VStack(alignment: .leading, spacing: 4) {
                Text(context.state.name)
                    .font(.headline)
                ElapsedTimeText(startedAt: context.attributes.startedAt)
                    .font(.title2.monospacedDigit())
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.name)
                        .font(.headline)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedTimeText(startedAt: context.attributes.startedAt)
                        .font(.body.monospacedDigit())
                }
            } compactLeading: {
                Image(systemName: "wineglass")
            } compactTrailing: {
                ElapsedTimeText(startedAt: context.attributes.startedAt)
                    .font(.caption.monospacedDigit())
                    .frame(maxWidth: 44)
            } minimal: {
                Image(systemName: "wineglass")
            }
        }
    }
}

/// The natively ticking elapsed timer. `timerInterval` needs a closed range, so
/// the end is pushed far enough out that a session can never reach it.
struct ElapsedTimeText: View {
    let startedAt: Date

    var body: some View {
        Text(
            timerInterval: startedAt ... startedAt.addingTimeInterval(60 * 60 * 24 * 7),
            countsDown: false
        )
    }
}
