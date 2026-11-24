export type SignupChannel = 'email' | 'sms';

type PendingMetadata = {
  createdAt: number;
  email?: string;
  phone?: string;
};

export type AcceptedPendingSignup = PendingMetadata & {
  kind: 'accepted';
  userId: string;
  channel: SignupChannel;
  continuationToken?: undefined;
};

export type DeliveryFailedPendingSignup = PendingMetadata & {
  kind: 'delivery-failed';
  continuationToken: string;
  userId?: undefined;
  channel?: undefined;
};

export type PendingSignup = AcceptedPendingSignup | DeliveryFailedPendingSignup;

export type RegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  verificationChannel: SignupChannel;
};

export type VerifyInput = {
  code: string;
};

type RegisterRequest = { url: '/auth/register'; body: RegisterInput };
type VerifyRequestBody = { userId: string; channel: SignupChannel; code: string };
type VerifyRequest = { url: '/auth/signup/verify'; body: VerifyRequestBody };
type ResendRequestBody = { userId: string } | { continuationToken: string };
type ResendRequest = { url: '/auth/signup/resend'; body: ResendRequestBody };

export type SignupRequest = RegisterRequest | VerifyRequest | ResendRequest;
export type SignupHttpResponse = { status: number; data: unknown };

export type PendingLoadResult =
  | { kind: 'none' }
  | { kind: 'loaded'; pending: PendingSignup }
  | { kind: 'failed' };

export type SignupActions = {
  post: (request: SignupRequest) => Promise<SignupHttpResponse>;
  loadPending: () => Promise<PendingSignup | null>;
  savePending: (pending: PendingSignup) => Promise<void>;
  clearPending: () => Promise<void>;
  saveSessionToken: (token: string) => Promise<void>;
  now?: () => number;
};

export type SignupResult =
  | { kind: 'pending'; source: 'register' | 'resend'; pending: PendingSignup }
  | { kind: 'pendingPersistenceFailed'; pending: PendingSignup }
  | { kind: 'deliveryUnavailable'; pending: DeliveryFailedPendingSignup; continuationToken: string }
  | { kind: 'verified'; pendingCleanupFailed?: boolean }
  | { kind: 'validationError' }
  | { kind: 'unrecognizedBadRequest' }
  | { kind: 'duplicateRegistration' }
  | { kind: 'rateLimit' }
  | { kind: 'invalidOrExpiredCode' }
  | { kind: 'codeLockout' }
  | { kind: 'invalidPendingSignup'; cleanupFailed?: boolean }
  | { kind: 'pendingReadFailed' }
  | { kind: 'networkFailure' }
  | { kind: 'unexpectedServerError' };

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;
}

