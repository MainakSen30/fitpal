/// <reference types="bun-types" />
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  createSignupService,
  mapResendResult,
  mapVerifyResult,
  resetSignupCoordinatorForTests,
  type AcceptedPendingSignup,
  type SignupActions,
} from '../../src/lib/signup';
import type { PendingSignupRecord } from '../../src/lib/signup-storage';

Object.assign(globalThis, { __DEV__: false });

const secureStore = {
  getItemAsync: mock(async (_key: string) => null as string | null),
  setItemAsync: mock(async (_key: string, _value: string) => {}),
  deleteItemAsync: mock(async (_key: string) => {}),
};

mock.module('expo-secure-store', () => ({ default: secureStore, ...secureStore }));

type SignupStorageModule = typeof import('../../src/lib/signup-storage');
let signupStorage!: SignupStorageModule;

const NOW = 1_700_000_000_000;

const post = mock<SignupActions['post']>(async () => ({ status: 200, data: { token: 'session-token' } }));
const storage = {
  loadPending: mock(async () => null as AcceptedPendingSignup | null),
  savePending: mock(async () => {}),
  clearPending: mock(async () => {}),
  loadSessionToken: mock(async () => null as string | null),
  saveSessionToken: mock(async (_token: string) => {}),
};

const ACCEPTED: AcceptedPendingSignup = {
  kind: 'accepted',
  userId: 'user-123',
  channel: 'email',
  createdAt: NOW,
  email: 'ada@example.com',
  phone: '+14155550123',
};

const RECORD: PendingSignupRecord = { pending: ACCEPTED, createdAt: NOW, updatedAt: NOW };

beforeAll(async () => {
  signupStorage = await import('../../src/lib/signup-storage');
});

beforeEach(() => {
  resetSignupCoordinatorForTests();
  post.mockClear();
  post.mockImplementation(async () => ({ status: 200, data: { token: 'session-token' } }));
  storage.loadPending.mockClear();
  storage.loadPending.mockImplementation(async () => null);
  storage.savePending.mockClear();
  storage.savePending.mockImplementation(async () => {});
  storage.clearPending.mockClear();
  storage.clearPending.mockImplementation(async () => {});
  storage.loadSessionToken.mockClear();
  storage.loadSessionToken.mockImplementation(async () => null);
  storage.saveSessionToken.mockClear();
  storage.saveSessionToken.mockImplementation(async () => {});
});

describe('OTP input and cooldown', () => {
  it('accepts only six digits and strips non-digits', () => {
    expect(signupStorage.normalizeOtpCode('12a34-56x')).toBe('123456');
    expect(signupStorage.isValidOtpCode('123456')).toBe(true);
    expect(signupStorage.isValidOtpCode('12345')).toBe(false);
    expect(signupStorage.isValidOtpCode('abcdef')).toBe(false);
  });

  it('derives the resend cooldown from the persisted timestamp', () => {
    expect(signupStorage.resendCooldownRemaining(NOW, NOW)).toBe(60);
    expect(signupStorage.resendCooldownRemaining(NOW, NOW + 30_000)).toBe(30);
    expect(signupStorage.resendCooldownRemaining(NOW, NOW + 60_000)).toBe(0);
  });
});

describe('verification result handling', () => {
  it('reports verified success and cleanup failure without leaking secrets', () => {
    expect(mapVerifyResult({ kind: 'verified' })).toEqual({ kind: 'success' });
    expect(mapVerifyResult({ kind: 'verified', pendingCleanupFailed: true })).toEqual({
      kind: 'success',
      cleanupFailed: true,
    });
  });

  it('maps invalid, expired, lockout, rate-limit, and network outcomes safely', () => {
    expect(mapVerifyResult({ kind: 'invalidOrExpiredCode' }).kind).toBe('error');
    expect(mapVerifyResult({ kind: 'codeLockout' }).kind).toBe('error');
    expect(mapVerifyResult({ kind: 'rateLimit' }).kind).toBe('error');
    expect(mapVerifyResult({ kind: 'networkFailure' }).kind).toBe('error');

    const message = mapVerifyResult({ kind: 'invalidOrExpiredCode' });
    expect(message.kind === 'error' && message.message).toContain('invalid or has expired');
  });

  it('does not report login success when session-token persistence fails', () => {
    const outcome = mapVerifyResult({ kind: 'sessionPersistenceFailed', pending: ACCEPTED });

    expect(outcome.kind).toBe('sessionPersistenceFailed');
    if (outcome.kind === 'sessionPersistenceFailed') {
      expect(outcome.message).toContain('sign in with your password');
    }
  });

  it('routes missing pending state back to signup', () => {
    const outcome = mapVerifyResult({ kind: 'invalidPendingSignup' });
    expect(outcome.kind).toBe('restart');
  });
});

