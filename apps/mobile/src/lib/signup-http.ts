import axios, { type AxiosInstance } from 'axios';
import { API_URL } from './api';
import type { SignupHttpResponse, SignupRequest } from './signup';

export type SignupPost = (request: SignupRequest) => Promise<SignupHttpResponse>;

/** Dedicated client: no auth-token request or response interceptors. */
export function createSignupClient(): AxiosInstance {
  return axios.create({
    baseURL: `${API_URL}/api/v1`,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Resolve every HTTP response as status/data, including 400/401/409/429/503.
 * Only failures without an HTTP response remain network failures.
 */
export function createSignupPost(client: AxiosInstance = createSignupClient()): SignupPost {
  return async (request) => {
    try {
      const response = await client.post(request.url, request.body);
      return { status: response.status, data: response.data };
    } catch (error) {
      const response = (error as { response?: { status?: number; data?: unknown } }).response;
      if (typeof response?.status === 'number') {
        return { status: response.status, data: response.data };
      }
      throw error;
    }
  };
}
