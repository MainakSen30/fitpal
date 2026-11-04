const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const row = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return row ? decodeURIComponent(row.slice(prefix.length)) : null;
}

/** Double-submit token: echo the non-HttpOnly cookie in a header. */
async function getCsrfToken(): Promise<string | null> {
  const existing = readCookie("csrf_token");
  if (existing) return existing;

  try {
    const res = await fetch(`${API_URL}/api/v1/auth/csrf`, { credentials: "include" });
    if (!res.ok) return null;
    const body = (await res.json()) as { csrfToken?: string };
    return body.csrfToken ?? readCookie("csrf_token");
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers } = options;
  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (!SAFE_METHODS.has(method.toUpperCase())) {
    const csrfToken = await getCsrfToken();
    if (csrfToken) requestHeaders["X-CSRF-Token"] = csrfToken;
  }

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers: requestHeaders,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
