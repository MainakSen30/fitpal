import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// Host-published API port from docker/docker-compose.yml (api 3001 -> 3011).
const DEV_API_PORT = 3011;

/**
 * Resolve the API origin.
 *
 * In development the device already reaches Metro at <mac-lan-ip>:8081, and
 * Metro advertises that same reachable host in `expoConfig.hostUri`. Deriving
 * the API host from it keeps login working across DHCP changes: a hardcoded
 * LAN IP in .env silently goes stale, and every request then hangs "pending"
 * against an address that no longer belongs to this machine.
 *
 * `hostUri` is only present during development. Production builds use the
 * EXPO_PUBLIC_API_URL value baked in at build time.
 */
function resolveApiUrl(): string {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    // hostUri is "host:port"; strip only the trailing :port so bracketed
    // IPv6 hosts stay intact.
    const host = hostUri?.replace(/:\d+$/, '');
    if (host) return `http://${host}:${DEV_API_PORT}`;
  }
  return process.env.EXPO_PUBLIC_API_URL || `http://localhost:${DEV_API_PORT}`;
}

export const API_URL = resolveApiUrl();

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
    }
    return Promise.reject(error);
  }
);
