import * as SecureStore from 'expo-secure-store';
import { isPendingSignup, type PendingLoadResult, type PendingSignup } from './signup';

export const AUTH_TOKEN_KEY = 'auth_token';
export const PENDING_SIGNUP_KEY = 'fitpal.pendingSignup.v1';
export const PENDING_SIGNUP_SCHEMA_VERSION = 1;
// Bound client-side recovery so stale pending state cannot be resumed forever.
export const PENDING_SIGNUP_TTL_MS = 24 * 60 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;

export type PendingSignupRecord = {
  pending: PendingSignup;
  createdAt: number;
  updatedAt: number;
};

type StoredPendingSignup = PendingSignupRecord & {
  version: number;
  sequence: number;
};

type SecureStoreLike = Pick<
  typeof SecureStore,
  'getItemAsync' | 'setItemAsync' | 'deleteItemAsync'
>;

export type SignupStorageOptions = {
  secureStore?: SecureStoreLike;
  now?: () => number;
};

export type SignupStorage = {
  loadPending: () => Promise<PendingSignup | null>;
  loadPendingRecord: () => Promise<PendingSignupRecord | null>;
  savePending: (pending: PendingSignup) => Promise<void>;
  clearPending: () => Promise<void>;
  loadSessionToken: () => Promise<string | null>;
  saveSessionToken: (token: string) => Promise<void>;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseStored(raw: string | null): StoredPendingSignup | null {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== PENDING_SIGNUP_SCHEMA_VERSION) return null;
  if (!isPendingSignup(record.pending)) return null;
  if (!isFiniteNumber(record.createdAt) || !isFiniteNumber(record.updatedAt)) return null;
  if (!isFiniteNumber(record.sequence) || record.sequence < 0) return null;
  if (record.createdAt !== record.pending.createdAt) return null;
  if (record.updatedAt < record.createdAt) return null;

  return {
    version: PENDING_SIGNUP_SCHEMA_VERSION,
    pending: record.pending,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    sequence: record.sequence,
  };
}

export function isPendingSignupExpired(record: PendingSignupRecord, now: number): boolean {
  return now - record.updatedAt > PENDING_SIGNUP_TTL_MS;
}

export function resendCooldownRemaining(updatedAt: number, now: number): number {
  if (!isFiniteNumber(updatedAt) || !isFiniteNumber(now)) return 60;
  const elapsed = now - updatedAt;
  if (elapsed < 0) return 60;
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000));
}

const OTP_PATTERN = /^\d{6}$/;

export function normalizeOtpCode(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function isValidOtpCode(value: string): boolean {
  return OTP_PATTERN.test(value);
}

export type VerifyContextResult =
  | { kind: 'ready'; record: PendingSignupRecord }
  | { kind: 'authenticated' }
  | { kind: 'none' }
  | { kind: 'failed' };

export type VerifyContextDeps = {
  service: { loadPending: () => Promise<PendingLoadResult> };
  storage: Pick<SignupStorage, 'loadSessionToken' | 'loadPendingRecord'>;
  now?: () => number;
};

export async function loadVerifyContext(deps: VerifyContextDeps): Promise<VerifyContextResult> {
  try {
    if (await deps.storage.loadSessionToken()) return { kind: 'authenticated' };

    const pending = await deps.service.loadPending();
    if (pending.kind === 'failed') return { kind: 'failed' };
    if (pending.kind === 'none') return { kind: 'none' };

    const record = await deps.storage.loadPendingRecord();
    if (!record) return { kind: 'none' };
    if (isPendingSignupExpired(record, deps.now ? deps.now() : Date.now())) return { kind: 'none' };

    return { kind: 'ready', record };
  } catch {
    return { kind: 'failed' };
  }
}

// Serialize storage operations so a slow write cannot be overtaken by a newer
// write that reads the same sequence from SecureStore.
let operationQueue: Promise<void> = Promise.resolve();
let sequence = 0;

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

/** Test-only reset. Does not touch SecureStore, so restart simulation remains possible. */
export function resetSignupStorageForTests(): void {
  operationQueue = Promise.resolve();
  sequence = 0;
}

export function createSignupStorage(options: SignupStorageOptions = {}): SignupStorage {
  const store = options.secureStore ?? SecureStore;
  const now = options.now ?? Date.now;

  async function readRecord(): Promise<StoredPendingSignup | null> {
    return parseStored(await store.getItemAsync(PENDING_SIGNUP_KEY));
  }

  async function loadRecord(): Promise<PendingSignupRecord | null> {
    return enqueue(async () => {
      const raw = await store.getItemAsync(PENDING_SIGNUP_KEY);
      if (raw === null) return null;
      const record = parseStored(raw);
      if (!record) {
        try {
          await store.deleteItemAsync(PENDING_SIGNUP_KEY);
        } catch {
          // A new signup overwrites this key by name, so cleanup is best effort.
        }
        return null;
      }
      if (isPendingSignupExpired(record, now())) {
        // Expired data is not valid pending state. A failed cleanup here is
        // harmless because the next save overwrites the record by key.
        try {
          await store.deleteItemAsync(PENDING_SIGNUP_KEY);
        } catch {
          // The recoverable path is to start a new signup, which overwrites it.
        }
        return null;
      }
      return {
        pending: record.pending,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    });
  }

  return {
    loadPending: async () => (await loadRecord())?.pending ?? null,

    loadPendingRecord: loadRecord,

    savePending: (pending) => enqueue(async () => {
      const current = await readRecord();
      const nextSequence = Math.max(sequence, current?.sequence ?? 0) + 1;
      const updatedAt = Math.max(now(), pending.createdAt);
      await store.setItemAsync(PENDING_SIGNUP_KEY, JSON.stringify({
        version: PENDING_SIGNUP_SCHEMA_VERSION,
        pending,
        createdAt: pending.createdAt,
        updatedAt,
        sequence: nextSequence,
      }));
      sequence = nextSequence;
    }),

    clearPending: () => enqueue(() => store.deleteItemAsync(PENDING_SIGNUP_KEY)),

    loadSessionToken: () => enqueue(() => store.getItemAsync(AUTH_TOKEN_KEY)),

    saveSessionToken: (token) => enqueue(() => store.setItemAsync(AUTH_TOKEN_KEY, token)),
  };
}
