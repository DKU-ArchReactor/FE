import { useSyncExternalStore } from "react";

let previousToken: string | null | undefined;
let session = { epoch: 0, authenticated: false };
// Tokens stay in the existing auth storage. Only an opaque generation reaches UI state.
export function getAuthSession() {
  const token = localStorage.getItem("access_token");
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
  return useSyncExternalStore(subscribe, getAuthSession);
}
