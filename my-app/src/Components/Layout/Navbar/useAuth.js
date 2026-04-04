import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../ToastContext";
import { logoutUser } from "../../../Services/AuthService";

const safeParseUser = (jsonStr) => {
  if (!jsonStr || typeof jsonStr !== "string") return null;
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const { _id, id, email, name } = parsed;
    const userId = _id || id;
    if (!userId || typeof userId !== "string") return null;
    if (!email || typeof email !== "string" || !email.includes("@")) return null;
    if (!name || typeof name !== "string" || name.trim().length === 0) return null;
    return {
      _id: userId,
      id: userId,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      avatar: typeof parsed.avatar === "string" ? parsed.avatar : null,
      role: typeof parsed.role === "string" ? parsed.role : "user",
    };
  } catch {
    return null;
  }
};

const getStoredUser = () => {
  const saved = localStorage.getItem("user");
  const parsed = safeParseUser(saved);

  if (saved && !parsed) {
    console.warn("Invalid user data removed from storage");
    localStorage.removeItem("user");
  }

  return parsed;
};

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Initialize user state from localStorage
  useEffect(() => {
    try {
      setUser(getStoredUser());
    } catch (err) {
      console.error("Auth init failed:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep auth state in sync across browser tabs and same-tab changes
  useEffect(() => {
    const syncUser = () => {
      try {
        setUser(getStoredUser());
      } catch {
        setUser(null);
      }
    };

    const onStorage = (e) => {
      if (e.key === "user") syncUser();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("userChanged", syncUser);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("userChanged", syncUser);
    };
  }, []);

  const persistUser = useCallback((userData) => {
    const validated = safeParseUser(
      typeof userData === "string" ? userData : JSON.stringify(userData)
    );
    if (!validated) {
      console.warn("persistUser called with invalid user data");
      return;
    }
    try {
      localStorage.setItem("user", JSON.stringify(validated));
    } catch {}
    setUser(validated);
    try {
      window.dispatchEvent(new Event("userChanged"));
    } catch {}
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem("user"); } catch {}
    try { window.dispatchEvent(new Event("userChanged")); } catch {}
    showToast("Logout successful", { type: "success" });
    navigate("/");
    logoutUser().catch((err) => {
      console.error("Logout API failed:", err);
    });
  }, [navigate, showToast]);

  return { user, loading, persistUser, logout };
}

export { safeParseUser };