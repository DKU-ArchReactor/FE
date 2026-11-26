import { useSyncExternalStore } from "react";
import type { UserMeResponse } from "@/type/auth";

let previousToken: string | null | undefined;
let session = { epoch: 0, authenticated: false };
let cachedProfile: { epoch: number; user: UserMeResponse } | null = null;

export function getCachedUser(epoch: number): UserMeResponse | null {
  return cachedProfile?.epoch === epoch ? cachedProfile.user : null;
}

export function setCachedUser(epoch: number, user: UserMeResponse): void {
  cachedProfile = { epoch, user };
}

export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

export function setAuthTokens(accessToken: string, tokenType?: string): void {
  localStorage.setItem("access_token", accessToken);
  if (tokenType) {
    localStorage.setItem("token_type", tokenType);
  }
  notifyAuthChanged();
}

export function clearAuthTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  cachedProfile = null;
  notifyAuthChanged();
}

// Tokens stay in the existing auth storage. Only an opaque generation reaches UI state.
export function getAuthSession() {
  const token = getAccessToken();
  if (token !== previousToken) {
    previousToken = token;
    session = { epoch: session.epoch + 1, authenticated: Boolean(token) };
  }
  return session;
}
export function notifyAuthChanged() {
  window.dispatchEvent(new Event("archreactor:auth"));
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("archreactor:auth", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("archreactor:auth", onChange);
    window.removeEventListener("focus", onChange);
  };
}
export function useAuthSession() {
  return useSyncExternalStore(subscribe, getAuthSession, getAuthSession);
}
