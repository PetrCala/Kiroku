//
//  KirokuSessionLiveActivity.swift
//  KirokuLiveActivity
//
//  How a live drinking session looks on the lock screen and in the Dynamic
//  Island (Sessions v2 RFC §8).
//
//  Two rules shape everything here. The elapsed time is always
//  `Text(timerInterval:)`, so the system ticks it in its own process and the
//  clock stays right while the app is suspended or dead. And every other string
//  arrives already localized in the content state, because the extension has no
//  access to the app's translations.
//

import ActivityKit
import SwiftUI
import WidgetKit

struct KirokuSessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: KirokuSessionAttributes.self) { context in
            LockScreenView(context: context)
                .widgetURL(URL(string: context.attributes.deepLink))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.state.name, systemImage: "wineglass")
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    ElapsedTime(context: context)
                        .font(.headline.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(context.state.unitsText)
                            .font(.title3.weight(.semibold))
                        Spacer()
                        Text("\(context.state.drinkCount) \(context.state.drinksLabel)")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: "wineglass")
            } compactTrailing: {
                ElapsedTime(context: context)
                    .font(.caption.monospacedDigit())
                    // Without a cap the compact region grows with the timer and
                    // crowds out whatever else the system wants to show there.
                    .frame(maxWidth: 48)
            } minimal: {
                Image(systemName: "wineglass")
            }
            .widgetURL(URL(string: context.attributes.deepLink))
        }
    }
}

// MARK: - Lock screen

private struct LockScreenView: View {
    let context: ActivityViewContext<KirokuSessionAttributes>

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(context.state.name)
                    .font(.headline)
                    .lineLimit(1)
                Text(context.state.unitsText)
                    .font(.title2.weight(.semibold))
                Text("\(context.state.drinkCount) \(context.state.drinksLabel)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            ElapsedTime(context: context)
                .font(.title2.monospacedDigit())
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
        .padding()
        .activityBackground()
    }
}

// MARK: - Elapsed time

/// The natively ticking elapsed timer, frozen at the session's end once it has
/// one. `timerInterval` needs a closed range, so a running session is given an
/// end far enough out that it can never be reached.
private struct ElapsedTime: View {
    let context: ActivityViewContext<KirokuSessionAttributes>

    private static let runningSessionCeiling: TimeInterval = 60 * 60 * 24 * 7

    var body: some View {
        let start = context.attributes.startedAt
        let end =
            context.state.endedAt
            ?? start.addingTimeInterval(Self.runningSessionCeiling)
        Text(timerInterval: start ... max(end, start), countsDown: false)
    }
}

// MARK: - Background

private extension View {
    /// iOS 17 wants a widget's background declared through
    /// `containerBackground`, and warns in the log when it is not. On 16.x the
    /// modifier does not exist, so the view keeps the system default there.
    @ViewBuilder
    func activityBackground() -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { Color.clear }
        } else {
            self
        }
    }
}
