/// <reference types="bun-types" />
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { SignupRequest } from './signup';

const secureStore = {
  getItemAsync: mock(async () => 'existing-token'),
  deleteItemAsync: mock(async () => {}),
};

mock.module('expo-constants', () => ({
  default: { expoConfig: { hostUri: 'localhost:8081' } },
}));
mock.module('expo-secure-store', () => ({ default: secureStore, ...secureStore }));
Object.assign(globalThis, { __DEV__: false });

type SignupHttpModule = typeof import('./signup-http');

let createSignupClient!: SignupHttpModule['createSignupClient'];
let createSignupPost!: SignupHttpModule['createSignupPost'];
let api!: typeof import('./api')['api'];

beforeAll(async () => {
  ({ api } = await import('./api'));
  ({ createSignupClient, createSignupPost } = await import('./signup-http'));
});

beforeEach(() => {
  secureStore.getItemAsync.mockClear();
  secureStore.deleteItemAsync.mockClear();
});

const VERIFY_REQUEST: SignupRequest = {
  url: '/auth/signup/verify',
  body: { userId: 'user-123', channel: 'email', code: '123456' },
};

const RESEND_REQUEST: SignupRequest = {
  url: '/auth/signup/resend',
  body: { userId: 'user-123' },
};

function httpError(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data },
  });
}

function fakeClient(post: () => Promise<unknown>): AxiosInstance {
  return { post } as unknown as AxiosInstance;
}

describe('createSignupPost', () => {
  it('delivers verification 401 as HTTP 401', async () => {
    const data = { error: 'Invalid or expired OTP' };
    const post = mock(async () => {
      throw httpError(401, data);
    });

    expect(await createSignupPost(fakeClient(post))(VERIFY_REQUEST)).toEqual({ status: 401, data });
  });

  it('delivers resend 401 as HTTP 401', async () => {
    const data = { error: 'Invalid or expired OTP' };
    const post = mock(async () => {
      throw httpError(401, data);
    });

    expect(await createSignupPost(fakeClient(post))(RESEND_REQUEST)).toEqual({ status: 401, data });
  });

  it('preserves status and data for every signup error response', async () => {
    for (const status of [400, 401, 409, 429, 503]) {
      const data = { error: `status-${status}` };
      const post = mock(async () => {
        throw httpError(status, data);
      });

      expect(await createSignupPost(fakeClient(post))(VERIFY_REQUEST)).toEqual({ status, data });
    }
  });

  it('preserves successful responses', async () => {
    const data = { verificationRequired: true, channel: 'email', userId: 'user-123' };
    const post = mock(async () => ({ status: 200, data }));

    expect(await createSignupPost(fakeClient(post))(VERIFY_REQUEST)).toEqual({ status: 200, data });
  });

  it('keeps network failures distinct from HTTP errors', async () => {
    const post = mock(async () => {
      throw new Error('Network Error');
    });

    await expect(createSignupPost(fakeClient(post))(VERIFY_REQUEST)).rejects.toThrow('Network Error');
  });

  it('does not use the global interceptors or delete an existing auth_token', async () => {
    const client = createSignupClient();
    expect(client.interceptors.request.handlers?.length ?? 0).toBe(0);
    expect(client.interceptors.response.handlers?.length ?? 0).toBe(0);

    client.defaults.adapter = async () => {
      throw httpError(401, { error: 'Invalid or expired OTP' });
    };

    expect((await createSignupPost(client)(VERIFY_REQUEST)).status).toBe(401);
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

describe('global API client', () => {
  it('still deletes auth_token on any 401 response', async () => {
    expect(api.interceptors.response.handlers?.length).toBe(1);
    const rejected = api.interceptors.response.handlers?.[0]?.rejected;
    expect(rejected).toBeDefined();

    await expect(rejected?.(httpError(401, {}))).rejects.toBeDefined();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });

  it('still attaches the stored Bearer token to requests', async () => {
    expect(api.interceptors.request.handlers?.length).toBe(1);
    const fulfilled = api.interceptors.request.handlers?.[0]?.fulfilled;
    expect(fulfilled).toBeDefined();

    const config = { headers: {} } as InternalAxiosRequestConfig;
    const result = await fulfilled?.(config);

    expect(result?.headers.Authorization).toBe('Bearer existing-token');
  });
});
