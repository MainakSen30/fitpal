import { z } from 'zod';

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
  | { kind: 'sessionPersistenceFailed'; pending: AcceptedPendingSignup; cleanupFailed?: boolean }
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

// Backend normalizes with libphonenumber-js. Without that dependency on mobile,
// require the E.164 shape rather than guessing a default country.
export const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export const signupSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().trim().email('Invalid email').max(320, 'Email is too long'),
  phone: z.string().trim().regex(E164_PATTERN, 'Include your country code, e.g. +14155550123'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  verificationChannel: z.enum(['email', 'sms']),
});

export type SignupFormValues = z.infer<typeof signupSchema>;

export function toRegisterInput(values: SignupFormValues): RegisterInput {
  return {
    name: values.name,
    email: values.email,
    phone: values.phone,
    password: values.password,
    verificationChannel: values.verificationChannel,
  };
}

export type SignupScreenOutcome =
  | { kind: 'verify'; deliveryUnavailable?: boolean }
  | { kind: 'recover'; pending: PendingSignup; message: string }
  | { kind: 'notice'; message: string };

export function mapSignupResult(result: SignupResult): SignupScreenOutcome {
  switch (result.kind) {
    case 'pending':
      return { kind: 'verify' };
    case 'deliveryUnavailable':
      return { kind: 'verify', deliveryUnavailable: true };
    case 'pendingPersistenceFailed':
      return {
        kind: 'recover',
        pending: result.pending,
        message: 'Registration succeeded, but this device could not save it. Retry saving to continue verification.',
      };
    case 'duplicateRegistration':
      return { kind: 'notice', message: 'We could not create that account. Check your details or sign in.' };
    case 'rateLimit':
      return { kind: 'notice', message: 'Too many attempts. Please try again later.' };
    case 'networkFailure':
      return { kind: 'notice', message: "You're offline. Check your connection and try again." };
    case 'validationError':
      return { kind: 'notice', message: 'Check your details and try again.' };
    default:
      return { kind: 'notice', message: 'We could not complete registration. Please try again.' };
  }
}

export type VerifyScreenOutcome =
  | { kind: 'success'; cleanupFailed?: boolean }
  | { kind: 'sessionPersistenceFailed'; message: string }
  | { kind: 'restart'; message: string }
  | { kind: 'error'; message: string };

export function mapVerifyResult(result: SignupResult): VerifyScreenOutcome {
  switch (result.kind) {
    case 'verified':
      return result.pendingCleanupFailed
        ? { kind: 'success', cleanupFailed: true }
        : { kind: 'success' };
    case 'sessionPersistenceFailed':
      return {
        kind: 'sessionPersistenceFailed',
        message: 'Verification succeeded, but we could not save your session. Please sign in with your password.',
      };
    case 'invalidOrExpiredCode':
      return { kind: 'error', message: 'That code is invalid or has expired. Try again or request a new one.' };
    case 'codeLockout':
      return { kind: 'error', message: 'Too many incorrect attempts. Request a new code after the lock expires.' };
    case 'rateLimit':
      return { kind: 'error', message: 'Too many requests. Please wait before trying again.' };
    case 'networkFailure':
      return { kind: 'error', message: "You're offline. Check your connection and try again." };
    case 'validationError':
      return { kind: 'error', message: 'Enter the 6-digit code.' };
    case 'pendingReadFailed':
      return { kind: 'restart', message: 'We could not read your signup. Please start again.' };
    case 'invalidPendingSignup':
      return { kind: 'restart', message: 'This verification is no longer available. Please start again.' };
    case 'pendingPersistenceFailed':
      return { kind: 'error', message: 'We could not save your signup on this device. Please retry.' };
    default:
      return { kind: 'error', message: 'We could not verify the code. Please try again.' };
  }
}

export type ResendScreenOutcome =
  | { kind: 'resent'; message: string }
  | { kind: 'deliveryUnavailable'; message: string }
  | { kind: 'restart'; message: string }
  | { kind: 'error'; message: string };

