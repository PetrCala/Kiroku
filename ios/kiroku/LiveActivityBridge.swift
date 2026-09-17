//
//  LiveActivityBridge.swift
//  Kiroku
//
//  Phone-side half of the live drinking session on the lock screen (Sessions v2
//  RFC §8). Shaped like WatchBridge.swift: a fire-and-forget `@objc` module that
//  holds the native state JS cannot, in this case the running ActivityKit
//  activity.
//
//  JS owns the decision (it watches the ongoing session in Onyx and calls
//  `start` / `update` / `end`); this module owns the ActivityKit call and every
//  reason not to make one. Nothing here throws back into JS: a device on iOS
//  16.1 or older, a user who turned Live Activities off, and a system that
//  refuses the request all end the same way, quietly.
//
//  Wire contract (all values plist-safe, no NSNull):
//    sessionId: String, startedAt: Double (epoch ms), deepLink: String
//    name: String, unitsText: String, drinkCount: Int, drinksLabel: String
//    endedAt: Double (epoch ms, `end` only)
//
//  The elapsed time is deliberately NOT in the payload. It is derived from
//  `startedAt` by `Text(timerInterval:)` in the widget, so the clock keeps
//  ticking while the app is suspended and JS never sends a formatted string.
//

import ActivityKit
import Foundation

@objc(LiveActivityBridge)
final class LiveActivityBridge: NSObject {
    /// Serializes state access: RN calls arrive on the module's method queue,
    /// ActivityKit completions on whatever thread the system picks.
    private let queue = DispatchQueue(label: "cz.kiroku.liveactivity")

    /// The running activity. Typed `Any` because `Activity` is iOS 16.2+ while
    /// this class has to exist on every version the app supports.
    private var storedActivity: Any?

    @objc
    static func requiresMainQueueSetup() -> Bool {
        false
    }

    /// A session went live. Starts an activity, or retargets an existing one
    /// when it belongs to a different session (a session that ended while the
    /// app was dead leaves its activity behind).
    @objc
    func start(_ payload: NSDictionary) {
        queue.async {
            guard #available(iOS 16.2, *) else {
                return
            }
            self.startActivity(payload)
        }
    }

    /// Something in the session changed: a drink, a rename, the unit total.
    @objc
    func update(_ payload: NSDictionary) {
        queue.async {
            guard #available(iOS 16.2, *) else {
                return
            }
            self.updateActivity(payload)
        }
    }

    /// The session closed. Shows the final numbers, then lets the system clear
    /// the activity shortly afterwards.
    @objc
    func end(_ payload: NSDictionary) {
        queue.async {
            guard #available(iOS 16.2, *) else {
                return
            }
            self.endActivities(payload)
        }
    }
}

@available(iOS 16.2, *)
private extension LiveActivityBridge {
    /// How long the summary stays up after a session closes. Long enough to
    /// read on the way home, short enough not to sit on the lock screen the
    /// next morning. `.default` would leave it for up to four hours.
    static var summaryLinger: TimeInterval { 15 * 60 }

    var activity: Activity<KirokuSessionAttributes>? {
        get { storedActivity as? Activity<KirokuSessionAttributes> }
        set { storedActivity = newValue }
    }

    func date(from payload: NSDictionary, key: String) -> Date? {
        guard let ms = payload[key] as? NSNumber else {
            return nil
        }
        return Date(timeIntervalSince1970: ms.doubleValue / 1000)
    }

    func attributes(from payload: NSDictionary) -> KirokuSessionAttributes? {
        guard let sessionId = payload["sessionId"] as? String,
              !sessionId.isEmpty,
              let startedAt = date(from: payload, key: "startedAt"),
              let deepLink = payload["deepLink"] as? String,
              !deepLink.isEmpty
        else {
            return nil
        }
        return KirokuSessionAttributes(
            sessionId: sessionId,
            startedAt: startedAt,
            deepLink: deepLink
        )
    }

    func state(from payload: NSDictionary) -> KirokuSessionAttributes.ContentState {
        KirokuSessionAttributes.ContentState(
            name: payload["name"] as? String ?? "",
            unitsText: payload["unitsText"] as? String ?? "",
            drinkCount: (payload["drinkCount"] as? NSNumber)?.intValue ?? 0,
            drinksLabel: payload["drinksLabel"] as? String ?? "",
            endedAt: date(from: payload, key: "endedAt")
        )
    }

    /// Adopt an activity this process did not start. iOS keeps activities
    /// alive across app launches, so after a cold start the module's own
    /// reference is nil while the activity is still on the lock screen.
    func adoptRunningActivity() {
        if activity == nil {
            activity = Activity<KirokuSessionAttributes>.activities.first
        }
    }

    func startActivity(_ payload: NSDictionary) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled,
              let attributes = attributes(from: payload)
        else {
            return
        }
        adoptRunningActivity()
        if let running = activity {
            if running.attributes.sessionId == attributes.sessionId {
                // Already showing this session; a start is then just an update.
                updateActivity(payload)
                return
            }
            endEverything(with: nil)
        }
        do {
            activity = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: state(from: payload), staleDate: nil)
            )
            NSLog("[LiveActivityBridge] started an activity")
        } catch {
            // Over the system's activity budget, or disabled between the
            // check and the request. The next drink retries.
            NSLog("[LiveActivityBridge] could not start: %@", error.localizedDescription)
        }
    }

    func updateActivity(_ payload: NSDictionary) {
        adoptRunningActivity()
        guard let running = activity else {
            // Nothing to update: either the session predates the feature or
            // the user dismissed the activity. `start` is what revives it.
            return
        }
        let content = ActivityContent(state: state(from: payload), staleDate: nil)
        Task { await running.update(content) }
    }

    func endActivities(_ payload: NSDictionary) {
        adoptRunningActivity()
        // A payload without a session is JS saying "clear whatever is there",
        // not "this session ended": it has no numbers to show. Passing nil
        // leaves an orphan from an earlier launch with its own last content
        // for the few minutes before the system clears it, rather than
        // blanking it out first.
        let hasSession = !(payload["sessionId"] as? String ?? "").isEmpty
        endEverything(with: hasSession ? state(from: payload) : nil)
    }

    /// Ends every activity of this type, not just the one this module
    /// started, so an orphan from a previous launch cannot outlive the
    /// session it belongs to.
    func endEverything(with finalState: KirokuSessionAttributes.ContentState?) {
        let running = Activity<KirokuSessionAttributes>.activities
        activity = nil
        guard !running.isEmpty else {
            return
        }
        let dismissAt = Date().addingTimeInterval(Self.summaryLinger)
        let content = finalState.map { ActivityContent(state: $0, staleDate: nil) }
        Task {
            for one in running {
                await one.end(content, dismissalPolicy: .after(dismissAt))
            }
        }
    }
}
