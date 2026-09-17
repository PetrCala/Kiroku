import SwiftUI

/// The unit-counter tab: the session's name and elapsed time, its total, and
/// the +/- controls. The count reads straight off the DrinkingSession-backed
/// view model; each tap mutates the session and fires a haptic (Phase 4,
/// docs/apple-watch-mvp.md). The header is Sessions v2 W4 (RFC §8).
struct MainScreenView: View {
    @ObservedObject var viewModel: SessionViewModel

    var body: some View {
        VStack {
            SessionHeaderView(
                name: viewModel.sessionName,
                startedAt: viewModel.sessionStartedAt
            )

            Text("\(viewModel.unitCount)")
                .font(.largeTitle)

            HStack {
                Button(action: {
                    viewModel.subtractUnit()
                }) {
                    Text("-")
                        .font(.largeTitle)
                        .padding()
                }
                Button(action: {
                    viewModel.addUnit()
                }) {
                    Text("+")
                        .font(.largeTitle)
                        .padding()
                }
            }

            if let error = viewModel.lastError {
                Text(error)
                    .font(.caption2)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 8)
            }
        }
        .navigationBarBackButtonHidden(true)
    }
}

struct MainScreenView_Previews: PreviewProvider {
    static var previews: some View {
        MainScreenView(viewModel: SessionViewModel())
    }
}
