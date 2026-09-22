//
//  KirokuSessionAttributes.swift
//  KirokuLiveActivity
//
//  The wire contract between the app and the Live Activity widget (Sessions v2
//  RFC §8). Compiled into BOTH targets: the app (which starts, updates and ends
//  the activity) and the KirokuLiveActivity extension (which renders it).
//
//  Split by what can change. `ActivityAttributes` are fixed for the lifetime of
//  an activity, so only the session id, its start and its deep link live there.
//  Everything the session can change while it runs, including the name (a
//  rename has to show up), sits in `ContentState`.
//
//  Text travels already localized rather than being translated in the
//  extension: the app owns the translations (src/languages), the extension has
//  no access to them, and duplicating them into a second bundle would let the
//  two drift. The elapsed time is the exception, because the system renders it.
//

import Foundation

#if canImport(ActivityKit)
    import ActivityKit

    @available(iOS 16.2, *)
    struct KirokuSessionAttributes: ActivityAttributes {
        struct ContentState: Codable, Hashable {
            /// The session name, localized by the app (W1 `SessionMeta.name`).
            var name: String

            /// The unit total, localized and formatted by the app, e.g.
            /// "4.5 units" (`homeScreen.liveSessionCard.units`).
            var unitsText: String

            /// How many drinks the session holds.
            var drinkCount: Int

            /// Localized label for that count, e.g. "Drinks" (`common.drinks`).
            var drinksLabel: String

            /// Set when the session closed, so the final frame stops the timer
            /// and reads as a summary instead of a running session.
            var endedAt: Date?
        }

        /// The drinking session this activity belongs to.
        var sessionId: String

        /// When the session started; the timer counts up from here natively.
        var startedAt: Date

        /// Where a tap goes (`kiroku://drinking-session/<id>/live`).
        var deepLink: String
    }
#endif
