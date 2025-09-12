import CONFIG from '@src/CONFIG';

function stripTrailingSlash(url: string) {
  return url.replace(/\/$/, '');
}

function getFunctionsApiBaseUrl(): string {
  // Highest priority: explicit override via env
  const override = CONFIG.FUNCTIONS.URL_OVERRIDE;
  if (override) {
    return stripTrailingSlash(override);
  }

  const region = CONFIG.FUNCTIONS.REGION || 'us-central1';
  const projectId = CONFIG.FIREBASE_CONFIG.projectId || CONFIG.TEST_PROJECT_ID;

  // Emulators
  if (CONFIG.IS_USING_EMULATORS) {
    const host = CONFIG.EMULATORS.HOST || '127.0.0.1';
    const port = CONFIG.EMULATORS.FUNCTIONS_PORT || 5001;
    return `http://${host}:${port}/${projectId}/${region}/api`;
  }

  // Cloud Functions default domain
  return `https://${region}-${projectId}.cloudfunctions.net/api`;
}

export {getFunctionsApiBaseUrl};

