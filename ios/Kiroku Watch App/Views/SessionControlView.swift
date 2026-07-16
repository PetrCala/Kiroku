import SwiftUI

/// The save/discard tab. Both are blocking writes: while one is in flight the
/// buttons disable and a spinner shows; a failure surfaces inline and keeps the
/// session so it can be retried. Success flips `isActive` off, which routes the
/// UI back to the start screen (Phase 4, docs/apple-watch-mvp.md).
struct SessionControlView: View {
    @ObservedObject var viewModel: SessionViewModel

    var body: some View {
        VStack {
            if viewModel.isBusy {
                ProgressView()
                    .padding()
            } else {
                Button(action: {
                    viewModel.saveSession()
                }) {
                    Text(Translate.getText(for: "saveSession"))
                        .foregroundColor(.white)
                        .padding()
                        .cornerRadius(8)
                }
                .padding()

                Button(action: {
                    viewModel.discardSession()
                }) {
                    Text(Translate.getText(for: "discardSession"))
                        .foregroundColor(.red)
                        .padding()
                        .cornerRadius(8)
                }
                .padding()
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

struct SessionControlView_Previews: PreviewProvider {
    static var previews: some View {
        SessionControlView(viewModel: SessionViewModel())
    }
}
