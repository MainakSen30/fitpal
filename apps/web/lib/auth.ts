import { api } from "./api-client";

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

type AuthResponse = { user: User };

export async function register(email: string, password: string, name: string) {
  return api.post<AuthResponse>("/auth/register", { email, password, name });
}

export async function login(email: string, password: string) {
  return api.post<AuthResponse>("/auth/login", { email, password });
}

export async function logout() {
  return api.post<{ success: boolean }>("/auth/logout", {});
}

export async function getSession() {
  return api.get<{ user: User | null }>("/auth/me");
}

export function getGoogleOAuthUrl() {
  return `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/google`;
}
