import React, { useRef, useEffect, useCallback, useState } from "react";
import { useAuthForm } from "./useAuthForm";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import ForgotPasswordModal from "./ForgotPasswordModal";
import "./Login.css";

export default function Login({
  onAuthSuccess = () => {},
  initialMode = "login",
  onClose = () => {},
}) {
  const [showForgot, setShowForgot] = useState(false);

  const handleAuthSuccess = useCallback((user) => {
    onAuthSuccess(user);
    onClose();
  }, [onAuthSuccess, onClose]);

  const {
    isLogin, switchMode,
    loginData, signupData,
    errors, loading,
    passwordStrength,
    showPassword,
    handleChange,
    handleSubmit,
    handleGoogleSuccess,
    togglePasswordVisibility,
    resetForms,
    getRef,
  } = useAuthForm({ onAuthSuccess: handleAuthSuccess, initialMode });

  const sliderRef = useRef(null);
  const loginBtnRef = useRef(null);
  const signupBtnRef = useRef(null);

  // Clear any leftover login/signup values whenever the auth popup is mounted
  useEffect(() => {
    resetForms();
  }, [resetForms]);

  useEffect(() => {
    const updateSlider = () => {
      const btn = isLogin ? loginBtnRef.current : signupBtnRef.current;
      const toggle = sliderRef.current?.parentElement;
      if (!btn || !sliderRef.current || !toggle) return;

      const toggleRect = toggle.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      sliderRef.current.style.left = `${btnRect.left - toggleRect.left}px`;
      sliderRef.current.style.width = `${btnRect.width}px`;
    };

    updateSlider();
    window.addEventListener("resize", updateSlider);
    return () => window.removeEventListener("resize", updateSlider);
  }, [isLogin]);

  return (
    <div className="auth-container">
      {!showForgot && (
        <>
          <div className="form-toggle">
            <button
              ref={loginBtnRef}
              className={`toggle-btn ${isLogin ? "active" : ""}`}
              onClick={() => switchMode("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              ref={signupBtnRef}
              className={`toggle-btn ${!isLogin ? "active" : ""}`}
              onClick={() => switchMode("signup")}
              type="button"
            >
              Sign Up
            </button>
            <div ref={sliderRef} className="toggle-slider" />
          </div>

          <div className={`form-wrapper ${isLogin ? "active" : ""}`}>
            <LoginForm
              loginData={loginData}
              errors={errors}
              loading={loading}
              showPassword={showPassword}
              getRef={getRef}
              handleChange={handleChange}
              handleSubmit={handleSubmit}
              togglePasswordVisibility={togglePasswordVisibility}
              handleGoogleSuccess={handleGoogleSuccess}
              onForgotPassword={() => setShowForgot(true)}
            />
          </div>

          <div className={`form-wrapper ${!isLogin ? "active" : ""}`}>
            <SignupForm
              signupData={signupData}
              errors={errors}
              loading={loading}
              showPassword={showPassword}
              passwordStrength={passwordStrength}
              getRef={getRef}
              handleChange={handleChange}
              handleSubmit={handleSubmit}
              togglePasswordVisibility={togglePasswordVisibility}
              handleGoogleSuccess={handleGoogleSuccess}
              onClose={onClose}
            />
          </div>
        </>
      )}

      {showForgot && (
        <ForgotPasswordModal onClose={() => setShowForgot(false)} />
      )}
    </div>
  );
}