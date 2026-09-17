type RegisterLiveActivityParams = {
  /** Persisted device identifier (ONYXKEYS.DEVICE_ID) */
  deviceID: string;

  /** The drinking session whose Live Activity this token addresses */
  sessionId: string;

  /** The ActivityKit APNs push token, lowercase hex */
  token: string;
};

export default RegisterLiveActivityParams;
