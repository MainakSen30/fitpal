import Constants from 'expo-constants';

// Host-published API port from docker/docker-compose.yml (api 3001 -> 3011).
const DEV_API_PORT = 3011;

/**
 * Derive the dev API host from Metro's reachable host so LAN IP changes do not
 * silently break login. Production uses the URL baked in at build time.
 */
function resolveApiUrl(): string {
  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    // Strip only the trailing port so bracketed IPv6 hosts stay intact.
    const host = hostUri?.replace(/:\d+$/, '');
    if (host) return `http://${host}:${DEV_API_PORT}`;
  }
  return process.env.EXPO_PUBLIC_API_URL || `http://localhost:${DEV_API_PORT}`;
}

export const API_URL = resolveApiUrl();
