import Constants from 'expo-constants';

function inferLanHost() {
  const hostUri =
    Constants?.expoConfig?.hostUri ||
    Constants?.manifest2?.extra?.expoClient?.hostUri ||
    Constants?.manifest?.debuggerHost ||
    Constants?.manifest2?.extra?.expoGo?.debuggerHost;

  if (!hostUri) {
    return null;
  }

  const host = String(hostUri).split(':')[0];
  if (!host || host === '127.0.0.1' || host === 'localhost') {
    return null;
  }

  return host;
}

function defaultServerUrl() {
  const lanHost = inferLanHost();
  if (lanHost) {
    return `http://${lanHost}:5000`;
  }

  return null;
}

export function getApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log('🔗 API Base URL (from .env):', process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const serverUrl = defaultServerUrl();
  if (!serverUrl) {
    throw new Error('Missing EXPO_PUBLIC_API_URL. Set mobile-expo/.env with your LAN API base URL.');
  }

  const apiUrl = `${serverUrl}/api/student-app`;
  console.log('🔗 API Base URL (from inferred host):', apiUrl);
  return apiUrl;
}

export function getSocketBaseUrl() {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) {
    return process.env.EXPO_PUBLIC_SOCKET_URL;
  }

  const serverUrl = defaultServerUrl();
  if (!serverUrl) {
    throw new Error('Missing EXPO_PUBLIC_SOCKET_URL. Set mobile-expo/.env with your LAN socket base URL.');
  }

  return serverUrl;
}
