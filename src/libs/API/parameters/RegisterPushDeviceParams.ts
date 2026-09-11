type RegisterPushDeviceParams = {
  /** FCM registration token for this install */
  token: string;

  /**
   * Push platform; kiroku-api accepts `ios` and `android`. Not named `platform`:
   * that key is stripped from kiroku-api bodies (it carries the legacy platform
   * injected by enhanceParameters).
   */
  devicePlatform: 'ios' | 'android';

  /** Persisted device identifier (ONYXKEYS.DEVICE_ID) */
  deviceID: string;

  /** App locale, the server's fallback for the notification language */
  locale?: string;
};

export default RegisterPushDeviceParams;
