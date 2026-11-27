/// <reference types="bun-types" />
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { SessionStorage, SessionUser, SessionValidation } from './session';

const secureStore = {
  getItemAsync: mock(async (_key: string) => null as string | null),
  setItemAsync: mock(async (_key: string, _value: string) => {}),
  deleteItemAsync: mock(async (_key: string) => {}),
};

mock.module('expo-constants', () => ({ default: { expoConfig: {} } }));
mock.module('expo-secure-store', () => ({ default: secureStore, ...secureStore }));
Object.assign(globalThis, { __DEV__: false });

const USER: SessionUser = { id: 'user-1', email: 'ada@example.com', name: 'Ada' };

type SessionModule = typeof import('./session');
let sessionModule!: SessionModule;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeDeps(
  overrides: Partial<SessionStorage> = {},
  validation: SessionValidation = { kind: 'authenticated', user: USER },
) {
  const storage: SessionStorage = {
    readToken: mock(async () => 'stored-token'),
    saveToken: mock(async (_token: string) => {}),
    deleteToken: mock(async () => {}),
    ...overrides,
  };
  const validate = mock(async (_token: string): Promise<SessionValidation> => validation);
  return { storage, validate };
}

beforeAll(async () => {
  sessionModule = await import('./session');
});

beforeEach(() => {
  sessionModule.session.logoutCompleted();
  secureStore.getItemAsync.mockClear();
  secureStore.setItemAsync.mockClear();
  secureStore.deleteItemAsync.mockClear();
});

describe('/auth/me response classification', () => {
  it('accepts a valid user, treats user null as no session, and rejects malformed data', () => {
    expect(sessionModule.classifyMeResponse({ user: USER })).toEqual({
      kind: 'authenticated',
      user: USER,
    });
    expect(sessionModule.classifyMeResponse({ user: null })).toEqual({ kind: 'no-session' });
    expect(sessionModule.classifyMeResponse({ user: { id: '' } })).toEqual({ kind: 'server' });
    expect(sessionModule.classifyMeResponse(null)).toEqual({ kind: 'server' });
  });
});

describe('login session establishment', () => {
  it('persists the login token before publishing it to the shared controller', async () => {
    await sessionModule.establishPersistedSession('login-token', USER);

    expect(secureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'login-token');
    expect(sessionModule.session.currentToken()).toBe('login-token');
    expect(sessionModule.session.getSnapshot()).toEqual({ status: 'authenticated', user: USER });
  });
});

describe('startup session restoration', () => {
  it('goes straight to unauthenticated when no token is stored', async () => {
    const deps = makeDeps({ readToken: mock(async () => null) });
    const controller = sessionModule.createSessionController(deps);

    await controller.restore();

    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated', user: null });
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.storage.deleteToken).not.toHaveBeenCalled();
  });

  it('validates a stored token and establishes the returned user', async () => {
    const deps = makeDeps();
    const controller = sessionModule.createSessionController(deps);

    await controller.restore();

    expect(deps.validate).toHaveBeenCalledWith('stored-token');
    expect(controller.getSnapshot()).toEqual({ status: 'authenticated', user: USER });
    expect(controller.currentToken()).toBe('stored-token');
    expect(deps.storage.deleteToken).not.toHaveBeenCalled();
  });

  it('clears the stored session when /auth/me returns 200 with user null', async () => {
    const deps = makeDeps({}, { kind: 'no-session' });
    const controller = sessionModule.createSessionController(deps);

    await controller.restore();

    expect(deps.storage.deleteToken).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated', user: null });
    expect(controller.currentToken()).toBeNull();
  });

  it('clears the stored session when /auth/me returns 401', async () => {
    const deps = makeDeps({}, { kind: 'unauthorized' });
    const controller = sessionModule.createSessionController(deps);

    await controller.restore();

    expect(deps.storage.deleteToken).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated', user: null });
  });

  it('keeps the token on a network failure and exposes a recoverable state', async () => {
    const deps = makeDeps({}, { kind: 'network' });
    const controller = sessionModule.createSessionController(deps);

    await controller.restore();

    expect(controller.getSnapshot()).toEqual({
      status: 'error',
      user: null,
      errorReason: 'network',
    });
    expect(deps.storage.deleteToken).not.toHaveBeenCalled();
    expect(controller.currentToken()).toBe('stored-token');
  });

  it('keeps the token on a 5xx failure', async () => {
    const deps = makeDeps({}, { kind: 'server' });
    const controller = sessionModule.createSessionController(deps);

    await controller.restore();

    expect(controller.getSnapshot()).toEqual({
      status: 'error',
      user: null,
      errorReason: 'server',
    });
    expect(deps.storage.deleteToken).not.toHaveBeenCalled();
  });

  it('treats a malformed /auth/me body as a recoverable server failure', async () => {
    const deps = makeDeps();
    deps.validate.mockImplementation(async () => ({ kind: 'server' }));
    const controller = sessionModule.createSessionController(deps);

    await controller.restore();

    expect(controller.getSnapshot().status).toBe('error');
    expect(controller.getSnapshot().errorReason).toBe('server');
    expect(deps.storage.deleteToken).not.toHaveBeenCalled();
  });

  it('does not infer no token when SecureStore read fails', async () => {
    const deps = makeDeps({
      readToken: mock(async () => {
        throw new Error('SecureStore read failed');
      }),
    });
    const controller = sessionModule.createSessionController(deps);

    await controller.restore();

    expect(controller.getSnapshot()).toEqual({
      status: 'error',
      user: null,
      errorReason: 'storage-read',
    });
    expect(deps.validate).not.toHaveBeenCalled();
    expect(deps.storage.deleteToken).not.toHaveBeenCalled();
  });

  it('retries restoration after a transient network failure', async () => {
    const deps = makeDeps({}, { kind: 'network' });
    const controller = sessionModule.createSessionController(deps);

    await controller.restore();
    expect(controller.getSnapshot().errorReason).toBe('network');

    deps.validate.mockImplementation(async () => ({ kind: 'authenticated', user: USER }));
    await controller.retry();

    expect(deps.validate).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toEqual({ status: 'authenticated', user: USER });
  });
});

