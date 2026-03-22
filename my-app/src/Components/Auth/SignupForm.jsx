import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useToast } from "../ToastContext";
import PasswordStrength from "./PasswordStrength";

export default function SignupForm({
  signupData,
  errors,
  loading,
  showPassword,
  passwordStrength,
  getRef,
  handleChange,
  handleSubmit,
  togglePasswordVisibility,
  handleGoogleSuccess,
}) {
  const { showToast } = useToast();

  const handleSignupChange = (e) => handleChange(e, "signup");
  const handleSignupSubmit = (e) => handleSubmit(e, "signup");
  const toggleSignup = () => togglePasswordVisibility("signup");
  const toggleConfirm = () => togglePasswordVisibility("confirm");

  return (
    <div className="form-content">
      <h2 className="form-title">Create account</h2>
      <p className="form-subtitle">join smartdocq today →</p>

      <form onSubmit={handleSignupSubmit}>
        <div className="input-group">
          <label htmlFor="signup-username">Username</label>
          <input
            id="signup-username"
            ref={getRef("username")}
            type="text" name="username" placeholder="choose a username"
            value={signupData.username}
            onChange={handleSignupChange}
            className={errors.username ? "input-error" : ""}
            autoComplete="username"
          />
          {errors.username && <span className="error-message">{errors.username}</span>}
        </div>

        <div className="input-group" style={{ marginTop: "12px" }}>
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            ref={getRef("email")}
            type="email" name="email" placeholder="you@example.com"
            value={signupData.email}
            onChange={handleSignupChange}
            className={errors.email ? "input-error" : ""}
            autoComplete="email"
          />
          {errors.email && <span className="error-message">{errors.email}</span>}
        </div>

        <div className="password-row" style={{ marginTop: "12px" }}>
          <div className="input-group">
            <label htmlFor="signup-password">Password</label>
            <div className="password-input-wrapper">
              <input
                id="signup-password"
                ref={getRef("password")}
                type={showPassword.signup ? "text" : "password"}
                name="password" placeholder="••••••••"
                value={signupData.password}
                onChange={handleSignupChange}
                className={errors.password ? "input-error" : ""}
                autoComplete="new-password"
              />
              <button type="button" className="password-toggle-btn"
                onClick={toggleSignup}
                aria-label="Toggle password visibility">
                {showPassword.signup ? "🙈" : "👁️"}
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          <div className="input-group">
            <label htmlFor="signup-confirm">Confirm</label>
            <div className="password-input-wrapper">
              <input
                id="signup-confirm"
                ref={getRef("confirmPassword")}
                type={showPassword.confirm ? "text" : "password"}
                name="confirmPassword" placeholder="••••••••"
                value={signupData.confirmPassword}
                onChange={handleSignupChange}
                className={errors.confirmPassword ? "input-error" : ""}
                autoComplete="new-password"
              />
              <button type="button" className="password-toggle-btn"
                onClick={toggleConfirm}
                aria-label="Toggle password visibility">
                {showPassword.confirm ? "🙈" : "👁️"}
              </button>
            </div>
            {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
          </div>
        </div>

        <PasswordStrength password={signupData.password} strength={passwordStrength} />

        <div className="auth-submit-wrapper">
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </div>

        <div className="divider"><span>or continue with</span></div>

        <div className="google-btn-wrapper">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => showToast("Google Sign-In Failed", { type: "error" })}
            theme="filled_black" size="large"
            text="signup_with" shape="rectangular" width="100%"
          />
        </div>
      </form>
    </div>
  );
}