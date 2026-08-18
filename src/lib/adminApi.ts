export const API_URL = (
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.DEV ? "http://localhost:3000" : "")
).replace(/\/+$/, "");

const ADMIN_SESSION_KEY = "pawside-admin-session";

export type AdminSession = {
  accessToken: string;
  user: {
    id: string;
    firstName: string;
    surname: string;
    email: string;
    role: "ADMIN" | "STAFF";
  };
};

export function getAdminSession(): AdminSession | null {
  const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    return null;
  }
}

export function setAdminSession(session: AdminSession): void {
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const session = getAdminSession();
  const headers = new Headers(init.headers);
  if (session) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401) {
    clearAdminSession();
  }
  return response;
}
