/// <reference types="bun-types" />
import { beforeAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import type { AcceptedPendingSignup, DeliveryFailedPendingSignup } from './signup';

const NOW = 1_700_000_000_000;
const values = new Map<string, string>();
let readFails = false;
let writeFails = false;
let deleteFails = false;

async function getItem(key: string): Promise<string | null> {
  if (readFails) throw new Error('SecureStore read failed');
  return values.get(key) ?? null;
}

async function setItem(key: string, value: string): Promise<void> {
  if (writeFails) throw new Error('SecureStore write failed');
  values.set(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (deleteFails) throw new Error('SecureStore delete failed');
  values.delete(key);
}

const secureStore = {
  getItemAsync: mock(getItem),
  setItemAsync: mock(setItem),
  deleteItemAsync: mock(deleteItem),
};

type StorageModule = typeof import('./signup-storage');
let storageModule: StorageModule;

const ACCEPTED: AcceptedPendingSignup = {
  kind: 'accepted',
  userId: 'user-123',
  channel: 'email',
  createdAt: NOW,
  email: 'ada@example.com',
  phone: '+14155550123',
};

const DELIVERY_FAILED: DeliveryFailedPendingSignup = {
  kind: 'delivery-failed',
  continuationToken: 'first-continuation-token',
  createdAt: NOW,
  email: 'ada@example.com',
  phone: '+14155550123',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => { resolve = res; });
  return { promise, resolve };
}

function createStorage(now: number = NOW) {
  return storageModule.createSignupStorage({ secureStore, now: () => now });
}

beforeAll(async () => {
  storageModule = await import('./signup-storage');
});

beforeEach(() => {
  storageModule.resetSignupStorageForTests();
  values.clear();
  readFails = false;
  writeFails = false;
  deleteFails = false;
  secureStore.getItemAsync.mockImplementation(getItem);
  secureStore.setItemAsync.mockImplementation(setItem);
  secureStore.deleteItemAsync.mockImplementation(deleteItem);
  secureStore.getItemAsync.mockClear();
  secureStore.setItemAsync.mockClear();
  secureStore.deleteItemAsync.mockClear();
});

describe('createSignupStorage', () => {
  it('writes and reads a versioned pending signup', async () => {
    const storage = createStorage();
    await storage.savePending(ACCEPTED);

    expect(await storage.loadPending()).toEqual(ACCEPTED);
    const raw = values.get(storageModule.PENDING_SIGNUP_KEY);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string).version).toBe(storageModule.PENDING_SIGNUP_SCHEMA_VERSION);
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('auth_token');
  });

  it('updates state and rotates a continuation token', async () => {
    const storage = createStorage();
    await storage.savePending(DELIVERY_FAILED);
    const rotated: DeliveryFailedPendingSignup = {
      ...DELIVERY_FAILED,
      continuationToken: 'rotated-continuation-token',
    };
    await storage.savePending(rotated);

    expect(await storage.loadPending()).toEqual(rotated);
    expect(secureStore.setItemAsync).toHaveBeenCalledTimes(2);
  });

  it('deletes pending state during cleanup', async () => {
    const storage = createStorage();
    await storage.savePending(ACCEPTED);
    await storage.clearPending();

    expect(await storage.loadPending()).toBeNull();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(storageModule.PENDING_SIGNUP_KEY);
  });

  it('treats malformed JSON as no pending state and removes it', async () => {
    values.set(storageModule.PENDING_SIGNUP_KEY, '{not-json');
    const storage = createStorage();

    expect(await storage.loadPending()).toBeNull();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(storageModule.PENDING_SIGNUP_KEY);
  });

  it('treats an unsupported schema version as no pending state', async () => {
    values.set(storageModule.PENDING_SIGNUP_KEY, JSON.stringify({
      version: storageModule.PENDING_SIGNUP_SCHEMA_VERSION + 1,
      pending: ACCEPTED,
      createdAt: NOW,
      updatedAt: NOW,
      sequence: 1,
    }));
    const storage = createStorage();

    expect(await storage.loadPending()).toBeNull();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(storageModule.PENDING_SIGNUP_KEY);
  });

  it('surfaces SecureStore read failures', async () => {
    readFails = true;
    const storage = createStorage();

    await expect(storage.loadPending()).rejects.toThrow('SecureStore read failed');
  });

  it('surfaces SecureStore write failures', async () => {
    writeFails = true;
    const storage = createStorage();

    await expect(storage.savePending(ACCEPTED)).rejects.toThrow('SecureStore write failed');
  });

  it('surfaces SecureStore delete failures', async () => {
    const storage = createStorage();
    await storage.savePending(ACCEPTED);
    deleteFails = true;

    await expect(storage.clearPending()).rejects.toThrow('SecureStore delete failed');
    expect(values.has(storageModule.PENDING_SIGNUP_KEY)).toBe(true);
  });

  it('does not let a slower stale write overwrite newer state', async () => {
    const gate = deferred();
    let first = true;
    secureStore.setItemAsync.mockImplementation(async (key: string, value: string) => {
      if (first) {
        first = false;
        await gate.promise;
      }
      values.set(key, value);
    });
    const storage = createStorage();

    const older = storage.savePending(DELIVERY_FAILED);
    const newer = storage.savePending(ACCEPTED);
    gate.resolve();
    await Promise.all([older, newer]);

    expect(await storage.loadPending()).toEqual(ACCEPTED);
  });

  it('restores pending state after a simulated restart', async () => {
    const beforeRestart = createStorage();
    await beforeRestart.savePending(ACCEPTED);

    storageModule.resetSignupStorageForTests();
    const afterRestart = createStorage();

    expect(await afterRestart.loadPending()).toEqual(ACCEPTED);
    expect(await afterRestart.loadPendingRecord()).toEqual({
      pending: ACCEPTED,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('ignores expired pending state', async () => {
    const storage = createStorage();
    await storage.savePending(ACCEPTED);
    const expiredNow = NOW + storageModule.PENDING_SIGNUP_TTL_MS + 1;
    const restarted = createStorage(expiredNow);

    expect(await restarted.loadPending()).toBeNull();
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith(storageModule.PENDING_SIGNUP_KEY);
  });

  it('does not replace stored state when continuation-token persistence fails', async () => {
    const storage = createStorage();
    await storage.savePending(ACCEPTED);
    writeFails = true;

    await expect(storage.savePending(DELIVERY_FAILED)).rejects.toThrow('SecureStore write failed');
    writeFails = false;

    expect(await storage.loadPending()).toEqual(ACCEPTED);
  });

  it('keeps the auth token under its existing separate key', async () => {
    const storage = createStorage();
    await storage.saveSessionToken('session-token');

    expect(values.get(storageModule.AUTH_TOKEN_KEY)).toBe('session-token');
    expect(values.get(storageModule.PENDING_SIGNUP_KEY)).toBeUndefined();
    expect(await storage.loadSessionToken()).toBe('session-token');
  });

  it('surfaces auth-token write failures', async () => {
    writeFails = true;
    const storage = createStorage();

    await expect(storage.saveSessionToken('session-token')).rejects.toThrow('SecureStore write failed');
  });
});

describe('resend cooldown helpers', () => {
  it('starts at 60 seconds and derives from timestamps', () => {
    expect(storageModule.resendCooldownRemaining(NOW, NOW)).toBe(60);
    expect(storageModule.resendCooldownRemaining(NOW, NOW + 30_000)).toBe(30);
    expect(storageModule.resendCooldownRemaining(NOW, NOW + 60_000)).toBe(0);
    expect(storageModule.resendCooldownRemaining(NOW, NOW - 1_000)).toBe(60);
  });
});