function stringField(record: Record<string, unknown> | null, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function channelOf(value: unknown): SignupChannel | undefined {
  return value === 'email' || value === 'sms' ? value : undefined;
}

function errorMessage(data: unknown): string | undefined {
  return stringField(recordOf(data), 'error');
}

function isValidationError(data: unknown): boolean {
  const record = recordOf(data);
  const error = recordOf(record?.error);
  return record?.success === false && error !== null && Array.isArray(error.issues);
}

function isPendingSignup(value: unknown): value is PendingSignup {
  const record = recordOf(value);
  if (!record || !Number.isFinite(record.createdAt as number)) return false;
  if (record.email !== undefined && typeof record.email !== 'string') return false;
  if (record.phone !== undefined && typeof record.phone !== 'string') return false;

  if (record.kind === 'accepted') {
    return typeof record.userId === 'string'
      && record.userId.length > 0
      && channelOf(record.channel) !== undefined
      && record.continuationToken === undefined;
  }

  if (record.kind === 'delivery-failed') {
    return typeof record.continuationToken === 'string'
      && record.continuationToken.length > 0
      && record.userId === undefined
      && record.channel === undefined;
  }

  return false;
}

function samePending(a: PendingSignup, b: PendingSignup): boolean {
  if (
    a.kind !== b.kind
    || a.createdAt !== b.createdAt
    || a.email !== b.email
    || a.phone !== b.phone
  ) return false;

  if (a.kind === 'accepted') {
    return b.kind === 'accepted' && a.userId === b.userId && a.channel === b.channel;
  }
  return b.kind === 'delivery-failed' && a.continuationToken === b.continuationToken;
}

type BadRequestResult =
  | { kind: 'validationError' }
  | { kind: 'unrecognizedBadRequest' }
  | { kind: 'rateLimit' }
  | { kind: 'codeLockout' };

// Temporary until the API exposes stable error codes. Only the current exact
// backend messages are classified; unknown 400s are never confirmed lockouts.
const LOCKOUT_MESSAGE = 'Too many incorrect attempts. Request a new code after the lock expires.';
const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later.';
const DELIVERY_UNAVAILABLE_MESSAGE = 'Verification request could not be completed';

function mapBadRequest(data: unknown): BadRequestResult {
  const message = errorMessage(data);
  if (message === LOCKOUT_MESSAGE) return { kind: 'codeLockout' };
  if (message === RATE_LIMIT_MESSAGE || message === DELIVERY_UNAVAILABLE_MESSAGE) {
    return { kind: 'rateLimit' };
  }
  if (isValidationError(data)) return { kind: 'validationError' };
  return { kind: 'unrecognizedBadRequest' };
}

type SignupOperation = 'register' | 'verify' | 'resend';

function mapFailure(operation: SignupOperation, status: number, data: unknown): SignupResult {
  switch (status) {
    case 400:
      return mapBadRequest(data);
    case 401:
      if (operation === 'verify') return { kind: 'invalidOrExpiredCode' };
      if (operation === 'resend') return { kind: 'invalidPendingSignup' };
      return { kind: 'unexpectedServerError' };
    case 409:
      return operation === 'register'
        ? { kind: 'duplicateRegistration' }
        : { kind: 'unexpectedServerError' };
    case 429:
      return { kind: 'rateLimit' };
    default:
      return { kind: 'unexpectedServerError' };
  }
}

async function post(
  actions: SignupActions,
  request: SignupRequest,
): Promise<SignupHttpResponse | null> {
  try {
    return await actions.post(request);
  } catch {
    return null;
  }
}

async function persist(action: () => Promise<void>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch {
    return false;
  }
}

async function readPending(actions: SignupActions): Promise<PendingLoadResult> {
  try {
    const pending = await actions.loadPending();
    if (pending === null) return { kind: 'none' };
    return isPendingSignup(pending) ? { kind: 'loaded', pending } : { kind: 'failed' };
  } catch {
    return { kind: 'failed' };
  }
}

function timestamp(actions: SignupActions): number {
  return actions.now ? actions.now() : Date.now();
}

function metadataFromInput(input: RegisterInput, createdAt: number): PendingMetadata {
  return { createdAt, email: input.email, phone: input.phone };
}

function metadataFromPending(pending: PendingSignup): PendingMetadata {
  return { createdAt: pending.createdAt, email: pending.email, phone: pending.phone };
}

function acceptedPending(
  data: unknown,
  metadata: PendingMetadata,
): AcceptedPendingSignup | undefined {
  const record = recordOf(data);
  const userId = stringField(record, 'userId');
  const channel = channelOf(record?.channel);
  if (!userId || !channel) return undefined;
  return { kind: 'accepted', userId, channel, ...metadata };
}

function deliveryFailedPending(
  token: string,
  metadata: PendingMetadata,
): DeliveryFailedPendingSignup {
  return { kind: 'delivery-failed', continuationToken: token, ...metadata };
}

function continuationTokenOf(data: unknown): string | undefined {
  return stringField(recordOf(data), 'continuationToken');
}

type SharedSignupState =
  | { kind: 'pending'; pending: PendingSignup; revision: number }
  | { kind: 'tombstone'; revision: number };

// One app-wide namespace: there is only one active pending signup.
let sharedSignupState: SharedSignupState | null = null;
let sharedRevisionCounter = 0;
let appliedRevision = 0;

function nextSharedRevision(): number {
  sharedRevisionCounter += 1;
  return sharedRevisionCounter;
}

function claimRevision(revision: number): boolean {
  if (revision < appliedRevision) return false;
  appliedRevision = revision;
  return true;
}

function publishSharedPending(pending: PendingSignup, revision: number): void {
  if (!claimRevision(revision)) return;
  if (sharedSignupState === null || sharedSignupState.revision < revision) {
    sharedSignupState = { kind: 'pending', pending, revision };
  }
}

function publishSharedTombstone(revision: number): void {
  if (!claimRevision(revision)) return;
  if (sharedSignupState === null || sharedSignupState.revision < revision) {
    sharedSignupState = { kind: 'tombstone', revision };
  }
}

function clearSharedStateAfterWrite(revision: number): void {
  if (!claimRevision(revision)) return;
  if (sharedSignupState !== null && sharedSignupState.revision <= revision) {
    sharedSignupState = null;
  }
}

function clearSharedTombstoneAfterCleanup(revision: number): void {
  if (!claimRevision(revision)) return;
  if (
    sharedSignupState !== null
    && sharedSignupState.kind === 'tombstone'
    && sharedSignupState.revision <= revision
  ) {
    sharedSignupState = null;
  }
}

function clearSharedStateIfSame(expected: SharedSignupState): void {
  if (sharedSignupState === expected) sharedSignupState = null;
}

async function currentPending(actions: SignupActions): Promise<PendingLoadResult> {
  const shared = sharedSignupState;
  if (shared?.kind === 'tombstone') return { kind: 'none' };
  if (shared?.kind === 'pending') return { kind: 'loaded', pending: shared.pending };
  return readPending(actions);
}

async function clearLogicalPending(
  revision: number,
  cleanup: () => Promise<void>,
): Promise<boolean> {
  // Publish first so a new instance never sees stale storage after a logical clear.
  publishSharedTombstone(revision);
  const cleaned = await persist(cleanup);
  if (cleaned) clearSharedTombstoneAfterCleanup(revision);
  return cleaned;
}

/** Test-only reset for the module-scoped signup coordinator. */
export function resetSignupCoordinatorForTests(): void {
  sharedSignupState = null;
  sharedRevisionCounter = 0;
  appliedRevision = 0;
}

export function createSignupService(actions: SignupActions) {
  async function writePending(pending: PendingSignup, revision: number): Promise<boolean> {
    const written = await persist(() => actions.savePending(pending));
    if (written) clearSharedStateAfterWrite(revision);
    else publishSharedPending(pending, revision);
    return written;
  }

  return {
    async register(input: RegisterInput): Promise<SignupResult> {
      const revision = nextSharedRevision();
      const body: RegisterInput = {
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: input.password,
        verificationChannel: input.verificationChannel,
      };

      const response = await post(actions, { url: '/auth/register', body });
      if (!response) return { kind: 'networkFailure' };

      if (response.status === 202) {
        const pending = acceptedPending(
          response.data,
          metadataFromInput(input, timestamp(actions)),
        );
        if (!pending) return { kind: 'unexpectedServerError' };
        if (!(await writePending(pending, revision))) {
          return { kind: 'pendingPersistenceFailed', pending };
        }
        return { kind: 'pending', source: 'register', pending };
      }

      if (response.status === 503) {
        const token = continuationTokenOf(response.data);
        if (!token) return { kind: 'unexpectedServerError' };
        const pending = deliveryFailedPending(
          token,
          metadataFromInput(input, timestamp(actions)),
        );
        if (!(await writePending(pending, revision))) {
          return { kind: 'pendingPersistenceFailed', pending };
        }
        return { kind: 'deliveryUnavailable', pending, continuationToken: token };
      }

      return mapFailure('register', response.status, response.data);
    },

    async verify(input: VerifyInput): Promise<SignupResult> {
      const revision = nextSharedRevision();
      const loaded = await currentPending(actions);
      if (loaded.kind === 'failed') return { kind: 'pendingReadFailed' };
      if (loaded.kind === 'none' || loaded.pending.kind !== 'accepted') {
        return { kind: 'invalidPendingSignup' };
      }

      const response = await post(actions, {
        url: '/auth/signup/verify',
        body: { userId: loaded.pending.userId, channel: loaded.pending.channel, code: input.code },
      });
      if (!response) return { kind: 'networkFailure' };

      if (response.status === 200) {
        const token = stringField(recordOf(response.data), 'token');
        if (!token) return { kind: 'unexpectedServerError' };
        if (!(await persist(() => actions.saveSessionToken(token)))) {
          return { kind: 'unexpectedServerError' };
        }
        // The session is already valid; cleanup failure must not undo or hide it.
        if (!(await clearLogicalPending(revision, () => actions.clearPending()))) {
          return { kind: 'verified', pendingCleanupFailed: true };
        }
        return { kind: 'verified' };
      }

      // Wrong, expired, consumed and superseded codes are indistinguishable.
      if (response.status === 401) return { kind: 'invalidOrExpiredCode' };
      return mapFailure('verify', response.status, response.data);
    },

    async resend(): Promise<SignupResult> {
      const revision = nextSharedRevision();
      const loaded = await currentPending(actions);
      if (loaded.kind === 'failed') return { kind: 'pendingReadFailed' };
      if (loaded.kind === 'none') return { kind: 'invalidPendingSignup' };

      const body: ResendRequestBody = loaded.pending.kind === 'delivery-failed'
        ? { continuationToken: loaded.pending.continuationToken }
        : { userId: loaded.pending.userId };

      const response = await post(actions, { url: '/auth/signup/resend', body });
      if (!response) return { kind: 'networkFailure' };

      if (response.status === 200) {
        const updated = acceptedPending(response.data, metadataFromPending(loaded.pending));
        if (!updated) return { kind: 'unexpectedServerError' };
        if (!(await writePending(updated, revision))) {
          return { kind: 'pendingPersistenceFailed', pending: updated };
        }
        return { kind: 'pending', source: 'resend', pending: updated };
      }

      if (response.status === 503) {
        const token = continuationTokenOf(response.data);
        if (!token) return { kind: 'unexpectedServerError' };
        const rotated = deliveryFailedPending(token, metadataFromPending(loaded.pending));
        if (!(await writePending(rotated, revision))) {
          return { kind: 'pendingPersistenceFailed', pending: rotated };
        }
        return { kind: 'deliveryUnavailable', pending: rotated, continuationToken: token };
      }

      if (response.status === 401) {
        const cleaned = await clearLogicalPending(revision, () => actions.clearPending());
        return cleaned
          ? { kind: 'invalidPendingSignup' }
          : { kind: 'invalidPendingSignup', cleanupFailed: true };
      }

      return mapFailure('resend', response.status, response.data);
    },

    loadPending(): Promise<PendingLoadResult> {
      return currentPending(actions);
    },

    /** Publishes a tombstone immediately, then retries only local SecureStore cleanup. */
    clearPending(): Promise<boolean> {
      return clearLogicalPending(nextSharedRevision(), () => actions.clearPending());
    },

    /** Retry local persistence only; never re-sends and never clears a newer state. */
    async persistPending(pending: PendingSignup): Promise<boolean> {
      const expected = sharedSignupState;
      const written = await persist(() => actions.savePending(pending));
      if (
        written
        && expected?.kind === 'pending'
        && sharedSignupState === expected
        && samePending(expected.pending, pending)
      ) {
        clearSharedStateIfSame(expected);
      }
      return written;
    },
  };
}
