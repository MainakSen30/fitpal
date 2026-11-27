/// <reference types="bun-types" />
import { beforeEach, describe, expect, it, mock } from 'bun:test';
import {
  createSignupService,
  mapSignupResult,
  resetSignupCoordinatorForTests,
  signupSchema,
  toRegisterInput,
  type SignupActions,
} from '../../src/lib/signup';

const post = mock<SignupActions['post']>(async () => ({ status: 202, data: { verificationRequired: true } }));
const storage = {
  loadPending: mock(async () => null),
  savePending: mock(async () => {}),
  clearPending: mock(async () => {}),
  saveSessionToken: mock(async (_token: string) => {}),
};

const VALID_VALUES = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+14155550123',
  password: 'super-secret-password',
  verificationChannel: 'email' as const,
};

beforeEach(() => {
  resetSignupCoordinatorForTests();
  post.mockClear();
  storage.loadPending.mockClear();
  storage.savePending.mockClear();
  storage.clearPending.mockClear();
  storage.saveSessionToken.mockClear();
});

describe('signup screen form contract', () => {
  it('builds the exact five-field registration request', () => {
    const parsed = signupSchema.parse(VALID_VALUES);
    expect(toRegisterInput(parsed)).toEqual({
      name: VALID_VALUES.name,
      email: VALID_VALUES.email,
      phone: VALID_VALUES.phone,
      password: VALID_VALUES.password,
      verificationChannel: VALID_VALUES.verificationChannel,
    });
  });

  it('rejects form input missing phone or verification channel', () => {
    const { phone: _phone, verificationChannel: _channel, ...missing } = VALID_VALUES;
    expect(signupSchema.safeParse(missing).success).toBe(false);
  });

  it('rejects a phone number without a country code', () => {
    expect(signupSchema.safeParse({ ...VALID_VALUES, phone: '4155550123' }).success).toBe(false);
  });
});

describe('signup screen service integration', () => {
  it('sends the five-field payload and never saves a session token on 202', async () => {
    post.mockImplementation(async () => ({ status: 202, data: { verificationRequired: true, channel: 'email', userId: 'user-123' } }));
    const service = createSignupService({ post, ...storage });

    const result = await service.register(toRegisterInput(signupSchema.parse(VALID_VALUES)));

    expect(post).toHaveBeenCalledWith({
      url: '/auth/register',
      body: {
        name: VALID_VALUES.name,
        email: VALID_VALUES.email,
        phone: VALID_VALUES.phone,
        password: VALID_VALUES.password,
        verificationChannel: VALID_VALUES.verificationChannel,
      },
    });
    expect(result.kind).toBe('pending');
    expect(storage.saveSessionToken).not.toHaveBeenCalled();
  });

  it('persists delivery-failed continuation state on 503 without a session token', async () => {
    post.mockImplementation(async () => ({ status: 503, data: { error: 'Verification delivery is unavailable', continuationToken: 'continuation-token' } }));
    const service = createSignupService({ post, ...storage });

    const result = await service.register(toRegisterInput(signupSchema.parse(VALID_VALUES)));

    expect(result.kind).toBe('deliveryUnavailable');
    expect(storage.savePending).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'delivery-failed',
      continuationToken: 'continuation-token',
    }));
    expect(storage.saveSessionToken).not.toHaveBeenCalled();
  });
});

describe('signup screen result handling', () => {
  it('navigates to verification for 202 and 503 after persistence succeeds', () => {
    expect(mapSignupResult({ kind: 'pending', source: 'register', pending: {} as never })).toEqual({ kind: 'verify' });
    expect(mapSignupResult({
      kind: 'deliveryUnavailable',
      pending: {} as never,
      continuationToken: 'continuation-token',
    })).toEqual({ kind: 'verify', deliveryUnavailable: true });
  });

  it('keeps a persistence failure recoverable and never claims completion', () => {
    const pending = {} as never;
    const outcome = mapSignupResult({ kind: 'pendingPersistenceFailed', pending });

    expect(outcome.kind).toBe('recover');
    if (outcome.kind === 'recover') {
      expect(outcome.pending).toBe(pending);
      expect(outcome.message).toContain('could not save');
    }
  });

  it('uses safe messages for duplicate, rate-limit, network, and validation results', () => {
    const messages = [
      mapSignupResult({ kind: 'duplicateRegistration' }),
      mapSignupResult({ kind: 'rateLimit' }),
      mapSignupResult({ kind: 'networkFailure' }),
      mapSignupResult({ kind: 'validationError' }),
    ].map((outcome) => outcome.kind === 'notice' ? outcome.message : '');

    expect(messages.every((message) => message.length > 0)).toBe(true);
    expect(messages.join(' ')).not.toContain('issues');
    expect(messages.join(' ')).not.toContain('continuation-token');
  });
});
