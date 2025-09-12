import {jest} from '@jest/globals';

// Helper to mock react-native-config per test case
function mockConfig(values: Record<string, string>) {
  jest.resetModules();
  jest.doMock('react-native-config', () => ({
    __esModule: true,
    default: values,
  }));
}

describe('getFunctionsApiBaseUrl', () => {
  test('uses FUNCTIONS_URL override when provided', async () => {
    mockConfig({
      FUNCTIONS_URL: 'https://api.example.com',
      USE_EMULATORS: 'false',
      PROJECT_ID: 'project-prod',
      FUNCTIONS_REGION: 'europe-west1',
    });
    // Re-import after mock
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {getFunctionsApiBaseUrl} = require('@src/libs/ApiConfig');
    expect(getFunctionsApiBaseUrl()).toBe('https://api.example.com');
  });

  test('builds emulator URL when USE_EMULATORS=true', async () => {
    mockConfig({
      USE_EMULATORS: 'true',
      PROJECT_ID: 'local-project',
      FUNCTIONS_REGION: 'us-central1',
      FUNCTIONS_PORT: '5001',
    });
    const {getFunctionsApiBaseUrl} = require('@src/libs/ApiConfig');
    // Defaults HOST to 127.0.0.1 from CONFIG
    expect(getFunctionsApiBaseUrl()).toBe(
      'http://127.0.0.1:5001/local-project/us-central1/api',
    );
  });

  test('builds production URL using region and project id when no override and emulators disabled', async () => {
    mockConfig({
      USE_EMULATORS: 'false',
      PROJECT_ID: 'project-prod',
      FUNCTIONS_REGION: 'europe-west1',
    });
    const {getFunctionsApiBaseUrl} = require('@src/libs/ApiConfig');
    expect(getFunctionsApiBaseUrl()).toBe(
      'https://europe-west1-project-prod.cloudfunctions.net/api',
    );
  });
});

