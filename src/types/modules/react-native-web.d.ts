/* eslint-disable @typescript-eslint/consistent-type-definitions */
declare module 'react-native-web' {
  class Clipboard {
    static isAvailable(): boolean;
    static getString(): Promise<string>;
    static setString(text: string): boolean;
  }

  interface Linking {
    openURL(url: string, target?: string): Promise<void>;
  }

  export type {Linking};
  export {Clipboard};
}
