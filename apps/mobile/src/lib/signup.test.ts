/// <reference types="bun-types" />
import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import {
  createSignupService,
  resetSignupCoordinatorForTests,
  type AcceptedPendingSignup,
  type DeliveryFailedPendingSignup,
  type PendingSignup,
  type RegisterInput,
  type SignupActions,
} from './signup';

const NOW = 1_700_000_000_000;
const LOCKOUT_MESSAGE = 'Too many incorrect attempts. Request a new code after the lock expires.';
const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later.';
const DELIVERY_UNAVAILABLE_MESSAGE = 'Verification request could not be completed';

const REGISTER_INPUT: RegisterInput = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+14155550123',
  password: 'super-secret-password',
  verificationChannel: 'email',
};

const ACCEPTED_PENDING: AcceptedPendingSignup = {
  kind: 'accepted',
  userId: 'user-123',
  channel: 'email',
  createdAt: NOW,
  email: REGISTER_INPUT.email,
  phone: REGISTER_INPUT.phone,
};

const FAILED_PENDING: DeliveryFailedPendingSignup = {
  kind: 'delivery-failed',
  continuationToken: 'old-continuation-token',
  createdAt: NOW,
  email: REGISTER_INPUT.email,
  phone: REGISTER_INPUT.phone,
};

function http(status: number, data: unknown = {}) {
  return mock(async () => ({ status, data }));
}

function deps(overrides: Partial<SignupActions> = {}) {
  let saved: PendingSignup | null = null;

  return {
    post: http(202, { verificationRequired: true, channel: 'email', userId: 'user-123' }),
    loadPending: mock(async () => saved),
    savePending: mock(async (pending: PendingSignup) => {
      saved = pending;
    }),
    clearPending: mock(async () => {
      saved = null;
    }),
    saveSessionToken: mock(async (_token: string) => {}),
    now: () => NOW,
    ...overrides,
  };
}

function storeDeps(
  store: { current: PendingSignup | null },
  overrides: Partial<SignupActions> = {},
) {
  return {
    post: http(202, { verificationRequired: true, channel: 'email', userId: 'user-123' }),
    loadPending: mock(async () => store.current),
    savePending: mock(async (pending: PendingSignup) => {
      store.current = pending;
    }),
    clearPending: mock(async () => {
      store.current = null;
    }),
    saveSessionToken: mock(async (_token: string) => {}),
    now: () => NOW,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = (value) => res(value);
  });
  return { promise, resolve };
}

function deliveryPending(token: string): DeliveryFailedPendingSignup {
  return {
    kind: 'delivery-failed',
    continuationToken: token,
    createdAt: NOW,
    email: REGISTER_INPUT.email,
    phone: REGISTER_INPUT.phone,
  };
}

function acceptedPendingState(userId: string, channel: 'email' | 'sms'): AcceptedPendingSignup {
  return {
    kind: 'accepted',
    userId,
    channel,
    createdAt: NOW,
    email: REGISTER_INPUT.email,
    phone: REGISTER_INPUT.phone,
  };
}

beforeEach(() => {
  resetSignupCoordinatorForTests();
});

