import { apiFetch } from "../config";

// Normalize API response to a consistent shape
const parseJsonSafely = async (res) => {
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
};

export async function loginUser(payload, { signal } = {}) {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
  return parseJsonSafely(res);
}

export async function signupUser(payload, { signal } = {}) {
  const res = await apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
  return parseJsonSafely(res);
}

export async function submitGoogleAuth(credential, { signal } = {}) {
  const res = await apiFetch("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
    signal,
  });
  return parseJsonSafely(res);
}

export async function logoutUser({ signal } = {}) {
  const res = await apiFetch("/api/auth/logout", {
    method: "POST",
    signal,
  });
  return parseJsonSafely(res);
}

export async function forgotPassword(email, { signal } = {}) {
  const res = await apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
    signal,
  });
  return parseJsonSafely(res);
}

export async function resetPassword(token, password, { signal } = {}) {
  const res = await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
    signal,
  });
  return parseJsonSafely(res);
}

// Backwards-compatible wrapper (deprecated): submitAuth(type, payload)
// Prefer calling loginUser / signupUser directly.
export async function submitAuth(type, payload, opts) {
  if (type === "login") return loginUser(payload, opts);
  return signupUser(payload, opts);
}