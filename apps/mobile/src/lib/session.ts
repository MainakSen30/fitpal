import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { API_URL } from './api-url';
import { AUTH_TOKEN_KEY } from './signup-storage';

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
};

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
export type SessionErrorReason = 'network' | 'server' | 'storage-read' | 'cleanup';

export type SessionSnapshot = {
  status: SessionStatus;
  user: SessionUser | null;
  errorReason?: SessionErrorReason;
};

export type SessionStorage = {
  readToken: () => Promise<string | null>;
  saveToken: (token: string) => Promise<void>;
  deleteToken: () => Promise<void>;
};

export type SessionValidation =
  | { kind: 'authenticated'; user: SessionUser }
  | { kind: 'no-session' }
  | { kind: 'unauthorized' }
  | { kind: 'network' }
  | { kind: 'server' };

export function isSessionUser(value: unknown): value is SessionUser {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const user = value as { id?: unknown };
  return typeof user.id === 'string' && user.id.length > 0;
}

export const secureSessionStorage: SessionStorage = {
  readToken: () => SecureStore.getItemAsync(AUTH_TOKEN_KEY),
  saveToken: (token) => SecureStore.setItemAsync(AUTH_TOKEN_KEY, token),
  deleteToken: () => SecureStore.deleteItemAsync(AUTH_TOKEN_KEY),
};

const meClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

/** `/auth/me` returns 200 with `{ user: null }` for missing or revoked sessions. */
export function classifyMeResponse(data: unknown): SessionValidation {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { kind: 'server' };
  }
  const user = (data as { user?: unknown }).user;
  if (user === null) return { kind: 'no-session' };
  if (isSessionUser(user)) return { kind: 'authenticated', user };
  return { kind: 'server' };
}

export async function validateSessionToken(token: string): Promise<SessionValidation> {
  try {
    const response = await meClient.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return classifyMeResponse(response.data);
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 401) return { kind: 'unauthorized' };
    if (status === undefined) return { kind: 'network' };
    return { kind: 'server' };
  }
}

const LOADING: SessionSnapshot = { status: 'loading', user: null };
const UNAUTHENTICATED: SessionSnapshot = { status: 'unauthenticated', user: null };

function authenticated(user: SessionUser | null): SessionSnapshot {
  return { status: 'authenticated', user };
}

function failed(reason: SessionErrorReason): SessionSnapshot {
  return { status: 'error', user: null, errorReason: reason };
}

export type SessionController = ReturnType<typeof createSessionController>;

export function createSessionController(options: {
  storage: SessionStorage;
  validate: (token: string) => Promise<SessionValidation>;
}) {
  let snapshot: SessionSnapshot = LOADING;
  let token: string | null = null;
  let revision = 0;
  let pendingRestore: Promise<void> | null = null;
  let pendingInvalidation: Promise<boolean> | null = null;
  const listeners = new Set<() => void>();

  function publish(next: SessionSnapshot): void {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  function getSnapshot(): SessionSnapshot {
    return snapshot;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function currentToken(): string | null {
    return token;
  }

  function establish(nextToken: string, user: SessionUser | null = null): boolean {
    if (typeof nextToken !== 'string' || nextToken.length === 0) return false;
    revision += 1;
    token = nextToken;
    publish(authenticated(user));
    return true;
  }

  /** Logout already revoked and deleted the token; only the in-memory state changes. */
  function logoutCompleted(): void {
    revision += 1;
    token = null;
    publish(UNAUTHENTICATED);
  }

  function invalidate(expectedToken?: string): Promise<boolean> {
    if (pendingInvalidation) return pendingInvalidation;
    if (expectedToken !== undefined && (!token || expectedToken !== token)) {
      return Promise.resolve(false);
    }

    const expectedRevision = ++revision;
    token = null;

    const task = (async () => {
      let deleted = false;
      try {
        await options.storage.deleteToken();
        deleted = true;
      } catch {
        // Never claim a full cleanup when SecureStore deletion failed.
      }

      if (expectedRevision === revision) {
        publish(deleted ? UNAUTHENTICATED : failed('cleanup'));
        return deleted;
      }

      // A newer login may have written its token while this delete was in
      // flight; put it back so an old 401 cannot erase the new session.
      if (token) void options.storage.saveToken(token).catch(() => {});
      return false;
    })();

    pendingInvalidation = task;
    void task.then(() => {
      if (pendingInvalidation === task) pendingInvalidation = null;
    });
    return task;
  }

  function invalidateToken(rejectedToken: string): Promise<boolean> {
    return invalidate(rejectedToken);
  }

  function restore(): Promise<void> {
    if (pendingRestore) return pendingRestore;

    const expectedRevision = ++revision;
    publish(LOADING);

    const task = (async () => {
      let stored: string | null;
      try {
        stored = await options.storage.readToken();
      } catch {
        // A failed read is not evidence that the user has no session.
        if (expectedRevision === revision) publish(failed('storage-read'));
        return;
      }

      if (expectedRevision !== revision) return;
      if (!stored) {
        token = null;
        publish(UNAUTHENTICATED);
        return;
      }

      token = stored;
      let result: SessionValidation;
      try {
        result = await options.validate(stored);
      } catch {
        result = { kind: 'server' };
      }

      if (expectedRevision !== revision) return;
      if (result.kind === 'authenticated') {
        publish(authenticated(result.user));
        return;
      }
      if (result.kind === 'network') {
        publish(failed('network'));
        return;
      }
      if (result.kind === 'server') {
        publish(failed('server'));
        return;
      }

      // `{ user: null }` and 401 both mean the stored session is no longer valid.
      await invalidate(stored);
    })();

    pendingRestore = task;
    void task.then(() => {
      if (pendingRestore === task) pendingRestore = null;
    });
    return task;
  }

  async function retry(): Promise<boolean> {
    if (snapshot.status === 'error' && snapshot.errorReason === 'cleanup') {
      return invalidate();
    }
    await restore();
    return true;
  }

  return {
    subscribe,
    getSnapshot,
    currentToken,
    establish,
    logoutCompleted,
    invalidate,
    invalidateToken,
    restore,
    retry,
  };
}

export const session = createSessionController({
  storage: secureSessionStorage,
  validate: validateSessionToken,
});

/** Persist first so a shared-state update never advertises an unsaved token. */
export async function establishPersistedSession(token: string, user?: SessionUser): Promise<void> {
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  session.establish(token, user);
}

export function useSessionSnapshot(): SessionSnapshot {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}