export function mapResendResult(result: SignupResult): ResendScreenOutcome {
  switch (result.kind) {
    case 'pending':
      return { kind: 'resent', message: 'A new verification code was sent.' };
    case 'deliveryUnavailable':
      return { kind: 'deliveryUnavailable', message: "We couldn't deliver a code. Please try again." };
    case 'pendingPersistenceFailed':
      return { kind: 'error', message: 'Delivery failed and the retry details could not be saved. Please try again.' };
    case 'invalidPendingSignup':
      return { kind: 'restart', message: 'This verification is no longer available. Please start again.' };
    case 'pendingReadFailed':
      return { kind: 'error', message: 'We could not read your signup. Please retry.' };
    case 'rateLimit':
      return { kind: 'error', message: 'Too many requests. Please wait before requesting another code.' };
    case 'networkFailure':
      return { kind: 'error', message: "You're offline. Check your connection and try again." };
    case 'codeLockout':
      return { kind: 'error', message: 'Too many incorrect attempts. Request a new code after the lock expires.' };
    default:
      return { kind: 'error', message: 'We could not resend the code. Please try again.' };
  }
}

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

export function isPendingSignup(value: unknown): value is PendingSignup {
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

// Legacy message matching remains for older backends; new responses carry codes.
const LOCKOUT_MESSAGE = 'Too many incorrect attempts. Request a new code after the lock expires.';
const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later.';
const DELIVERY_UNAVAILABLE_MESSAGE = 'Verification request could not be completed';

function errorCodeOf(data: unknown): string | undefined {
  const record = recordOf(data);
  return stringField(record, 'code') ?? stringField(recordOf(record?.error), 'code');
}

function mapBadRequest(data: unknown): BadRequestResult {
  const code = errorCodeOf(data);
  if (code === 'VALIDATION_ERROR') return { kind: 'validationError' };
  if (code === 'OTP_LOCKED') return { kind: 'codeLockout' };
  if (
    code === 'RATE_LIMITED'
    || code === 'OTP_RESEND_COOLDOWN'
    || code === 'OTP_RESEND_LIMIT'
  ) return { kind: 'rateLimit' };

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
  const code = errorCodeOf(data);
  switch (code) {
    case 'VALIDATION_ERROR':
      return { kind: 'validationError' };
    case 'IDENTITY_ALREADY_REGISTERED':
      return operation === 'register'
        ? { kind: 'duplicateRegistration' }
        : { kind: 'unexpectedServerError' };
    case 'OTP_INVALID_OR_EXPIRED':
      if (operation === 'verify') return { kind: 'invalidOrExpiredCode' };
      if (operation === 'resend') return { kind: 'invalidPendingSignup' };
      break;
    case 'SIGNUP_CONTINUATION_INVALID':
      return { kind: 'invalidPendingSignup' };
    case 'OTP_LOCKED':
      return { kind: 'codeLockout' };
    case 'RATE_LIMITED':
    case 'OTP_RESEND_COOLDOWN':
    case 'OTP_RESEND_LIMIT':
      return { kind: 'rateLimit' };
    case 'INTERNAL_ERROR':
      return { kind: 'unexpectedServerError' };
  }

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
          // The OTP is consumed and the account is verified. The pending record
          // is no longer usable, so clear it and point the user to password login.
          const cleaned = await clearLogicalPending(revision, () => actions.clearPending());
          return cleaned
            ? { kind: 'sessionPersistenceFailed', pending: loaded.pending }
            : { kind: 'sessionPersistenceFailed', pending: loaded.pending, cleanupFailed: true };
        }
        // The session is already valid; cleanup failure must not undo or hide it.
        if (!(await clearLogicalPending(revision, () => actions.clearPending()))) {
          return { kind: 'verified', pendingCleanupFailed: true };
        }
        return { kind: 'verified' };
      }

      // Wrong, expired, consumed and superseded codes are indistinguishable.
      if (
        response.status === 401
        || errorCodeOf(response.data) === 'OTP_INVALID_OR_EXPIRED'
      ) return { kind: 'invalidOrExpiredCode' };
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

      if (
        response.status === 401
        || errorCodeOf(response.data) === 'SIGNUP_CONTINUATION_INVALID'
        || errorCodeOf(response.data) === 'OTP_INVALID_OR_EXPIRED'
      ) {
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
