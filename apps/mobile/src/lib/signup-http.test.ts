/// <reference types="bun-types" />
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { SignupRequest } from './signup';

const secureStore = {
  getItemAsync: mock(async () => 'existing-token'),
  setItemAsync: mock(async (_key: string, _value: string) => {}),
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
let publicApi!: typeof import('./api')['publicApi'];
let session!: typeof import('./session')['session'];

beforeAll(async () => {
  ({ api, publicApi } = await import('./api'));
  ({ session } = await import('./session'));
  ({ createSignupClient, createSignupPost } = await import('./signup-http'));
});

beforeEach(() => {
  session.logoutCompleted();
  secureStore.getItemAsync.mockClear();
  secureStore.setItemAsync.mockClear();
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

function httpError(status: number, data: unknown, headers: Record<string, string> = {}) {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data },
    config: { headers },
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

  it('does not use the global interceptors or invalidate an existing session', async () => {
    session.establish('active-token');
    const client = createSignupClient();
    expect(client.interceptors.request.handlers?.length ?? 0).toBe(0);
    expect(client.interceptors.response.handlers?.length ?? 0).toBe(0);

    client.defaults.adapter = async () => {
      throw httpError(401, { error: 'Invalid or expired OTP' });
    };

    expect((await createSignupPost(client)(VERIFY_REQUEST)).status).toBe(401);
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(session.currentToken()).toBe('active-token');
  });
});

describe('public auth client', () => {
  it('has no interceptors, so a login-style 401 cannot clear an active session', async () => {
    session.establish('active-token');
    expect(publicApi.interceptors.request.handlers?.length ?? 0).toBe(0);
    expect(publicApi.interceptors.response.handlers?.length ?? 0).toBe(0);

    publicApi.defaults.adapter = async () => {
      throw httpError(401, { error: 'Invalid email or password' });
    };
    await expect(publicApi.post('/auth/login', {})).rejects.toBeDefined();
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(session.currentToken()).toBe('active-token');
  });

  it('never reads or deletes an auth token', async () => {
    session.establish('active-token');
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
  });
});

describe('protected API client', () => {
  it('attaches the current session token rather than an arbitrary stored token', async () => {
    session.establish('current-token');
    const fulfilled = api.interceptors.request.handlers?.[0]?.fulfilled;
    expect(fulfilled).toBeDefined();

    const config = { headers: {} } as InternalAxiosRequestConfig;
    const result = await fulfilled?.(config);

    expect(result?.headers.Authorization).toBe('Bearer current-token');
    expect(secureStore.getItemAsync).not.toHaveBeenCalled();
  });

  it('invalidates a 401 only when it rejects the active session token', async () => {
    session.establish('current-token');
    const rejected = api.interceptors.response.handlers?.[0]?.rejected;
    expect(rejected).toBeDefined();

    await expect(
      rejected?.(httpError(401, {}, { Authorization: 'Bearer current-token' })),
    ).rejects.toBeDefined();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
  });

  it('ignores public 401s, stale 401s, and non-401 4xx responses', async () => {
    session.establish('current-token');
    const rejected = api.interceptors.response.handlers?.[0]?.rejected;
    expect(rejected).toBeDefined();

    await expect(rejected?.(httpError(401, {}))).rejects.toBeDefined();
    await expect(
      rejected?.(httpError(401, {}, { Authorization: 'Bearer old-token' })),
    ).rejects.toBeDefined();
    await expect(
      rejected?.(httpError(400, {}, { Authorization: 'Bearer current-token' })),
    ).rejects.toBeDefined();

    expect(secureStore.deleteItemAsync).not.toHaveBeenCalled();
    expect(session.currentToken()).toBe('current-token');
  });
});
