import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { resetPassword } from "../../Services/AuthService";
import { useToast } from "../ToastContext";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nextPwd = password.trim();
    const nextConfirm = confirmPassword.trim();

    if (!nextPwd || !nextConfirm) {
      showToast("Please fill in both password fields", { type: "error" });
      return;
    }

    if (nextPwd !== nextConfirm) {
      showToast("Passwords do not match", { type: "error" });
      return;
    }

    if (!token) {
      showToast("Reset link is invalid or missing.", { type: "error" });
      return;
    }

    setLoading(true);

    try {
      const { ok, data } = await resetPassword(token, nextPwd);

      if (ok) {
        showToast(data.message || "Password reset successful", { type: "success" });
        setTimeout(() => navigate("/"), 1500);
      } else {
        showToast(data.message || "Failed to reset password", { type: "error" });
      }
    } catch {
      showToast("Reset failed", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-page">
      <div className="reset-card">
        <h2 className="form-title">Reset password</h2>
        <p className="form-subtitle">Choose a new password for your account</p>

        <form onSubmit={handleSubmit} className="reset-form">
          <div className="input-group">
            <label htmlFor="reset-password-input">New password</label>
            <div className="password-input-wrapper">
              <input
                id="reset-password-input"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
                aria-label="Toggle password visibility"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div className="input-group" style={{ marginTop: "12px" }}>
            <label htmlFor="reset-password-confirm">Confirm password</label>
            <div className="password-input-wrapper">
              <input
                id="reset-password-confirm"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                disabled={loading}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div className="auth-submit-wrapper" style={{ marginTop: "20px" }}>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Updating..." : "Reset password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
