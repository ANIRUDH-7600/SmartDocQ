import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../ToastContext";
import { apiUrl } from "../../config";

const calculatePasswordStrength = (password) => {
  if (!password) return { score: 0, label: "", requirements: {} };
  let score = 0;
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  if (requirements.length) score += 25;
  if (requirements.uppercase) score += 20;
  if (/[a-z]/.test(password)) score += 15;
  if (requirements.number) score += 20;
  if (requirements.special) score += 20;
  const label = score < 40 ? "Weak" : score < 70 ? "Medium" : "Strong";
  return { score, label, requirements };
};

const validateForm = (type, loginData, signupData) => {
  const newErrors = {};
  const data = type === "login" ? loginData : signupData;

  if (!data.email.trim()) newErrors.email = "Email is required";
  else if (!/\S+@\S+\.\S+/.test(data.email)) newErrors.email = "Invalid email";

  if (!data.password.trim()) newErrors.password = "Password is required";
  else if (data.password.length < 6 || data.password.length > 30)
    newErrors.password = "Password must be 6–30 characters long";
  else if (/\s/.test(data.password)) newErrors.password = "Password cannot contain spaces";

  if (type === "signup") {
    if (!data.username.trim()) newErrors.username = "Username is required";
    else if (!/^[a-zA-Z0-9 _\-@#$]{3,15}$/.test(data.username))
      newErrors.username = "Username must be 3–15 characters; letters, numbers, spaces, _, -, @, #, $ allowed";
    if (!data.confirmPassword.trim()) newErrors.confirmPassword = "Please confirm your password";
    else if (data.password !== data.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
  }
  return newErrors;
};

export function useAuthForm({ onAuthSuccess, initialMode }) {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [isLogin, setIsLogin] = useState(initialMode !== "signup");
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({ email: "", username: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: "", requirements: {} });
  const [showPassword, setShowPassword] = useState({ login: false, signup: false, confirm: false });

  const firstErrorRef = useRef(null);

  useEffect(() => {
    setIsLogin(initialMode !== "signup");
  }, [initialMode]);

  useEffect(() => {
    if (firstErrorRef.current) {
      firstErrorRef.current.focus();
      firstErrorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [errors]);

  const handleAuthSuccess = useCallback((user, successMessage) => {
    if (user) {
      try {
        localStorage.setItem("user", JSON.stringify(user));
      } catch (err) {
        console.warn("Could not persist user to localStorage:", err);
      }
    }
    if (user?.isAdmin) {
      showToast("Welcome Admin! Redirecting to admin panel...", { type: "success" });
      setTimeout(() => navigate("/admin"), 1000);
    } else {
      showToast(successMessage, { type: "success" });
      onAuthSuccess(user || {});
    }
  }, [navigate, showToast, onAuthSuccess]);

  const handleChange = (e, type) => {
    const { name, value } = e.target;
    const setter = type === "login" ? setLoginData : setSignupData;
    setter(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    if (type === "signup" && name === "password") {
      setPasswordStrength(calculatePasswordStrength(value));
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const getRef = (field) => errors[field] ? firstErrorRef : null;

  const handleSubmit = async (e, type) => {
    e.preventDefault();
    const newErrors = validateForm(type, loginData, signupData);
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const payload = type === "login"
      ? loginData
      : { name: signupData.username, email: signupData.email, password: signupData.password };

    const url = type === "login" ? apiUrl("/api/auth/login") : apiUrl("/api/auth/signup");

    setLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (res.ok) {
        if (type === "login") {
          const { user } = result;
          handleAuthSuccess(user, "Login successful");
          setLoginData({ email: "", password: "" });
        } else {
          showToast("Signup successful! Please login.", { type: "success" });
          setSignupData({ email: "", username: "", password: "", confirmPassword: "" });
          setIsLogin(true);
        }
      } else {
        if (type === "login" && res.status === 403) {
          showToast("Your account is deactivated. Please contact support.", { type: "error" });
        } else {
          showToast(result.message || (type === "login" ? "Login failed" : "Signup failed"), { type: "error" });
        }
      }
    } catch (err) {
      console.error(`${type} error:`, err);
      showToast("Server error", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/google"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const result = await res.json();
      if (res.ok) {
        const { user } = result;
        handleAuthSuccess(user, "Signed in with Google successfully!");
      } else {
        showToast(result.message || "Google Sign-In failed", { type: "error" });
      }
    } catch (err) {
      console.error("Google Sign-In error:", err);
      showToast("Google Sign-In failed", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return {
    isLogin, setIsLogin,
    loginData, signupData,
    errors, loading,
    passwordStrength,
    showPassword,
    handleChange,
    handleSubmit,
    handleGoogleSuccess,
    togglePasswordVisibility,
    getRef,
  };
}