describe('createSignupService.register', () => {
  it('sends exactly the five required registration fields', async () => {
    const actions = deps();
    await createSignupService(actions).register(REGISTER_INPUT);

    expect(actions.post).toHaveBeenCalledWith({
      url: '/auth/register',
      body: {
        name: REGISTER_INPUT.name,
        email: REGISTER_INPUT.email,
        phone: REGISTER_INPUT.phone,
        password: REGISTER_INPUT.password,
        verificationChannel: REGISTER_INPUT.verificationChannel,
      },
    });
  });

  it('persists accepted pending state on 202', async () => {
    const actions = deps();
    const result = await createSignupService(actions).register(REGISTER_INPUT);

    expect(result).toEqual({ kind: 'pending', source: 'register', pending: ACCEPTED_PENDING });
    expect(actions.savePending).toHaveBeenCalledWith(ACCEPTED_PENDING);
  });

  it('does not write auth_token on 202', async () => {
    const actions = deps();
    await createSignupService(actions).register(REGISTER_INPUT);

    expect(actions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('persists the continuation token as pending on 503', async () => {
    const actions = deps({
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'new-continuation-token',
      }),
    });
    const result = await createSignupService(actions).register(REGISTER_INPUT);

    expect(result).toEqual({
      kind: 'deliveryUnavailable',
      continuationToken: 'new-continuation-token',
      pending: {
        kind: 'delivery-failed',
        continuationToken: 'new-continuation-token',
        createdAt: NOW,
        email: REGISTER_INPUT.email,
        phone: REGISTER_INPUT.phone,
      },
    });
    expect(actions.savePending).toHaveBeenCalledWith({
      kind: 'delivery-failed',
      continuationToken: 'new-continuation-token',
      createdAt: NOW,
      email: REGISTER_INPUT.email,
      phone: REGISTER_INPUT.phone,
    });
    expect(actions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('maps 409 to a neutral duplicate-registration outcome', async () => {
    const actions = deps({
      post: http(409, { error: 'Registration could not be completed' }),
    });

    expect(await createSignupService(actions).register(REGISTER_INPUT)).toEqual({
      kind: 'duplicateRegistration',
    });
    expect(actions.savePending).not.toHaveBeenCalled();
    expect(actions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('maps 429 to a rate-limit outcome', async () => {
    const actions = deps({
      post: http(429, { error: RATE_LIMIT_MESSAGE }),
    });

    expect(await createSignupService(actions).register(REGISTER_INPUT)).toEqual({ kind: 'rateLimit' });
    expect(actions.savePending).not.toHaveBeenCalled();
  });

  it('does not create an authenticated session on network failure', async () => {
    const actions = deps({
      post: mock(async () => {
        throw new Error('Network Error');
      }),
    });

    expect(await createSignupService(actions).register(REGISTER_INPUT)).toEqual({
      kind: 'networkFailure',
    });
    expect(actions.savePending).not.toHaveBeenCalled();
    expect(actions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('returns pending state in memory when 202 persistence fails', async () => {
    const actions = deps({
      savePending: mock(async (_pending: PendingSignup) => {
        throw new Error('SecureStore write failed');
      }),
    });

    expect(await createSignupService(actions).register(REGISTER_INPUT)).toEqual({
      kind: 'pendingPersistenceFailed',
      pending: ACCEPTED_PENDING,
    });
    expect(actions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('returns rotated state in memory when 503 persistence fails', async () => {
    const actions = deps({
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'new-continuation-token',
      }),
      savePending: mock(async (_pending: PendingSignup) => {
        throw new Error('SecureStore write failed');
      }),
    });

    expect(await createSignupService(actions).register(REGISTER_INPUT)).toEqual({
      kind: 'pendingPersistenceFailed',
      pending: {
        kind: 'delivery-failed',
        continuationToken: 'new-continuation-token',
        createdAt: NOW,
        email: REGISTER_INPUT.email,
        phone: REGISTER_INPUT.phone,
      },
    });
    expect(actions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('does not label an unexpected registration 401 as invalidPendingSignup', async () => {
    const actions = deps({ post: http(401, { error: 'Unexpected' }) });

    expect(await createSignupService(actions).register(REGISTER_INPUT)).toEqual({
      kind: 'unexpectedServerError',
    });
  });
});

describe('createSignupService.verify', () => {
  it('stores the session token and clears pending state on 200', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(200, { user: { id: 'user-123' }, token: 'session-token' }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({ kind: 'verified' });
    expect(actions.post).toHaveBeenCalledWith({
      url: '/auth/signup/verify',
      body: { userId: 'user-123', channel: 'email', code: '123456' },
    });
    expect(actions.saveSessionToken).toHaveBeenCalledWith('session-token');
    expect(actions.clearPending).toHaveBeenCalledTimes(1);
  });

  it('preserves pending state on 401', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(401, { error: 'Invalid or expired OTP' }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'invalidOrExpiredCode',
    });
    expect(actions.savePending).not.toHaveBeenCalled();
    expect(actions.clearPending).not.toHaveBeenCalled();
  });

  it('does not write auth_token on 401', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(401, { error: 'Invalid or expired OTP' }),
    });

    await createSignupService(actions).verify({ code: '123456' });

    expect(actions.saveSessionToken).not.toHaveBeenCalled();
    expect(actions.clearPending).not.toHaveBeenCalled();
  });

  it('maps incorrect and expired OTP responses to the same outcome', async () => {
    const incorrect = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(401, { error: 'Invalid or expired OTP' }),
    });
    const expired = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(401, {}),
    });

    const incorrectResult = await createSignupService(incorrect).verify({ code: '000000' });
    const expiredResult = await createSignupService(expired).verify({ code: '111111' });

    expect(incorrectResult).toEqual(expiredResult);
    expect(incorrectResult).toEqual({ kind: 'invalidOrExpiredCode' });
  });

  it('preserves pending state on the exact lockout message', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(400, { error: LOCKOUT_MESSAGE }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'codeLockout',
    });
    expect(actions.savePending).not.toHaveBeenCalled();
    expect(actions.clearPending).not.toHaveBeenCalled();
    expect(actions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('maps the exact delivery-unavailable 400 to rateLimit', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(400, { error: DELIVERY_UNAVAILABLE_MESSAGE }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'rateLimit',
    });
  });

  it('preserves pending state on 429', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(429, { error: RATE_LIMIT_MESSAGE }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({ kind: 'rateLimit' });
    expect(actions.savePending).not.toHaveBeenCalled();
    expect(actions.clearPending).not.toHaveBeenCalled();
    expect(actions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('preserves pending state on network failure', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: mock(async () => {
        throw new Error('Network Error');
      }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'networkFailure',
    });
    expect(actions.savePending).not.toHaveBeenCalled();
    expect(actions.clearPending).not.toHaveBeenCalled();
    expect(actions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('reports verified with a cleanup warning when token persistence succeeds but cleanup fails', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(200, { token: 'session-token' }),
      clearPending: mock(async () => {
        throw new Error('SecureStore delete failed');
      }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'verified',
      pendingCleanupFailed: true,
    });
    expect(actions.saveSessionToken).toHaveBeenCalledWith('session-token');
    expect(actions.clearPending).toHaveBeenCalledTimes(1);
  });

  it('does not report authentication success when token persistence fails', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(200, { token: 'session-token' }),
      saveSessionToken: mock(async (_token: string) => {
        throw new Error('SecureStore write failed');
      }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'unexpectedServerError',
    });
    expect(actions.clearPending).not.toHaveBeenCalled();
  });

  it('does not classify an unknown 400 as a confirmed lockout', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(400, { error: 'Something unexpected' }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'unrecognizedBadRequest',
    });
  });

  it('requires the exact lockout message before classifying a lockout', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(400, { error: 'Too many incorrect attempts' }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'unrecognizedBadRequest',
    });
  });

  it('classifies Zod validation responses as validation errors', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(400, {
        success: false,
        error: { issues: [{ path: ['code'], message: 'Required' }], name: 'ZodError' },
      }),
    });

    expect(await createSignupService(actions).verify({ code: '' })).toEqual({
      kind: 'validationError',
    });
  });

  it('fails before any request when pending state cannot be read', async () => {
    const actions = deps({
      loadPending: mock(async () => {
        throw new Error('SecureStore read failed');
      }),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'pendingReadFailed',
    });
    expect(actions.post).not.toHaveBeenCalled();
  });

  it('does not verify from a delivery-failed pending record', async () => {
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
    });

    expect(await createSignupService(actions).verify({ code: '123456' })).toEqual({
      kind: 'invalidPendingSignup',
    });
    expect(actions.post).not.toHaveBeenCalled();
  });
});

