export type LogoutResult = 'revoked' | 'no-token' | 'failed';

export type LogoutActions = {
  getToken: () => Promise<string | null>;
  deleteToken: () => Promise<void>;
  post: (request: { url: string; headers: { Authorization: string } }) => Promise<unknown>;
};

/** Revoke first, delete the local token only after the server accepts the logout. */
export function createLogoutService(actions: LogoutActions) {
  let pending: Promise<LogoutResult> | null = null;

  return {
    revoke(): Promise<LogoutResult> {
      if (pending) return pending;

      pending = (async (): Promise<LogoutResult> => {
        try {
          const token = await actions.getToken();
          if (!token) return 'no-token';
          await actions.post({
            url: '/auth/logout',
            headers: { Authorization: `Bearer ${token}` },
          });
          await actions.deleteToken();
          return 'revoked';
        } catch {
          return 'failed';
        }
      })().finally(() => {
        pending = null;
      });

      return pending;
    },
  };
}
