// No-op on Android and Web — Apple credential revocation is iOS-only.
function AppleAuthWrapper() {
  return null;
}

export default AppleAuthWrapper;
