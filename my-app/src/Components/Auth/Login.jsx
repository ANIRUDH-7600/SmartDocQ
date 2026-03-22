import React, { useRef, useEffect } from "react";
import { useAuthForm } from "./useAuthForm";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";
import "./Login.css";

export default function Login({ onAuthSuccess = () => {}, initialMode = "login", onClose = () => {} }) {
  const {
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
  } = useAuthForm({ onAuthSuccess, initialMode });

  const sliderRef = useRef(null);
  const loginBtnRef = useRef(null);
  const signupBtnRef = useRef(null);

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
      <div className="form-toggle">
        <button
          ref={loginBtnRef}
          className={`toggle-btn ${isLogin ? "active" : ""}`}
          onClick={() => setIsLogin(true)}
          type="button"
        >
          Sign In
        </button>
        <button
          ref={signupBtnRef}
          className={`toggle-btn ${!isLogin ? "active" : ""}`}
          onClick={() => setIsLogin(false)}
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
    </div>
  );
}