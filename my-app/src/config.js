// Centralized API configuration for frontend
// Configure these in Vercel as environment variables:
// - REACT_APP_API_URL (Node/Express backend base URL)
// - REACT_APP_PY_API_URL (Python backend base URL)

export const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:5000").replace(/\/$/, "");
export const PY_API_BASE = (process.env.REACT_APP_PY_API_URL || "http://localhost:5001").replace(/\/$/, "");

export const apiUrl = (path) =>
  `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

export const pyApiUrl = (path) =>
  `${PY_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

// Prevent multiple redirects on 401
let isRedirecting = false;

// Fetch wrapper for authenticated requests using httpOnly cookies
export const apiFetch = async (
  path,
  { body, signal, headers: extraHeaders, ...rest } = {}
) => {
  const url = path.startsWith("http") ? path : apiUrl(path);

  try {
    const res = await fetch(url, {
      ...rest,
      body,
      signal,
      credentials: "include",
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(extraHeaders || {}),
      },
    });

    // Avoid redirect loop for auth endpoints (e.g., login failure)
    const isAuthRoute = url.includes("/api/auth/");

    if (res.status === 401 && !isRedirecting && !isAuthRoute) {
      isRedirecting = true;

      console.warn("Session expired. Redirecting to login...");

      try {
        localStorage.removeItem("user");
      } catch {}

      // Defer redirect so other in-flight 401 responses hit the isRedirecting guard
      // before the page unloads, preventing multiple redirect attempts.
      setTimeout(() => {
        window.location.href = "/login";

        // NOTE: window.location.href triggers a full reload → resets isRedirecting.
        // If you switch to SPA navigation (e.g., navigate('/login')),
        // you MUST manually reset: isRedirecting = false;
      }, 100);
    }

    return res;
  } catch (err) {
    console.error("API Fetch Error:", err);
    throw new Error("Network error");
  }
};