describe('createSignupService.resend', () => {
  it('sends only continuationToken when one exists', async () => {
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
      post: http(200, { verificationRequired: true, channel: 'sms', userId: 'user-123' }),
    });

    await createSignupService(actions).resend();

    expect(actions.post).toHaveBeenCalledWith({
      url: '/auth/signup/resend',
      body: { continuationToken: 'old-continuation-token' },
    });
  });

  it('sends only userId when no continuation token exists', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(200, { verificationRequired: true, channel: 'email', userId: 'user-123' }),
    });

    await createSignupService(actions).resend();

    expect(actions.post).toHaveBeenCalledWith({
      url: '/auth/signup/resend',
      body: { userId: 'user-123' },
    });
  });

  it('updates userId/channel and removes continuation token on 200', async () => {
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
      post: http(200, { verificationRequired: true, channel: 'sms', userId: 'user-456' }),
    });

    const result = await createSignupService(actions).resend();

    expect(result).toEqual({
      kind: 'pending',
      source: 'resend',
      pending: {
        kind: 'accepted',
        userId: 'user-456',
        channel: 'sms',
        createdAt: NOW,
        email: REGISTER_INPUT.email,
        phone: REGISTER_INPUT.phone,
      },
    });
    expect(actions.savePending).toHaveBeenCalledWith({
      kind: 'accepted',
      userId: 'user-456',
      channel: 'sms',
      createdAt: NOW,
      email: REGISTER_INPUT.email,
      phone: REGISTER_INPUT.phone,
    });
  });

  it('replaces the old continuation token on 503', async () => {
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'rotated-continuation-token',
      }),
    });

    const result = await createSignupService(actions).resend();

    expect(result).toEqual({
      kind: 'deliveryUnavailable',
      continuationToken: 'rotated-continuation-token',
      pending: {
        kind: 'delivery-failed',
        continuationToken: 'rotated-continuation-token',
        createdAt: NOW,
        email: REGISTER_INPUT.email,
        phone: REGISTER_INPUT.phone,
      },
    });
    expect(actions.savePending).toHaveBeenCalledWith({
      kind: 'delivery-failed',
      continuationToken: 'rotated-continuation-token',
      createdAt: NOW,
      email: REGISTER_INPUT.email,
      phone: REGISTER_INPUT.phone,
    });
  });

  it('handles resend 401 differently from verification 401', async () => {
    const verifyActions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(401, { error: 'Invalid or expired OTP' }),
    });
    const resendActions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(401, { error: 'Invalid or expired OTP' }),
    });

    const verifyResult = await createSignupService(verifyActions).verify({ code: '123456' });
    const resendResult = await createSignupService(resendActions).resend();

    expect(verifyResult).toEqual({ kind: 'invalidOrExpiredCode' });
    expect(resendResult).toEqual({ kind: 'invalidPendingSignup' });
    expect(verifyResult).not.toEqual(resendResult);
    expect(verifyActions.clearPending).not.toHaveBeenCalled();
    expect(resendActions.clearPending).toHaveBeenCalledTimes(1);
    expect(verifyActions.saveSessionToken).not.toHaveBeenCalled();
    expect(resendActions.saveSessionToken).not.toHaveBeenCalled();
  });

  it('keeps the rotated token in memory when 503 persistence fails', async () => {
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'rotated-continuation-token',
      }),
      savePending: mock(async (_pending: PendingSignup) => {
        throw new Error('SecureStore write failed');
      }),
    });

    expect(await createSignupService(actions).resend()).toEqual({
      kind: 'pendingPersistenceFailed',
      pending: {
        kind: 'delivery-failed',
        continuationToken: 'rotated-continuation-token',
        createdAt: NOW,
        email: REGISTER_INPUT.email,
        phone: REGISTER_INPUT.phone,
      },
    });
    expect(actions.post).toHaveBeenCalledTimes(1);
    expect(actions.savePending).toHaveBeenCalledWith({
      kind: 'delivery-failed',
      continuationToken: 'rotated-continuation-token',
      createdAt: NOW,
      email: REGISTER_INPUT.email,
      phone: REGISTER_INPUT.phone,
    });
  });

  it('keeps the accepted state in memory when 200 persistence fails', async () => {
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
      post: http(200, { verificationRequired: true, channel: 'sms', userId: 'user-456' }),
      savePending: mock(async (_pending: PendingSignup) => {
        throw new Error('SecureStore write failed');
      }),
    });

    expect(await createSignupService(actions).resend()).toEqual({
      kind: 'pendingPersistenceFailed',
      pending: {
        kind: 'accepted',
        userId: 'user-456',
        channel: 'sms',
        createdAt: NOW,
        email: REGISTER_INPUT.email,
        phone: REGISTER_INPUT.phone,
      },
    });
    expect(actions.post).toHaveBeenCalledTimes(1);
    expect(actions.savePending).toHaveBeenCalledWith({
      kind: 'accepted',
      userId: 'user-456',
      channel: 'sms',
      createdAt: NOW,
      email: REGISTER_INPUT.email,
      phone: REGISTER_INPUT.phone,
    });
  });

  it('reports resend 401 cleanup failure to the caller', async () => {
    const actions = deps({
      loadPending: mock(async () => ACCEPTED_PENDING),
      post: http(401, { error: 'Invalid or expired OTP' }),
      clearPending: mock(async () => {
        throw new Error('SecureStore delete failed');
      }),
    });

    expect(await createSignupService(actions).resend()).toEqual({
      kind: 'invalidPendingSignup',
      cleanupFailed: true,
    });
    expect(actions.clearPending).toHaveBeenCalledTimes(1);
  });

  it('fails before any request when pending state cannot be read', async () => {
    const actions = deps({
      loadPending: mock(async () => {
        throw new Error('SecureStore read failed');
      }),
    });

    expect(await createSignupService(actions).resend()).toEqual({ kind: 'pendingReadFailed' });
    expect(actions.post).not.toHaveBeenCalled();
  });

  it('does not resend when no pending signup exists', async () => {
    const actions = deps({
      loadPending: mock(async () => null),
    });

    expect(await createSignupService(actions).resend()).toEqual({ kind: 'invalidPendingSignup' });
    expect(actions.post).not.toHaveBeenCalled();
  });
});