describe('401 and invalidation behavior', () => {
  it('invalidates only the currently active token', async () => {
    const deps = makeDeps();
    const controller = sessionModule.createSessionController(deps);
    controller.establish('active-token', USER);

    expect(await controller.invalidateToken('active-token')).toBe(true);
    expect(deps.storage.deleteToken).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated', user: null });
  });

  it('shares one invalidation across simultaneous 401 responses', async () => {
    const gate = deferred<void>();
    const deleteToken = mock(async () => {
      await gate.promise;
    });
    const deps = makeDeps({ deleteToken });
    const controller = sessionModule.createSessionController(deps);
    controller.establish('active-token', USER);

    const first = controller.invalidateToken('active-token');
    const second = controller.invalidateToken('active-token');
    await Promise.resolve();

    expect(deleteToken).toHaveBeenCalledTimes(1);

    gate.resolve();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
  });

  it('does not let a stale 401 invalidate a replaced token', async () => {
    const deps = makeDeps();
    const controller = sessionModule.createSessionController(deps);
    controller.establish('old-token', USER);
    controller.establish('new-token', USER);

    expect(await controller.invalidateToken('old-token')).toBe(false);
    expect(deps.storage.deleteToken).not.toHaveBeenCalled();
    expect(controller.currentToken()).toBe('new-token');
    expect(controller.getSnapshot()).toEqual({ status: 'authenticated', user: USER });
  });

  it('restores a newer token if an older invalidation finishes after replacement', async () => {
    const gate = deferred<void>();
    const saveToken = mock(async (_token: string) => {});
    const deleteToken = mock(async () => {
      await gate.promise;
    });
    const deps = makeDeps({ deleteToken, saveToken });
    const controller = sessionModule.createSessionController(deps);
    controller.establish('old-token', USER);

    const invalidation = controller.invalidateToken('old-token');
    controller.establish('new-token', USER);
    gate.resolve();

    expect(await invalidation).toBe(false);
    expect(saveToken).toHaveBeenCalledWith('new-token');
    expect(controller.currentToken()).toBe('new-token');
    expect(controller.getSnapshot()).toEqual({ status: 'authenticated', user: USER });
  });

  it('does not invalidate on deletion failures and allows a later retry', async () => {
    let deleteFails = true;
    const deleteToken = mock(async () => {
      if (deleteFails) throw new Error('SecureStore delete failed');
    });
    const deps = makeDeps({ deleteToken });
    const controller = sessionModule.createSessionController(deps);
    controller.establish('active-token', USER);

    expect(await controller.invalidateToken('active-token')).toBe(false);
    expect(controller.getSnapshot()).toEqual({
      status: 'error',
      user: null,
      errorReason: 'cleanup',
    });

    deleteFails = false;
    expect(await controller.retry()).toBe(true);
    expect(deleteToken).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated', user: null });
  });
});

describe('concurrent session transitions', () => {
  it('does not let a stale restoration overwrite a newer login', async () => {
    const gate = deferred<SessionValidation>();
    const deps = makeDeps();
    deps.validate.mockImplementation(async () => gate.promise);
    const controller = sessionModule.createSessionController(deps);

    const restoration = controller.restore();
    await Promise.resolve();
    controller.establish('login-token', USER);

    gate.resolve({ kind: 'authenticated', user: { id: 'stale-user' } });
    await restoration;

    expect(controller.currentToken()).toBe('login-token');
    expect(controller.getSnapshot()).toEqual({ status: 'authenticated', user: USER });
  });

  it('does not let a stale restoration overwrite a logout', async () => {
    const gate = deferred<SessionValidation>();
    const deps = makeDeps();
    deps.validate.mockImplementation(async () => gate.promise);
    const controller = sessionModule.createSessionController(deps);

    const restoration = controller.restore();
    await Promise.resolve();
    controller.logoutCompleted();

    gate.resolve({ kind: 'authenticated', user: USER });
    await restoration;

    expect(controller.getSnapshot()).toEqual({ status: 'unauthenticated', user: null });
    expect(controller.currentToken()).toBeNull();
    expect(deps.storage.deleteToken).not.toHaveBeenCalled();
  });
});
