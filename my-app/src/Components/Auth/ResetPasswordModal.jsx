import React, { useState } from "react";
import { resetPassword } from "../../Services/AuthService";
import { useToast } from "../ToastContext";

export default function ResetPasswordModal({ token, onClose }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

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

    setLoading(true);
    try {
      const { ok, data } = await resetPassword(token, nextPwd);
      if (ok) {
        showToast(data.message || "Password reset successful", { type: "success" });
        if (onClose) onClose();
      } else {
        showToast(data.message || "Failed to reset password", { type: "error" });
      }
    } catch (err) {
      showToast("Failed to reset password", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-content">
      <h2 className="form-title">Reset password</h2>
      <p className="form-subtitle">Choose a new password for your account</p>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="reset-password-input">New password</label>
          <input
            id="reset-password-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="new-password"
          />
        </div>

        <div className="input-group" style={{ marginTop: "12px" }}>
          <label htmlFor="reset-password-confirm">Confirm password</label>
          <input
            id="reset-password-confirm"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            autoComplete="new-password"
          />
        </div>

        <div className="auth-submit-wrapper" style={{ marginTop: "16px" }}>
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Updating..." : "Reset password"}
          </button>
        </div>

        <div className="auth-secondary-actions" style={{ marginTop: "12px" }}>
          <button
            type="button"
            className="auth-link-button"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
