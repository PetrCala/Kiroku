// !! Run using npm test - to run using bun test, resolve first issue with Config -> mock react-native-config

require('dotenv').config(); // Use .env variables in this file - CONFIG does not work here
import type {FirebaseStorage} from 'firebase/storage';
import type {FirebaseApp} from 'firebase/app';
import {isConnectedToStorageEmulator} from '../../../src/libs/Firebase/FirebaseUtils';
import {describeWithEmulator} from '../../emulators/utils';
import StorageEmulator from '../../emulators/storage';

describeWithEmulator('Test connecting to the storage emulator', () => {
  let testApp: FirebaseApp;
  let storage: FirebaseStorage;

  beforeAll(async () => {
    ({testApp, storage} = StorageEmulator.setup());
  });

  beforeEach(async () => {
    // do something
  });

  afterEach(async () => {
    // do something
  });

  afterAll(async () => {
    await StorageEmulator.teardown(testApp);
  });

  it('should connect to the emulator storage', async () => {
    expect(storage).not.toBeNull();
    expect(isConnectedToStorageEmulator(storage)).toBe(true);
  });
});

describeWithEmulator('Test uploading objects', () => {
  let testApp: FirebaseApp;
  let storage: FirebaseStorage;

  beforeAll(async () => {
    ({testApp, storage} = StorageEmulator.setup());
  });

  beforeEach(async () => {
    // do something
  });

  afterEach(async () => {
    // do something
  });

  afterAll(async () => {
    await StorageEmulator.teardown(testApp);
  });

  it('should connect to the emulator storage', async () => {
    expect(storage).not.toBeNull();
    expect(isConnectedToStorageEmulator(storage)).toBe(true);
  });
});
