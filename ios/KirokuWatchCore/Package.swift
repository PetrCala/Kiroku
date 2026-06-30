// swift-tools-version:5.9
import PackageDescription

// KirokuWatchCore — the pure-Swift (no Firebase SDK) networking + model layer
// for the Apple Watch companion app (Apple Watch MVP, Phase 2).
//
// It is intentionally packaged as a standalone SwiftPM library so it can:
//   - be built and unit-tested today via `swift test` on the macOS host
//     (the watchOS Xcode target is orphaned and gets rebuilt in Phase 1), and
//   - be dropped into the `kiroku` watch target later, either as a local
//     package dependency or by adding `Sources/KirokuWatchCore/*.swift` to it.
//
// The only system frameworks used are Foundation (URLSession, JSONEncoder) and
// Security (SecRandomCopyBytes) — both available on watchOS, iOS and macOS — so
// the same sources compile unchanged on the watch and under host tests.
let package = Package(
    name: "KirokuWatchCore",
    platforms: [
        .macOS(.v12),
        .iOS(.v15),
        .watchOS(.v10),
    ],
    products: [
        .library(name: "KirokuWatchCore", targets: ["KirokuWatchCore"]),
    ],
    targets: [
        .target(name: "KirokuWatchCore"),
        .testTarget(
            name: "KirokuWatchCoreTests",
            dependencies: ["KirokuWatchCore"]
        ),
    ]
)
