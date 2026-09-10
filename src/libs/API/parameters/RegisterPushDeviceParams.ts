type RegisterPushDeviceParams = {
  /** FCM registration token for this install */
  token: string;

  /** Push platform; kiroku-api accepts `ios` and `android` */
  platform: 'ios' | 'android';

  /** Persisted device identifier (ONYXKEYS.DEVICE_ID) */
  deviceID: string;

  /** App locale, the server's fallback for the notification language */
  locale?: string;
};

export default RegisterPushDeviceParams;