describe('createSignupService.loadPending', () => {
  it('distinguishes no pending signup from a loaded state', async () => {
    const empty = deps({ loadPending: mock(async () => null) });
    const loaded = deps({ loadPending: mock(async () => ACCEPTED_PENDING) });

    expect(await createSignupService(empty).loadPending()).toEqual({ kind: 'none' });
    expect(await createSignupService(loaded).loadPending()).toEqual({
      kind: 'loaded',
      pending: ACCEPTED_PENDING,
    });
  });

  it('reports a storage read failure instead of an empty state', async () => {
    const actions = deps({
      loadPending: mock(async () => {
        throw new Error('SecureStore read failed');
      }),
    });

    expect(await createSignupService(actions).loadPending()).toEqual({ kind: 'failed' });
  });

  it('rejects malformed persisted state as a failed read', async () => {
    const actions = deps({
      loadPending: mock(async () => ({ kind: 'accepted', userId: 'user-123' }) as PendingSignup),
    });

    expect(await createSignupService(actions).loadPending()).toEqual({ kind: 'failed' });
  });

  it('accepts a finite timestamp and rejects non-finite timestamps', async () => {
    const valid = deps({ loadPending: mock(async () => ACCEPTED_PENDING) });
    expect(await createSignupService(valid).loadPending()).toEqual({
      kind: 'loaded',
      pending: ACCEPTED_PENDING,
    });

    for (const createdAt of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const actions = deps({
        loadPending: mock(async () => ({ ...ACCEPTED_PENDING, createdAt }) as PendingSignup),
      });

      expect(await createSignupService(actions).loadPending()).toEqual({ kind: 'failed' });
    }
  });
});

