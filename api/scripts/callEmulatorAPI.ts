import fetch, {RequestInit} from 'node-fetch';

const API_CONFIG = {
  port: 5001,
  projectId: 'alcohol-tracker-db',
  region: 'us-central1',
};
const API_BASE_URL = `http://localhost:${API_CONFIG.port}/${API_CONFIG.projectId}/${API_CONFIG.region}/api`;

interface ApiTestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  data?: object;
  headers?: Record<string, string>;
}

async function callApi({
  method,
  endpoint,
  data,
  headers,
}: ApiTestConfig): Promise<void> {
  const url = `${API_BASE_URL}/${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: data && method !== 'GET' ? JSON.stringify(data) : undefined,
  };

  try {
    const response = await fetch(url, options);
    const responseBody = await response.json();

    console.log('Response Status:', response.status);
    console.log('Response Body:', responseBody);
  } catch (error) {
    console.error('Error calling API:', error);
  }
}

// Example calls:
(async () => {
  await callApi({
    method: 'GET',
    endpoint: 'healthcheck',
  });

  await callApi({
    method: 'POST',
    endpoint: 'users',
    data: {name: 'John Doe', email: 'john.doe@example.com'},
  });
})();