describe('resend result handling', () => {
  it('maps resend success, delivery failure, and restart outcomes', () => {
    expect(mapResendResult({ kind: 'pending', source: 'resend', pending: ACCEPTED }).kind).toBe('resent');
    expect(mapResendResult({
      kind: 'deliveryUnavailable',
      pending: {} as never,
      continuationToken: 'continuation-token',
    }).kind).toBe('deliveryUnavailable');
    expect(mapResendResult({ kind: 'invalidPendingSignup' }).kind).toBe('restart');
  });

  it('surfaces rate-limit and persistence failures without retrying automatically', () => {
    const rate = mapResendResult({ kind: 'rateLimit' });
    const persistence = mapResendResult({ kind: 'pendingPersistenceFailed', pending: ACCEPTED });

    expect(rate.kind).toBe('error');
    expect(persistence.kind).toBe('error');
    if (persistence.kind === 'error') expect(persistence.message).toContain('could not be saved');
  });
});

describe('restart recovery', () => {
  it('restores accepted pending state from SecureStore-backed storage', async () => {
    const result = await signupStorage.loadVerifyContext({
      service: { loadPending: async () => ({ kind: 'loaded', pending: ACCEPTED }) },
      storage: {
        loadSessionToken: async () => null,
        loadPendingRecord: async () => RECORD,
      },
      now: () => NOW,
    });

    expect(result).toEqual({ kind: 'ready', record: RECORD });
  });

  it('routes authenticated users away from verification', async () => {
    const result = await signupStorage.loadVerifyContext({
      service: { loadPending: async () => ({ kind: 'none' }) },
      storage: {
        loadSessionToken: async () => 'session-token',
        loadPendingRecord: async () => null,
      },
    });

    expect(result).toEqual({ kind: 'authenticated' });
  });

  it('treats missing or expired pending state as no verification', async () => {
    const missing = await signupStorage.loadVerifyContext({
      service: { loadPending: async () => ({ kind: 'none' }) },
      storage: { loadSessionToken: async () => null, loadPendingRecord: async () => null },
    });
    const expired = await signupStorage.loadVerifyContext({
      service: { loadPending: async () => ({ kind: 'loaded', pending: ACCEPTED }) },
      storage: { loadSessionToken: async () => null, loadPendingRecord: async () => null },
      now: () => NOW,
    });

    expect(missing).toEqual({ kind: 'none' });
    expect(expired).toEqual({ kind: 'none' });
  });

  it('surfaces SecureStore read failures instead of discarding pending state', async () => {
    const tokenFailure = await signupStorage.loadVerifyContext({
      service: { loadPending: async () => ({ kind: 'none' }) },
      storage: {
        loadSessionToken: async () => { throw new Error('SecureStore read failed'); },
        loadPendingRecord: async () => null,
      },
    });
    const pendingFailure = await signupStorage.loadVerifyContext({
      service: { loadPending: async () => ({ kind: 'failed' }) },
      storage: { loadSessionToken: async () => null, loadPendingRecord: async () => null },
    });

    expect(tokenFailure).toEqual({ kind: 'failed' });
    expect(pendingFailure).toEqual({ kind: 'failed' });
  });
});

describe('verification service integration', () => {
  it('saves the session token and clears pending state on success', async () => {
    storage.loadPending.mockImplementation(async () => ACCEPTED);
    const service = createSignupService({ post, ...storage });

    const result = await service.verify({ code: '123456' });

    expect(post).toHaveBeenCalledWith({
      url: '/auth/signup/verify',
      body: { userId: ACCEPTED.userId, channel: ACCEPTED.channel, code: '123456' },
    });
    expect(result).toEqual({ kind: 'verified' });
    expect(storage.saveSessionToken).toHaveBeenCalledWith('session-token');
    expect(storage.clearPending).toHaveBeenCalledTimes(1);
  });

  it('reports a recoverable session-token persistence failure', async () => {
    storage.loadPending.mockImplementation(async () => ACCEPTED);
    storage.saveSessionToken.mockImplementation(async () => {
      throw new Error('SecureStore write failed');
    });
    const service = createSignupService({ post, ...storage });

    const result = await service.verify({ code: '123456' });

    expect(result.kind).toBe('sessionPersistenceFailed');
    if (result.kind === 'sessionPersistenceFailed') {
      const outcome = mapVerifyResult(result);
      expect(outcome.kind).toBe('sessionPersistenceFailed');
      if (outcome.kind === 'sessionPersistenceFailed') {
        expect(outcome.message).toContain('sign in with your password');
      }
    }
    expect(storage.clearPending).toHaveBeenCalledTimes(1);
  });
});