describe('createSignupService.persistPending', () => {
  it('retries local persistence without making another HTTP request', async () => {
    const actions = deps();

    expect(await createSignupService(actions).persistPending(FAILED_PENDING)).toBe(true);
    expect(actions.savePending).toHaveBeenCalledWith(FAILED_PENDING);
    expect(actions.post).not.toHaveBeenCalled();
  });

  it('returns false when the local persistence retry fails without an HTTP request', async () => {
    const actions = deps({
      savePending: mock(async (_pending: PendingSignup) => {
        throw new Error('SecureStore write failed');
      }),
    });

    expect(await createSignupService(actions).persistPending(FAILED_PENDING)).toBe(false);
    expect(actions.post).not.toHaveBeenCalled();
  });
});

describe('createSignupService authoritative pending state', () => {
  it('keeps the rotated token authoritative after resend 503 persistence failure', async () => {
    const rotated = deliveryPending('rotated-token');
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'rotated-token',
      }),
      savePending: mock(async () => {
        throw new Error('SecureStore write failed');
      }),
    });
    const service = createSignupService(actions);

    expect(await service.resend()).toEqual({
      kind: 'pendingPersistenceFailed',
      pending: rotated,
    });
    expect(await service.loadPending()).toEqual({ kind: 'loaded', pending: rotated });
    expect(actions.loadPending).toHaveBeenCalledTimes(1);
  });

  it('clears the override after a successful local retry without another request', async () => {
    let shouldFail = true;
    let saved: PendingSignup | null = FAILED_PENDING;
    const rotated = deliveryPending('rotated-token');
    const actions = deps({
      loadPending: mock(async () => saved),
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'rotated-token',
      }),
      savePending: mock(async (pending: PendingSignup) => {
        if (shouldFail) throw new Error('SecureStore write failed');
        saved = pending;
      }),
    });
    const service = createSignupService(actions);

    await service.resend();
    shouldFail = false;

    expect(await service.persistPending(rotated)).toBe(true);
    expect(actions.post).toHaveBeenCalledTimes(1);
    expect(actions.savePending).toHaveBeenCalledTimes(2);
    expect(await service.loadPending()).toEqual({ kind: 'loaded', pending: rotated });
    expect(actions.loadPending).toHaveBeenCalledTimes(2);
  });

  it('preserves the override when the local retry fails again', async () => {
    const rotated = deliveryPending('rotated-token');
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'rotated-token',
      }),
      savePending: mock(async () => {
        throw new Error('SecureStore write failed');
      }),
    });
    const service = createSignupService(actions);

    await service.resend();

    expect(await service.persistPending(rotated)).toBe(false);
    expect(await service.loadPending()).toEqual({ kind: 'loaded', pending: rotated });
    expect(actions.post).toHaveBeenCalledTimes(1);
    expect(actions.loadPending).toHaveBeenCalledTimes(1);
  });

  it('does not let an older retry clear a newer authoritative state', async () => {
    const retryWrite = deferred<void>();
    const rotated = deliveryPending('rotated-token');
    let saveCalls = 0;
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'rotated-token',
      }),
      savePending: mock(async () => {
        saveCalls += 1;
        if (saveCalls === 1) throw new Error('SecureStore write failed');
        if (saveCalls === 2) return retryWrite.promise;
        throw new Error('SecureStore write failed');
      }),
    });
    const service = createSignupService(actions);

    await service.resend();
    const retry = service.persistPending(rotated);
    await service.resend();
    retryWrite.resolve(undefined);
    await retry;

    expect(await service.loadPending()).toEqual({ kind: 'loaded', pending: rotated });
    expect(actions.loadPending).toHaveBeenCalledTimes(1);
  });

  it('does not resurrect stale state when an older write fails after a newer write succeeds', async () => {
    const oldWrite = deferred<void>();
    let saved: PendingSignup | null = FAILED_PENDING;
    let postCalls = 0;
    let saveCalls = 0;
    const actions = deps({
      loadPending: mock(async () => saved),
      post: mock(async () => {
        postCalls += 1;
        return {
          status: 503,
          data: {
            error: 'Verification delivery is unavailable',
            continuationToken: postCalls === 1 ? 'old-token' : 'new-token',
          },
        };
      }),
      savePending: mock(async (pending: PendingSignup) => {
        saveCalls += 1;
        if (saveCalls === 1) {
          await oldWrite.promise;
          throw new Error('SecureStore write failed');
        }
        saved = pending;
      }),
    });
    const service = createSignupService(actions);

    const older = service.resend();
    expect(await service.resend()).toEqual({
      kind: 'deliveryUnavailable',
      continuationToken: 'new-token',
      pending: deliveryPending('new-token'),
    });
    oldWrite.resolve(undefined);
    await older;

    expect(await service.loadPending()).toEqual({ kind: 'loaded', pending: deliveryPending('new-token') });
    expect(actions.loadPending).toHaveBeenCalledTimes(3);
  });

  it('keeps an accepted registration state authoritative after persistence failure', async () => {
    const actions = deps({
      savePending: mock(async () => {
        throw new Error('SecureStore write failed');
      }),
    });
    const service = createSignupService(actions);

    expect(await service.register(REGISTER_INPUT)).toEqual({
      kind: 'pendingPersistenceFailed',
      pending: ACCEPTED_PENDING,
    });
    expect(await service.loadPending()).toEqual({ kind: 'loaded', pending: ACCEPTED_PENDING });
    expect(actions.loadPending).not.toHaveBeenCalled();
  });

  it('retains an accepted state without a consumed token after resend 200 persistence failure', async () => {
    const expected = acceptedPendingState('user-456', 'sms');
    const actions = deps({
      loadPending: mock(async () => FAILED_PENDING),
      post: http(200, { verificationRequired: true, channel: 'sms', userId: 'user-456' }),
      savePending: mock(async () => {
        throw new Error('SecureStore write failed');
      }),
    });
    const service = createSignupService(actions);

    const result = await service.resend();

    expect(result).toEqual({ kind: 'pendingPersistenceFailed', pending: expected });
    if (result.kind === 'pendingPersistenceFailed') {
      expect(result.pending).not.toHaveProperty('continuationToken');
    }
    expect(await service.loadPending()).toEqual({ kind: 'loaded', pending: expected });
    expect(actions.loadPending).toHaveBeenCalledTimes(1);
  });

  it('clears the in-memory override when clearPending succeeds', async () => {
    let saved: PendingSignup | null = FAILED_PENDING;
    const actions = deps({
      savePending: mock(async () => {
        throw new Error('SecureStore write failed');
      }),
      loadPending: mock(async () => saved),
      clearPending: mock(async () => {
        saved = null;
      }),
    });
    const service = createSignupService(actions);

    await service.register(REGISTER_INPUT);

    expect(await service.clearPending()).toBe(true);
    expect(await service.loadPending()).toEqual({ kind: 'none' });
    expect(actions.loadPending).toHaveBeenCalledTimes(1);
  });
});

