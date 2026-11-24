/// <reference types="bun-types" />
import { describe, expect, it, mock } from 'bun:test';
import { createLogoutService, type LogoutActions } from './logout';

function actions(overrides: Partial<LogoutActions> = {}) {
  return {
    getToken: mock(async () => 'session-token'),
    deleteToken: mock(async () => {}),
    post: mock(async () => ({})),
    ...overrides,
  };
}

describe('createLogoutService', () => {
  it('revokes the server session before deleting the local token', async () => {
    const calls: string[] = [];
    const deps = actions({
      post: mock(async () => {
        calls.push('post');
        return {};
      }),
      deleteToken: mock(async () => {
        calls.push('delete');
      }),
    });

    expect(await createLogoutService(deps).revoke()).toBe('revoked');
    expect(deps.post).toHaveBeenCalledWith({
      url: '/auth/logout',
      headers: { Authorization: 'Bearer session-token' },
    });
    expect(deps.deleteToken).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['post', 'delete']);
  });

  it('keeps the token when the API reports 503', async () => {
    const deps = actions({
      post: mock(async () => {
        throw Object.assign(new Error('service unavailable'), { response: { status: 503 } });
      }),
    });

    expect(await createLogoutService(deps).revoke()).toBe('failed');
    expect(deps.deleteToken).not.toHaveBeenCalled();
  });

  it('keeps the token on a network failure', async () => {
    const deps = actions({
      post: mock(async () => {
        throw new Error('Network Error');
      }),
    });

    expect(await createLogoutService(deps).revoke()).toBe('failed');
    expect(deps.deleteToken).not.toHaveBeenCalled();
  });

  it('reports a retryable failure when token deletion fails after revocation', async () => {
    const deps = actions({
      deleteToken: mock(async () => {
        throw new Error('SecureStore unavailable');
      }),
    });

    expect(await createLogoutService(deps).revoke()).toBe('failed');
  });

  it('skips the API when no token is stored', async () => {
    const deps = actions({ getToken: mock(async () => null) });

    expect(await createLogoutService(deps).revoke()).toBe('no-token');
    expect(deps.post).not.toHaveBeenCalled();
    expect(deps.deleteToken).not.toHaveBeenCalled();
  });

  it('shares one in-flight request across duplicate taps', async () => {
    let finish!: () => void;
    const post = mock(() => new Promise<void>((resolve) => {
      finish = resolve;
    }));
    const deps = actions({ post });
    const service = createLogoutService(deps);

    const first = service.revoke();
    const second = service.revoke();
    await Promise.resolve();

    expect(post).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    finish();
    expect(await first).toBe('revoked');
    expect(await second).toBe('revoked');

    const third = service.revoke();
    await Promise.resolve();
    expect(post).toHaveBeenCalledTimes(2);
    finish();
    expect(await third).toBe('revoked');
  });
});
