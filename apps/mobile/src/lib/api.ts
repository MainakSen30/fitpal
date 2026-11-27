import axios from 'axios';
import { API_URL } from './api-url';
import { session } from './session';

// Date-only fields use the shared canonical DD-MM-YYYY contract; timestamps stay ISO 8601.
export type { DateOnly } from '@fitpal/shared';
export { API_URL };

/**
 * No interceptors: public auth calls must never inherit a stale Bearer token
 * or delete a valid session when they fail with 401.
 */
export const publicApi = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

/** Protected calls only; 401s are routed through the shared session controller. */
export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = session.currentToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const headers = (error as { config?: { headers?: Record<string, unknown> } }).config?.headers;
      const header = headers?.Authorization;
      if (typeof header === 'string' && header.startsWith('Bearer ')) {
        await session.invalidateToken(header.slice('Bearer '.length));
      }
    }
    return Promise.reject(error);
  },
);