describe('shared signup coordinator', () => {
  it('shares a rotated token with a new instance after persistence failure', async () => {
    const store = { current: FAILED_PENDING as PendingSignup | null };
    const rotated = deliveryPending('rotated-token');
    const actionsA = storeDeps(store, {
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'rotated-token',
      }),
      savePending: mock(async () => {
        throw new Error('SecureStore write failed');
      }),
    });
    const actionsB = storeDeps(store);

    await createSignupService(actionsA).resend();

    const serviceB = createSignupService(actionsB);
    expect(await serviceB.loadPending()).toEqual({ kind: 'loaded', pending: rotated });
    expect(actionsB.loadPending).not.toHaveBeenCalled();

    expect(await serviceB.persistPending(rotated)).toBe(true);
    expect(actionsB.post).not.toHaveBeenCalled();
    expect(await serviceB.loadPending()).toEqual({ kind: 'loaded', pending: rotated });
    expect(actionsB.loadPending).toHaveBeenCalledTimes(1);
  });

  it('hides stale pending across instances after verification cleanup failure', async () => {
    const store = { current: ACCEPTED_PENDING as PendingSignup | null };
    const actionsA = storeDeps(store, {
      post: http(200, { token: 'session-token' }),
      clearPending: mock(async () => {
        throw new Error('SecureStore delete failed');
      }),
    });
    const actionsB = storeDeps(store);

    const serviceA = createSignupService(actionsA);
    expect(await serviceA.verify({ code: '123456' })).toEqual({
      kind: 'verified',
      pendingCleanupFailed: true,
    });
    expect(actionsA.saveSessionToken).toHaveBeenCalledWith('session-token');

    const serviceB = createSignupService(actionsB);
    expect(await serviceB.loadPending()).toEqual({ kind: 'none' });
    expect(actionsB.loadPending).not.toHaveBeenCalled();

    expect(await serviceB.clearPending()).toBe(true);
    expect(actionsB.post).not.toHaveBeenCalled();
    expect(await serviceB.loadPending()).toEqual({ kind: 'none' });
    expect(store.current).toBeNull();
  });

  it('publishes a tombstone after resend 401 cleanup failure', async () => {
    const store = { current: ACCEPTED_PENDING as PendingSignup | null };
    const actionsA = storeDeps(store, {
      post: http(401, { error: 'Invalid or expired OTP' }),
      clearPending: mock(async () => {
        throw new Error('SecureStore delete failed');
      }),
    });

    expect(await createSignupService(actionsA).resend()).toEqual({
      kind: 'invalidPendingSignup',
      cleanupFailed: true,
    });
    expect(await createSignupService(storeDeps(store)).loadPending()).toEqual({ kind: 'none' });
  });

  it('publishes a tombstone after explicit clear failure and keeps it on retry failure', async () => {
    const store = { current: FAILED_PENDING as PendingSignup | null };
    const actionsA = storeDeps(store, {
      clearPending: mock(async () => {
        throw new Error('SecureStore delete failed');
      }),
    });

    expect(await createSignupService(actionsA).clearPending()).toBe(false);

    const actionsB = storeDeps(store, {
      clearPending: mock(async () => {
        throw new Error('SecureStore delete failed');
      }),
    });
    const serviceB = createSignupService(actionsB);
    expect(await serviceB.loadPending()).toEqual({ kind: 'none' });
    expect(await serviceB.clearPending()).toBe(false);
    expect(await createSignupService(storeDeps(store)).loadPending()).toEqual({ kind: 'none' });
  });

  it('ignores an older pending write that completes after a newer pending state', async () => {
    const store = { current: FAILED_PENDING as PendingSignup | null };
    const oldWrite = deferred<void>();
    const actionsA = storeDeps(store, {
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'old-token',
      }),
      savePending: mock(async () => {
        await oldWrite.promise;
        throw new Error('SecureStore write failed');
      }),
    });
    const actionsB = storeDeps(store, {
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'new-token',
      }),
      savePending: mock(async () => {
        throw new Error('SecureStore write failed');
      }),
    });

    const older = createSignupService(actionsA).resend();
    expect(await createSignupService(actionsB).resend()).toEqual({
      kind: 'pendingPersistenceFailed',
      pending: deliveryPending('new-token'),
    });
    oldWrite.resolve(undefined);
    await older;

    expect(await createSignupService(storeDeps(store)).loadPending()).toEqual({
      kind: 'loaded',
      pending: deliveryPending('new-token'),
    });
  });

  it('does not let an older cleanup clear a newer pending state', async () => {
    const store = { current: ACCEPTED_PENDING as PendingSignup | null };
    const oldCleanup = deferred<void>();
    const actionsA = storeDeps(store, {
      post: http(200, { token: 'session-token' }),
      clearPending: mock(async () => {
        await oldCleanup.promise;
      }),
    });
    const actionsB = storeDeps(store, {
      savePending: mock(async () => {
        throw new Error('SecureStore write failed');
      }),
    });

    const verified = createSignupService(actionsA).verify({ code: '123456' });
    expect(await createSignupService(actionsB).register(REGISTER_INPUT)).toEqual({
      kind: 'pendingPersistenceFailed',
      pending: ACCEPTED_PENDING,
    });
    oldCleanup.resolve(undefined);
    expect(await verified).toEqual({ kind: 'verified' });

    expect(await createSignupService(storeDeps(store)).loadPending()).toEqual({
      kind: 'loaded',
      pending: ACCEPTED_PENDING,
    });
  });

  it('clears only the matching tombstone after successful cleanup', async () => {
    const store = { current: FAILED_PENDING as PendingSignup | null };
    const oldCleanup = deferred<void>();
    const actionsA = storeDeps(store, {
      clearPending: mock(async () => {
        await oldCleanup.promise;
        throw new Error('SecureStore delete failed');
      }),
    });

    const older = createSignupService(actionsA).clearPending();

    const actionsB = storeDeps(store, {
      clearPending: mock(async () => {
        store.current = null;
      }),
    });
    expect(await createSignupService(actionsB).clearPending()).toBe(true);

    oldCleanup.resolve(undefined);
    expect(await older).toBe(false);
    expect(await createSignupService(storeDeps(store)).loadPending()).toEqual({ kind: 'none' });
  });

  it('does not publish a result superseded before its HTTP response arrives', async () => {
    const store = { current: FAILED_PENDING as PendingSignup | null };
    const oldResponse = deferred<{ status: number; data: unknown }>();
    const actionsA = storeDeps(store, { post: mock(async () => oldResponse.promise) });
    const actionsB = storeDeps(store, {
      post: http(503, {
        error: 'Verification delivery is unavailable',
        continuationToken: 'new-token',
      }),
      savePending: mock(async () => {
        throw new Error('SecureStore write failed');
      }),
    });

    const older = createSignupService(actionsA).resend();
    await createSignupService(actionsB).resend();
    oldResponse.resolve({
      status: 503,
      data: {
        error: 'Verification delivery is unavailable',
        continuationToken: 'old-token',
      },
    });
    await older;

    expect(await createSignupService(storeDeps(store)).loadPending()).toEqual({
      kind: 'loaded',
      pending: deliveryPending('new-token'),
    });
  });
});

describe('signup service logging', () => {
  it('does not log credentials, codes, tokens, or OTPs', async () => {
    const loggers = [
      spyOn(console, 'log').mockImplementation(() => {}),
      spyOn(console, 'info').mockImplementation(() => {}),
      spyOn(console, 'warn').mockImplementation(() => {}),
      spyOn(console, 'error').mockImplementation(() => {}),
    ];

    try {
      const registering = deps({
        post: http(503, {
          error: 'Verification delivery is unavailable',
          continuationToken: 'secret-continuation-token',
        }),
      });
      const verifying = deps({
        loadPending: mock(async () => ACCEPTED_PENDING),
        post: http(200, { token: 'secret-session-token' }),
      });
      const resending = deps({
        loadPending: mock(async () => FAILED_PENDING),
        post: http(503, {
          error: 'Verification delivery is unavailable',
          continuationToken: 'secret-continuation-token',
        }),
        savePending: mock(async (_pending: PendingSignup) => {
          throw new Error('SecureStore write failed');
        }),
      });

      await createSignupService(registering).register(REGISTER_INPUT);
      await createSignupService(verifying).verify({ code: '654321' });
      await createSignupService(resending).resend();

      const logs = JSON.stringify(loggers.flatMap((logger) => logger.mock.calls));
      expect(logs).not.toContain(REGISTER_INPUT.password);
      expect(logs).not.toContain('654321');
      expect(logs).not.toContain('secret-continuation-token');
      expect(logs).not.toContain('secret-session-token');
    } finally {
      for (const logger of loggers) logger.mockRestore();
    }
  });
});
